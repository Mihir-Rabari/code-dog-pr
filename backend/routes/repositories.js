import express from 'express'
import Repository from '../models/Repository.js'
import User from '../models/User.js'
import Job from '../models/Job.js'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'

const router = express.Router()

const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [REPOS-API-INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [REPOS-API-ERROR] ${message}`, error ? error.stack || error : '')
  }
}

// Helper function to parse GitHub URL
function parseGitHubUrl(url) {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
    /github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', ''),
        fullName: `${match[1]}/${match[2].replace('.git', '')}`
      }
    }
  }
  throw new Error('Invalid GitHub repository URL format')
}

// Get user repositories
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { 
      page = 1, 
      limit = 12, 
      sortBy = 'lastActivity', 
      order = 'desc',
      category,
      riskLevel,
      search 
    } = req.query

    // Build query
    const query = { userId, isActive: true }
    if (category && category !== 'all') {
      query.category = category
    }
    if (riskLevel && riskLevel !== 'all') {
      query['latestAnalysis.riskLevel'] = riskLevel
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }

    // Build sort
    const sortOptions = {}
    if (sortBy === 'risk') {
      sortOptions['latestAnalysis.riskScore'] = order === 'desc' ? -1 : 1
    } else if (sortBy === 'name') {
      sortOptions.name = order === 'desc' ? -1 : 1
    } else {
      sortOptions.lastActivity = order === 'desc' ? -1 : 1
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [repositories, total] = await Promise.all([
      Repository.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Repository.countDocuments(query)
    ])

    res.json({
      repositories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    log.error('Failed to get user repositories', error)
    res.status(500).json({ error: 'Failed to get repositories' })
  }
})

// Add new repository
router.post('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { repoUrl, projectType, category = 'production', tags = [] } = req.body

    // Validate user exists
    const user = await User.findOne({ userId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check analysis limit
    if (user.repositories.length >= user.subscription.limits.repositories) {
      return res.status(403).json({ 
        error: 'Repository limit reached',
        limit: user.subscription.limits.repositories,
        used: user.repositories.length
      })
    }

    // Parse GitHub URL
    const { owner, repo, fullName } = parseGitHubUrl(repoUrl)

    // Check if repository already exists
    const existingRepo = await Repository.findOne({ userId, fullName })
    if (existingRepo) {
      return res.status(409).json({ error: 'Repository already exists' })
    }

    // Fetch repository metadata from GitHub
    let repoMetadata = {}
    try {
      const githubToken = user.integrations?.github?.token
      const headers = githubToken ? { Authorization: `token ${githubToken}` } : {}
      const response = await axios.get(`https://api.github.com/repos/${fullName}`, { headers })
      repoMetadata = response.data
    } catch (error) {
      log.error('Failed to fetch GitHub metadata', error.message)
    }

    // Create repository
    const repository = new Repository({
      repositoryId: uuidv4(),
      userId,
      name: repo,
      fullName,
      owner,
      url: repoUrl,
      description: repoMetadata.description,
      config: {
        projectType,
        autoAnalysis: false,
        analysisFrequency: 'weekly',
        alertThreshold: 'medium'
      },
      category,
      tags,
      metadata: {
        language: repoMetadata.language,
        stars: repoMetadata.stargazers_count || 0,
        forks: repoMetadata.forks_count || 0,
        size: repoMetadata.size || 0,
        defaultBranch: repoMetadata.default_branch || 'main',
        isPrivate: repoMetadata.private || false,
        topics: repoMetadata.topics || [],
        license: repoMetadata.license?.name,
        lastPush: repoMetadata.pushed_at ? new Date(repoMetadata.pushed_at) : null,
        createdAt: repoMetadata.created_at ? new Date(repoMetadata.created_at) : null,
        updatedAt: repoMetadata.updated_at ? new Date(repoMetadata.updated_at) : null
      }
    })

    await repository.save()
    log.info('Repository added', { repositoryId: repository.repositoryId, fullName, userId })

    res.status(201).json({
      message: 'Repository added successfully',
      repository
    })
  } catch (error) {
    log.error('Failed to add repository', error)
    res.status(500).json({ error: 'Failed to add repository' })
  }
})

// Get repository details
router.get('/:repositoryId', async (req, res) => {
  try {
    const { repositoryId } = req.params
    const repository = await Repository.findOne({ repositoryId })
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' })
    }

    // Get recent jobs for this repository
    const recentJobs = await Job.find({ repoUrl: repository.url })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('jobId status riskScore riskLevel startTime endTime')

    res.json({
      repository,
      recentJobs
    })
  } catch (error) {
    log.error('Failed to get repository details', error)
    res.status(500).json({ error: 'Failed to get repository details' })
  }
})

// Update repository configuration
router.put('/:repositoryId/config', async (req, res) => {
  try {
    const { repositoryId } = req.params
    const { config, category, tags, priority } = req.body

    const repository = await Repository.findOne({ repositoryId })
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' })
    }

    if (config) repository.config = { ...repository.config, ...config }
    if (category) repository.category = category
    if (tags) repository.tags = tags
    if (priority) repository.priority = priority

    repository.lastActivity = new Date()
    await repository.save()

    log.info('Repository configuration updated', { repositoryId })

    res.json({
      message: 'Repository configuration updated',
      repository
    })
  } catch (error) {
    log.error('Failed to update repository configuration', error)
    res.status(500).json({ error: 'Failed to update repository configuration' })
  }
})

// Archive repository
router.put('/:repositoryId/archive', async (req, res) => {
  try {
    const { repositoryId } = req.params
    const repository = await Repository.findOne({ repositoryId })
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' })
    }

    repository.isArchived = true
    repository.isActive = false
    repository.lastActivity = new Date()
    await repository.save()

    log.info('Repository archived', { repositoryId })
    res.json({ message: 'Repository archived successfully' })
  } catch (error) {
    log.error('Failed to archive repository', error)
    res.status(500).json({ error: 'Failed to archive repository' })
  }
})

// Delete repository
router.delete('/:repositoryId', async (req, res) => {
  try {
    const { repositoryId } = req.params
    const repository = await Repository.findOneAndDelete({ repositoryId })
    
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' })
    }

    log.info('Repository deleted', { repositoryId })
    res.json({ message: 'Repository deleted successfully' })
  } catch (error) {
    log.error('Failed to delete repository', error)
    res.status(500).json({ error: 'Failed to delete repository' })
  }
})

// Get repository analysis history
router.get('/:repositoryId/history', async (req, res) => {
  try {
    const { repositoryId } = req.params
    const { limit = 10 } = req.query

    const repository = await Repository.findOne({ repositoryId })
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' })
    }

    res.json({
      history: repository.analysisHistory.slice(0, parseInt(limit))
    })
  } catch (error) {
    log.error('Failed to get repository history', error)
    res.status(500).json({ error: 'Failed to get repository history' })
  }
})

export default router