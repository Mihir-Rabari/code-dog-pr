import simpleGit from 'simple-git'
import fs from 'fs-extra'
import path from 'path'
import axios from 'axios'

const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [GITHUB-SERVICE-INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [GITHUB-SERVICE-ERROR] ${message}`, error ? error.stack || error : '')
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [GITHUB-SERVICE-WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

class GitHubService {
  constructor() {
    this.workspaceDir = process.env.WORKSPACE_DIR || './workspace'
    this.githubToken = process.env.GITHUB_TOKEN
    this.maxCommitsToAnalyze = parseInt(process.env.MAX_COMMITS) || 50
    this.ensureWorkspaceExists()
  }

  async ensureWorkspaceExists() {
    try {
      await fs.ensureDir(this.workspaceDir)
      log.info('📁 Workspace directory ensured', { workspaceDir: this.workspaceDir })
    } catch (error) {
      log.error('❌ Failed to create workspace directory', error)
      throw error
    }
  }

  parseRepoUrl(repoUrl) {
    try {
      // Handle various GitHub URL formats
      const patterns = [
        /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
        /github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/
      ]

      for (const pattern of patterns) {
        const match = repoUrl.match(pattern)
        if (match) {
          return {
            owner: match[1],
            repo: match[2].replace('.git', ''),
            fullName: `${match[1]}/${match[2].replace('.git', '')}`,
            cloneUrl: `https://github.com/${match[1]}/${match[2].replace('.git', '')}.git`
          }
        }
      }

      throw new Error('Invalid GitHub repository URL format')
    } catch (error) {
      log.error('❌ Failed to parse repository URL', { repoUrl, error: error.message })
      throw error
    }
  }

  async cloneRepository(repoUrl, jobId) {
    try {
      const repoInfo = this.parseRepoUrl(repoUrl)
      const localPath = path.join(this.workspaceDir, jobId)
      
      log.info('📥 Cloning repository...', { 
        repoUrl: repoInfo.cloneUrl, 
        localPath,
        owner: repoInfo.owner,
        repo: repoInfo.repo
      })

      // Clean up existing directory if it exists
      await fs.remove(localPath)
      
      const git = simpleGit()
      
      // Clone with depth limit for performance
      await git.clone(repoInfo.cloneUrl, localPath, {
        '--depth': '100', // Limit history for performance
        '--single-branch': null
      })

      log.info('✅ Repository cloned successfully', { localPath })

      // Get additional repository information
      const localGit = simpleGit(localPath)
      const branches = await localGit.branch()
      const remotes = await localGit.getRemotes(true)

      return {
        ...repoInfo,
        localPath,
        currentBranch: branches.current,
        allBranches: branches.all,
        remotes: remotes
      }
    } catch (error) {
      log.error('❌ Repository cloning failed', error)
      throw error
    }
  }

  async analyzeCommits(localPath, maxCommits = null) {
    try {
      const git = simpleGit(localPath)
      const limit = maxCommits || this.maxCommitsToAnalyze
      
      log.info('🔍 Analyzing commit history...', { localPath, maxCommits: limit })

      // Get commit log with detailed information
      const commits = await git.log({
        maxCount: limit,
        format: {
          hash: '%H',
          date: '%ai',
          message: '%s',
          body: '%b',
          author_name: '%an',
          author_email: '%ae',
          committer_name: '%cn',
          committer_email: '%ce'
        }
      })

      const analyzedCommits = []

      for (const commit of commits.all) {
        try {
          // Get detailed commit information
          const commitDetails = await this.getCommitDetails(git, commit.hash)
          
          const analyzedCommit = {
            hash: commit.hash,
            author: commit.author_name,
            email: commit.author_email,
            date: new Date(commit.date),
            message: commit.message,
            body: commit.body || '',
            filesChanged: commitDetails.filesChanged,
            additions: commitDetails.additions,
            deletions: commitDetails.deletions,
            diff: commitDetails.diff,
            suspiciousPatterns: this.detectSuspiciousPatterns(commit, commitDetails),
            riskScore: 0 // Will be calculated by AI service
          }

          analyzedCommits.push(analyzedCommit)
          
          log.info('📝 Commit analyzed', { 
            hash: commit.hash.substring(0, 8),
            author: commit.author_name,
            filesChanged: commitDetails.filesChanged.length
          })
        } catch (error) {
          log.warn('⚠️ Failed to analyze commit', { hash: commit.hash, error: error.message })
        }
      }

      log.info('✅ Commit analysis completed', { 
        totalCommits: analyzedCommits.length,
        suspiciousCommits: analyzedCommits.filter(c => c.suspiciousPatterns.length > 0).length
      })

      return analyzedCommits
    } catch (error) {
      log.error('❌ Commit analysis failed', error)
      throw error
    }
  }

  async getCommitDetails(git, commitHash) {
    try {
      // Get file changes
      const diffSummary = await git.diffSummary([`${commitHash}^`, commitHash])
      
      // Get detailed diff
      const diff = await git.diff([`${commitHash}^`, commitHash])
      
      return {
        filesChanged: diffSummary.files.map(file => file.file),
        additions: diffSummary.insertions,
        deletions: diffSummary.deletions,
        diff: diff.substring(0, 10000) // Limit diff size for AI analysis
      }
    } catch (error) {
      log.warn('⚠️ Failed to get commit details', { commitHash, error: error.message })
      return {
        filesChanged: [],
        additions: 0,
        deletions: 0,
        diff: ''
      }
    }
  }

  detectSuspiciousPatterns(commit, details) {
    const patterns = []
    const message = commit.message.toLowerCase()
    const diff = details.diff.toLowerCase()
    
    // Suspicious commit message patterns
    const suspiciousMessages = [
      'backdoor', 'malware', 'virus', 'trojan', 'exploit',
      'hack', 'crack', 'bypass', 'disable security',
      'remove validation', 'skip check', 'temporary fix'
    ]
    
    for (const pattern of suspiciousMessages) {
      if (message.includes(pattern)) {
        patterns.push(`Suspicious commit message: contains "${pattern}"`)
      }
    }

    // Suspicious code patterns in diff
    const suspiciousCode = [
      'eval(', 'exec(', 'system(', 'shell_exec',
      'base64_decode', 'atob(', 'btoa(',
      'crypto', 'mining', 'bitcoin', 'ethereum',
      'wget', 'curl', 'download', 'fetch(',
      'setuid', 'chmod 777', 'sudo',
      'password', 'secret', 'token', 'api_key'
    ]

    for (const pattern of suspiciousCode) {
      if (diff.includes(pattern)) {
        patterns.push(`Suspicious code pattern: contains "${pattern}"`)
      }
    }

    // Large file additions (potential binary injection)
    if (details.additions > 1000 && details.deletions < 100) {
      patterns.push('Large addition with minimal deletions (potential injection)')
    }

    // Many files changed in single commit
    if (details.filesChanged.length > 20) {
      patterns.push('Unusually large number of files changed')
    }

    // Suspicious file types
    const suspiciousFiles = details.filesChanged.filter(file => {
      const ext = path.extname(file).toLowerCase()
      return ['.exe', '.dll', '.so', '.dylib', '.bin', '.dat'].includes(ext)
    })

    if (suspiciousFiles.length > 0) {
      patterns.push(`Suspicious file types: ${suspiciousFiles.join(', ')}`)
    }

    return patterns
  }

  async getRepositoryMetadata(repoInfo) {
    try {
      if (!this.githubToken) {
        log.warn('⚠️ No GitHub token provided, skipping API metadata fetch')
        return {}
      }

      const apiUrl = `https://api.github.com/repos/${repoInfo.fullName}`
      
      log.info('📊 Fetching repository metadata from GitHub API...', { repo: repoInfo.fullName })

      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      })

      const metadata = {
        stars: response.data.stargazers_count,
        forks: response.data.forks_count,
        watchers: response.data.watchers_count,
        issues: response.data.open_issues_count,
        language: response.data.language,
        size: response.data.size,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
        pushedAt: response.data.pushed_at,
        defaultBranch: response.data.default_branch,
        description: response.data.description,
        topics: response.data.topics || [],
        license: response.data.license?.name || null,
        hasWiki: response.data.has_wiki,
        hasPages: response.data.has_pages,
        archived: response.data.archived,
        disabled: response.data.disabled
      }

      log.info('✅ Repository metadata fetched', { 
        stars: metadata.stars,
        language: metadata.language,
        size: metadata.size
      })

      return metadata
    } catch (error) {
      log.warn('⚠️ Failed to fetch repository metadata', error.message)
      return {}
    }
  }

  async getContributors(repoInfo) {
    try {
      if (!this.githubToken) {
        return []
      }

      const apiUrl = `https://api.github.com/repos/${repoInfo.fullName}/contributors`
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        params: {
          per_page: 100
        },
        timeout: 10000
      })

      const contributors = response.data.map(contributor => ({
        login: contributor.login,
        contributions: contributor.contributions,
        type: contributor.type,
        siteAdmin: contributor.site_admin
      }))

      log.info('👥 Contributors fetched', { count: contributors.length })
      return contributors
    } catch (error) {
      log.warn('⚠️ Failed to fetch contributors', error.message)
      return []
    }
  }

  async analyzeDependencies(localPath, projectType) {
    try {
      log.info('📦 Analyzing dependencies...', { localPath, projectType })

      let dependencies = []

      if (projectType === 'nodejs') {
        dependencies = await this.analyzeNodeJSDependencies(localPath)
      } else if (projectType === 'python') {
        dependencies = await this.analyzePythonDependencies(localPath)
      }

      log.info('✅ Dependencies analyzed', { count: dependencies.length })
      return dependencies
    } catch (error) {
      log.error('❌ Dependency analysis failed', error)
      return []
    }
  }

  async analyzeNodeJSDependencies(localPath) {
    try {
      const packageJsonPath = path.join(localPath, 'package.json')
      
      if (!await fs.pathExists(packageJsonPath)) {
        log.warn('⚠️ No package.json found')
        return []
      }

      const packageJson = await fs.readJson(packageJsonPath)
      const dependencies = []

      // Analyze production dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          dependencies.push({
            name,
            version,
            type: 'npm',
            category: 'production',
            registry: 'npmjs.org'
          })
        }
      }

      // Analyze dev dependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          dependencies.push({
            name,
            version,
            type: 'npm',
            category: 'development',
            registry: 'npmjs.org'
          })
        }
      }

      return dependencies
    } catch (error) {
      log.error('❌ Node.js dependency analysis failed', error)
      return []
    }
  }

  async analyzePythonDependencies(localPath) {
    try {
      const dependencies = []
      
      // Check requirements.txt
      const requirementsPath = path.join(localPath, 'requirements.txt')
      if (await fs.pathExists(requirementsPath)) {
        const content = await fs.readFile(requirementsPath, 'utf8')
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'))
        
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9\-_]+)([>=<~!]+)?(.+)?/)
          if (match) {
            dependencies.push({
              name: match[1],
              version: match[3] || 'latest',
              type: 'pip',
              category: 'production',
              registry: 'pypi.org'
            })
          }
        }
      }

      // Check setup.py
      const setupPyPath = path.join(localPath, 'setup.py')
      if (await fs.pathExists(setupPyPath)) {
        // Basic parsing of setup.py (could be enhanced)
        const content = await fs.readFile(setupPyPath, 'utf8')
        const installRequiresMatch = content.match(/install_requires\s*=\s*\[(.*?)\]/s)
        if (installRequiresMatch) {
          const deps = installRequiresMatch[1].match(/'([^']+)'/g) || []
          for (const dep of deps) {
            const cleanDep = dep.replace(/'/g, '')
            const match = cleanDep.match(/^([a-zA-Z0-9\-_]+)([>=<~!]+)?(.+)?/)
            if (match) {
              dependencies.push({
                name: match[1],
                version: match[3] || 'latest',
                type: 'pip',
                category: 'production',
                registry: 'pypi.org'
              })
            }
          }
        }
      }

      return dependencies
    } catch (error) {
      log.error('❌ Python dependency analysis failed', error)
      return []
    }
  }

  async cleanup(jobId) {
    try {
      const localPath = path.join(this.workspaceDir, jobId)
      await fs.remove(localPath)
      log.info('🧹 Workspace cleaned up', { localPath })
    } catch (error) {
      log.warn('⚠️ Cleanup failed', error)
    }
  }
}

// Create singleton instance
const githubService = new GitHubService()

export default githubService
export { GitHubService }