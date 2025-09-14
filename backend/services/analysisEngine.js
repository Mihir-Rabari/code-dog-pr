import Job from '../models/Job.js'
import githubService from './githubService.js'
import aiService from './aiService.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Sanitizes confidence value to ensure it's between 0 and 1
 * Handles different input formats:
 * - Number > 1: assumes percentage (e.g., 50 -> 0.5)
 * - Number between 0-1: uses as is
 * - String with %: parses percentage (e.g., '50%' -> 0.5)
 * - Invalid/NaN: returns 0
 */
function sanitizeConfidence(value) {
  if (value === null || value === undefined) return 0;
  
  // Handle string values (e.g., '50%' or '0.5')
  if (typeof value === 'string') {
    if (value.endsWith('%')) {
      // Parse percentage string (e.g., '50%' -> 0.5)
      const percentage = parseFloat(value) / 100;
      return Math.min(Math.max(percentage, 0), 1) || 0;
    }
    // Parse numeric string
    value = parseFloat(value);
  }

  // Handle numeric values
  if (typeof value === 'number') {
    if (value > 1) {
      // Assume it's a percentage (e.g., 50 -> 0.5)
      return Math.min(value / 100, 1);
    }
    // Already in 0-1 range
    return Math.max(0, Math.min(value, 1));
  }

  // Fallback for any other type
  return 0;
}

const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [ANALYSIS-ENGINE-INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [ANALYSIS-ENGINE-ERROR] ${message}`, error ? error.stack || error : '')
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [ANALYSIS-ENGINE-WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

class AnalysisEngine {
  constructor(io) {
    this.io = io
    this.activeJobs = new Map()
  }

  async startAnalysis(jobId, repoUrl, projectType) {
    try {
      log.info('🚀 Starting comprehensive analysis...', { jobId, repoUrl, projectType })

      // Create job in database
      const job = new Job({
        jobId,
        repoUrl,
        projectType,
        status: 'pending'
      })
      await job.save()

      // Store active job reference
      this.activeJobs.set(jobId, job)

      // Start analysis in background
      this.runAnalysis(job).catch(error => {
        log.error('💥 Analysis failed', { jobId, error })
        this.handleAnalysisError(job, error)
      })

      return job
    } catch (error) {
      log.error('❌ Failed to start analysis', error)
      throw error
    }
  }

  async runAnalysis(job) {
    const startTime = Date.now()
    
    try {
      await this.updateJobStatus(job, 'cloning', 5)
      await this.emitLog(job.jobId, 'info', 'Starting repository analysis...', 'system')

      // Phase 1: Clone Repository
      const repoInfo = await this.cloneRepository(job)
      await this.updateJobStatus(job, 'cloning', 15)

      // Phase 2: Analyze Commits
      await this.emitLog(job.jobId, 'info', 'Analyzing commit history...', 'analysis')
      const commits = await this.analyzeCommits(job, repoInfo)
      await this.updateJobStatus(job, 'analyzing', 40)

      // Phase 3: Analyze Dependencies
      await this.emitLog(job.jobId, 'info', 'Analyzing dependencies...', 'analysis')
      const dependencies = await this.analyzeDependencies(job, repoInfo)
      await this.updateJobStatus(job, 'analyzing', 60)

      // Phase 4: AI Analysis
      await this.emitLog(job.jobId, 'info', 'Running AI-powered threat analysis...', 'ai')
      await this.runAIAnalysis(job)
      await this.updateJobStatus(job, 'analyzing', 80)

      // Phase 5: Calculate Risk Score
      await this.emitLog(job.jobId, 'info', 'Calculating risk score...', 'analysis')
      await this.calculateRiskScore(job)
      await this.updateJobStatus(job, 'analyzing', 90)

      // Phase 6: Generate Final Report
      await this.emitLog(job.jobId, 'info', 'Generating final assessment...', 'ai')
      await this.generateFinalAssessment(job)

      // Complete analysis
      job.status = 'completed'
      job.endTime = new Date()
      job.progress = 100
      job.buildInfo = {
        success: true,
        duration: Date.now() - startTime,
        errors: [],
        warnings: []
      }
      await job.save()

      await this.emitLog(job.jobId, 'info', `Analysis completed in ${Math.round((Date.now() - startTime) / 1000)}s`, 'system')
      
      // Emit completion event
      this.io.to(`job-${job.jobId}`).emit('done', {
        riskScore: job.riskScore,
        riskLevel: job.riskLevel,
        summary: {
          totalAlerts: job.totalAlerts,
          criticalAlerts: job.criticalAlerts,
          dependencyIssues: job.dependencies.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').length,
          commitIssues: job.commits.filter(c => c.riskScore > 70).length
        },
        alerts: job.alerts,
        aiSummary: job.aiSummary
      })

      // Cleanup
      await githubService.cleanup(job.jobId)
      this.activeJobs.delete(job.jobId)

      log.info('✅ Analysis completed successfully', { 
        jobId: job.jobId, 
        duration: Date.now() - startTime,
        riskScore: job.riskScore
      })

    } catch (error) {
      await this.handleAnalysisError(job, error)
    }
  }

  async cloneRepository(job) {
    try {
      await this.emitLog(job.jobId, 'info', `Cloning repository: ${job.repoUrl}`, 'system')
      
      const repoInfo = await githubService.cloneRepository(job.repoUrl, job.jobId)
      
      // Get repository metadata
      const metadata = await githubService.getRepositoryMetadata(repoInfo)
      const contributors = await githubService.getContributors(repoInfo)

      // Update job with repository information
      job.repoInfo = {
        name: repoInfo.repo,
        owner: repoInfo.owner,
        branch: repoInfo.currentBranch,
        contributors: contributors.map(c => c.login),
        ...metadata
      }
      await job.save()

      await this.emitLog(job.jobId, 'info', `Repository cloned successfully: ${repoInfo.fullName}`, 'system')
      
      return repoInfo
    } catch (error) {
      await this.emitLog(job.jobId, 'error', `Failed to clone repository: ${error.message}`, 'system')
      throw error
    }
  }

  async analyzeCommits(job, repoInfo) {
    try {
      const commits = await githubService.analyzeCommits(repoInfo.localPath)
      
      await this.emitLog(job.jobId, 'info', `Found ${commits.length} commits to analyze`, 'analysis')

      // Process commits in batches for better performance
      const batchSize = 5
      for (let i = 0; i < commits.length; i += batchSize) {
        const batch = commits.slice(i, i + batchSize)
        
        for (const commit of batch) {
          try {
            // Run AI analysis on commit
            const aiAnalysis = await aiService.analyzeCommit(commit)
            
            commit.riskScore = aiAnalysis.riskScore || 0
            commit.aiAnalysis = {
              summary: aiAnalysis.summary,
              threats: aiAnalysis.threats || [],
              confidence: sanitizeConfidence(aiAnalysis.confidence)
            }

            // Add to job
            job.commits.push(commit)

            // Generate alerts for high-risk commits
            if (commit.riskScore > 70) {
              await job.addAlert({
                severity: commit.riskScore > 90 ? 'critical' : 'high',
                type: 'commit',
                title: `High-risk commit detected: ${commit.hash.substring(0, 8)}`,
                description: `Commit by ${commit.author} has risk score of ${commit.riskScore}`,
                details: {
                  commitHash: commit.hash,
                  author: commit.author,
                  message: commit.message,
                  threats: aiAnalysis.threats
                },
                aiConfidence: aiAnalysis.confidence
              })

              await this.emitAlert(job.jobId, {
                severity: commit.riskScore > 90 ? 'critical' : 'high',
                type: 'commit',
                title: `High-risk commit: ${commit.hash.substring(0, 8)}`,
                description: aiAnalysis.summary || 'Suspicious patterns detected'
              })
            }

            await this.emitLog(job.jobId, 'info', 
              `Analyzed commit ${commit.hash.substring(0, 8)} - Risk: ${commit.riskScore}`, 
              'analysis'
            )

          } catch (error) {
            log.warn('⚠️ Failed to analyze commit', { hash: commit.hash, error: error.message })
          }
        }

        // Update progress
        const progress = 15 + Math.round((i / commits.length) * 25)
        await this.updateJobStatus(job, 'analyzing', progress)
      }

      await job.save()
      return commits
    } catch (error) {
      await this.emitLog(job.jobId, 'error', `Commit analysis failed: ${error.message}`, 'analysis')
      throw error
    }
  }

  async analyzeDependencies(job, repoInfo) {
    try {
      const dependencies = await githubService.analyzeDependencies(repoInfo.localPath, job.projectType)
      
      await this.emitLog(job.jobId, 'info', `Found ${dependencies.length} dependencies to analyze`, 'analysis')

      for (const dependency of dependencies) {
        try {
          // Run AI analysis on dependency
          const aiAnalysis = await aiService.analyzeDependency(dependency)
          
          const analyzedDependency = {
            ...dependency,
            riskLevel: aiAnalysis.riskLevel || 'safe',
            vulnerabilities: aiAnalysis.threats || [],
            typosquatting: aiAnalysis.typosquatting || {
              isTyposquat: false,
              similarPackages: [],
              confidence: 0
            },
            aiAnalysis: {
              summary: aiAnalysis.summary,
              threats: aiAnalysis.threats || [],
              confidence: sanitizeConfidence(aiAnalysis.confidence)
            }
          }

          job.dependencies.push(analyzedDependency)

          // Generate alerts for risky dependencies
          if (analyzedDependency.riskLevel === 'high' || analyzedDependency.riskLevel === 'critical') {
            await job.addAlert({
              severity: analyzedDependency.riskLevel === 'critical' ? 'critical' : 'high',
              type: 'dependency',
              title: `Risky dependency detected: ${dependency.name}`,
              description: aiAnalysis.summary || `${dependency.name} has been flagged as ${analyzedDependency.riskLevel} risk`,
              details: {
                packageName: dependency.name,
                version: dependency.version,
                riskLevel: analyzedDependency.riskLevel,
                threats: aiAnalysis.threats,
                typosquatting: analyzedDependency.typosquatting
              },
              aiConfidence: aiAnalysis.confidence
            })

            await this.emitAlert(job.jobId, {
              severity: analyzedDependency.riskLevel === 'critical' ? 'critical' : 'high',
              type: 'dependency',
              title: `Risky dependency: ${dependency.name}`,
              description: aiAnalysis.summary || `Flagged as ${analyzedDependency.riskLevel} risk`
            })
          }

          // Check for typosquatting
          if (analyzedDependency.typosquatting.isTyposquat) {
            await job.addAlert({
              severity: 'high',
              type: 'dependency',
              title: `Potential typosquatting: ${dependency.name}`,
              description: `Package may be impersonating popular packages`,
              details: {
                packageName: dependency.name,
                similarPackages: analyzedDependency.typosquatting.similarPackages,
                confidence: analyzedDependency.typosquatting.confidence
              },
              aiConfidence: analyzedDependency.typosquatting.confidence
            })

            await this.emitAlert(job.jobId, {
              severity: 'high',
              type: 'dependency',
              title: `Typosquatting detected: ${dependency.name}`,
              description: `Similar to: ${analyzedDependency.typosquatting.similarPackages.join(', ')}`
            })
          }

          await this.emitLog(job.jobId, 'info', 
            `Analyzed dependency ${dependency.name} - Risk: ${analyzedDependency.riskLevel}`, 
            'analysis'
          )

        } catch (error) {
          log.warn('⚠️ Failed to analyze dependency', { name: dependency.name, error: error.message })
        }
      }

      await job.save()
      return dependencies
    } catch (error) {
      await this.emitLog(job.jobId, 'error', `Dependency analysis failed: ${error.message}`, 'analysis')
      throw error
    }
  }

  async runAIAnalysis(job) {
    try {
      await this.emitLog(job.jobId, 'info', 'Running comprehensive AI analysis...', 'ai')

      // Generate overall assessment
      const assessment = await aiService.generateOverallAssessment({
        repoUrl: job.repoUrl,
        projectType: job.projectType,
        commits: job.commits,
        dependencies: job.dependencies,
        alerts: job.alerts
      })

      job.aiSummary = assessment
      await job.save()

      await this.emitLog(job.jobId, 'info', `AI assessment completed - Threat level: ${assessment.overallThreat}`, 'ai')

    } catch (error) {
      await this.emitLog(job.jobId, 'warn', `AI analysis failed: ${error.message}`, 'ai')
      // Continue without AI analysis
    }
  }

  async calculateRiskScore(job) {
    try {
      let totalScore = 0
      let factors = 0

      // Commit risk factor (40% weight)
      if (job.commits.length > 0) {
        const avgCommitRisk = job.commits.reduce((sum, c) => sum + c.riskScore, 0) / job.commits.length
        totalScore += avgCommitRisk * 0.4
        factors += 0.4
      }

      // Dependency risk factor (35% weight)
      if (job.dependencies.length > 0) {
        const riskLevelScores = { safe: 0, low: 25, medium: 50, high: 75, critical: 100 }
        const avgDependencyRisk = job.dependencies.reduce((sum, d) => sum + riskLevelScores[d.riskLevel], 0) / job.dependencies.length
        totalScore += avgDependencyRisk * 0.35
        factors += 0.35
      }

      // Alert severity factor (25% weight)
      if (job.alerts.length > 0) {
        const severityScores = { low: 25, medium: 50, high: 75, critical: 100 }
        const avgAlertSeverity = job.alerts.reduce((sum, a) => sum + severityScores[a.severity], 0) / job.alerts.length
        totalScore += avgAlertSeverity * 0.25
        factors += 0.25
      }

      // Calculate final score
      const riskScore = factors > 0 ? Math.round(totalScore / factors) : 0
      
      // Determine risk level
      let riskLevel = 'low'
      if (riskScore >= 75) riskLevel = 'critical'
      else if (riskScore >= 50) riskLevel = 'high'
      else if (riskScore >= 25) riskLevel = 'medium'

      job.riskScore = riskScore
      job.riskLevel = riskLevel
      await job.save()

      await this.emitLog(job.jobId, 'info', `Risk score calculated: ${riskScore}/100 (${riskLevel})`, 'analysis')

    } catch (error) {
      await this.emitLog(job.jobId, 'error', `Risk calculation failed: ${error.message}`, 'analysis')
      job.riskScore = 50 // Default to medium risk
      job.riskLevel = 'medium'
      await job.save()
    }
  }

  async generateFinalAssessment(job) {
    try {
      // Calculate comprehensive metrics
      const metrics = this.calculateComprehensiveMetrics(job)
      
      // Update repository info with final stats
      job.repoInfo.totalCommits = job.commits.length
      job.repoInfo.lastCommit = job.commits[0]?.hash || null
      job.repoInfo.metrics = metrics

      // Generate detailed summary report
      const summaryReport = this.generateSummaryReport(job, metrics)
      job.summaryReport = summaryReport

      await job.save()

      await this.emitLog(job.jobId, 'info', `Final assessment completed - Risk Score: ${job.riskScore}/100`, 'system')
      await this.emitLog(job.jobId, 'info', `Analysis Summary: ${metrics.totalIssues} issues found, ${metrics.criticalIssues} critical`, 'system')

    } catch (error) {
      await this.emitLog(job.jobId, 'warn', `Final assessment generation failed: ${error.message}`, 'system')
    }
  }

  calculateComprehensiveMetrics(job) {
    const commits = job.commits || []
    const dependencies = job.dependencies || []
    const alerts = job.alerts || []

    // Commit metrics
    const highRiskCommits = commits.filter(c => c.riskScore > 70)
    const suspiciousCommits = commits.filter(c => c.suspiciousPatterns && c.suspiciousPatterns.length > 0)
    const avgCommitRisk = commits.length > 0 ? commits.reduce((sum, c) => sum + (c.riskScore || 0), 0) / commits.length : 0

    // Dependency metrics
    const criticalDeps = dependencies.filter(d => d.riskLevel === 'critical')
    const highRiskDeps = dependencies.filter(d => d.riskLevel === 'high')
    const typosquatDeps = dependencies.filter(d => d.typosquatting && d.typosquatting.isTyposquat)
    const vulnerableDeps = dependencies.filter(d => d.vulnerabilities && d.vulnerabilities.length > 0)

    // Alert metrics
    const criticalAlerts = alerts.filter(a => a.severity === 'critical')
    const highAlerts = alerts.filter(a => a.severity === 'high')
    const mediumAlerts = alerts.filter(a => a.severity === 'medium')
    const lowAlerts = alerts.filter(a => a.severity === 'low')

    // Overall metrics
    const totalIssues = alerts.length
    const criticalIssues = criticalAlerts.length
    const securityScore = Math.max(0, 100 - (job.riskScore || 0))

    return {
      // Commit metrics
      totalCommits: commits.length,
      highRiskCommits: highRiskCommits.length,
      suspiciousCommits: suspiciousCommits.length,
      avgCommitRisk: Math.round(avgCommitRisk),

      // Dependency metrics
      totalDependencies: dependencies.length,
      criticalDependencies: criticalDeps.length,
      highRiskDependencies: highRiskDeps.length,
      typosquattingDependencies: typosquatDeps.length,
      vulnerableDependencies: vulnerableDeps.length,

      // Alert metrics
      totalAlerts: alerts.length,
      criticalAlerts: criticalAlerts.length,
      highAlerts: highAlerts.length,
      mediumAlerts: mediumAlerts.length,
      lowAlerts: lowAlerts.length,

      // Overall metrics
      totalIssues,
      criticalIssues,
      securityScore,
      riskScore: job.riskScore || 0,
      riskLevel: job.riskLevel || 'unknown'
    }
  }

  generateSummaryReport(job, metrics) {
    const report = {
      executiveSummary: this.generateExecutiveSummary(job, metrics),
      keyFindings: this.generateKeyFindings(job, metrics),
      riskBreakdown: this.generateRiskBreakdown(job, metrics),
      recommendations: this.generateRecommendations(job, metrics),
      technicalDetails: {
        analysisDate: new Date().toISOString(),
        analysisDuration: job.endTime ? new Date(job.endTime).getTime() - new Date(job.startTime).getTime() : null,
        toolsUsed: ['Static Analysis', 'AI-Powered Threat Detection', 'Dependency Scanning', 'Commit Analysis'],
        coverage: {
          commits: metrics.totalCommits,
          dependencies: metrics.totalDependencies,
          filesAnalyzed: job.commits.reduce((sum, c) => sum + (c.filesChanged?.length || 0), 0)
        }
      }
    }

    return report
  }

  generateExecutiveSummary(job, metrics) {
    const riskLevel = job.riskLevel || 'unknown'
    const riskScore = job.riskScore || 0
    
    let summary = `Security analysis of ${job.repoUrl} completed with a risk score of ${riskScore}/100 (${riskLevel} risk). `
    
    if (metrics.criticalIssues > 0) {
      summary += `${metrics.criticalIssues} critical security issues were identified requiring immediate attention. `
    }
    
    if (metrics.totalIssues === 0) {
      summary += 'No significant security issues were detected in this analysis.'
    } else {
      summary += `A total of ${metrics.totalIssues} security concerns were found across commits and dependencies.`
    }

    return summary
  }

  generateKeyFindings(job, metrics) {
    const findings = []

    if (metrics.criticalAlerts > 0) {
      findings.push(`${metrics.criticalAlerts} critical security alerts requiring immediate action`)
    }

    if (metrics.highRiskCommits > 0) {
      findings.push(`${metrics.highRiskCommits} high-risk commits with suspicious patterns`)
    }

    if (metrics.criticalDependencies > 0) {
      findings.push(`${metrics.criticalDependencies} critical dependency vulnerabilities`)
    }

    if (metrics.typosquattingDependencies > 0) {
      findings.push(`${metrics.typosquattingDependencies} potential typosquatting attacks detected`)
    }

    if (metrics.vulnerableDependencies > 0) {
      findings.push(`${metrics.vulnerableDependencies} dependencies with known vulnerabilities`)
    }

    if (findings.length === 0) {
      findings.push('No critical security issues identified')
      findings.push('Repository follows security best practices')
    }

    return findings
  }

  generateRiskBreakdown(job, metrics) {
    return {
      overall: {
        score: metrics.riskScore,
        level: metrics.riskLevel,
        securityScore: metrics.securityScore
      },
      commits: {
        total: metrics.totalCommits,
        highRisk: metrics.highRiskCommits,
        suspicious: metrics.suspiciousCommits,
        averageRisk: metrics.avgCommitRisk
      },
      dependencies: {
        total: metrics.totalDependencies,
        critical: metrics.criticalDependencies,
        high: metrics.highRiskDependencies,
        vulnerable: metrics.vulnerableDependencies,
        typosquatting: metrics.typosquattingDependencies
      },
      alerts: {
        total: metrics.totalAlerts,
        critical: metrics.criticalAlerts,
        high: metrics.highAlerts,
        medium: metrics.mediumAlerts,
        low: metrics.lowAlerts
      }
    }
  }

  generateRecommendations(job, metrics) {
    const recommendations = []

    if (metrics.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Address critical security issues immediately',
        description: 'Review and remediate all critical alerts before deployment'
      })
    }

    if (metrics.vulnerableDependencies > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Update vulnerable dependencies',
        description: 'Upgrade dependencies to secure versions and implement dependency scanning'
      })
    }

    if (metrics.typosquattingDependencies > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Review suspicious dependencies',
        description: 'Verify legitimacy of flagged packages and consider alternatives'
      })
    }

    if (metrics.highRiskCommits > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review high-risk commits',
        description: 'Conduct manual review of flagged commits for security issues'
      })
    }

    recommendations.push({
      priority: 'low',
      action: 'Implement continuous security monitoring',
      description: 'Set up automated security scanning in CI/CD pipeline'
    })

    recommendations.push({
      priority: 'low',
      action: 'Security training',
      description: 'Provide security awareness training for development team'
    })

    return recommendations
  }

  async updateJobStatus(job, status, progress) {
    try {
      // Update job status and progress
      job.status = status
      job.progress = progress
      
      // Add a log entry for status changes
      await job.addLog('info', `Status updated: ${status} (${progress}%)`, 'system')
      
      // Save to database
      await job.save()

      // Emit real-time progress update
      this.io.to(`job-${job.jobId}`).emit('progress', {
        percentage: progress,
        stage: status
      })
      
      log.info('📊 Job status updated', { 
        jobId: job.jobId, 
        status, 
        progress: `${progress}%` 
      })
      
    } catch (error) {
      log.error('❌ Failed to update job status', { 
        jobId: job.jobId, 
        status, 
        progress, 
        error: error.message 
      })
      throw error
    }
  }

  async emitLog(jobId, level, message, source) {
    try {
      // Get the job from database or active jobs
      let job = this.activeJobs.get(jobId)
      if (!job) {
        job = await Job.findOne({ jobId })
      }
      
      if (job) {
        // Store log persistently in database
        await job.addLog(level, message, source)
      }
      
      // Emit log via WebSocket for real-time updates
      this.io.to(`job-${jobId}`).emit('log', {
        timestamp: Date.now(),
        level,
        message,
        source
      })
    } catch (error) {
      log.error('❌ Failed to store log', { jobId, level, message, error: error.message })
      
      // Still emit via WebSocket even if database storage fails
      this.io.to(`job-${jobId}`).emit('log', {
        timestamp: Date.now(),
        level,
        message,
        source
      })
    }
  }

  async emitAlert(jobId, alert) {
    try {
      // Get the job from database or active jobs
      let job = this.activeJobs.get(jobId)
      if (!job) {
        job = await Job.findOne({ jobId })
      }
      
      if (job) {
        // Store alert persistently in database using the Job model's addAlert method
        await job.addAlert({
          id: uuidv4(),
          timestamp: new Date(),
          ...alert
        })
      }
      
      // Emit alert via WebSocket for real-time updates
      this.io.to(`job-${jobId}`).emit('alert', {
        id: uuidv4(),
        timestamp: Date.now(),
        ...alert
      })
    } catch (error) {
      log.error('❌ Failed to store alert', { jobId, alert, error: error.message })
      
      // Still emit via WebSocket even if database storage fails
      this.io.to(`job-${jobId}`).emit('alert', {
        id: uuidv4(),
        timestamp: Date.now(),
        ...alert
      })
    }
  }

  async handleAnalysisError(job, error) {
    try {
      job.status = 'failed'
      job.endTime = new Date()
      job.buildInfo = {
        success: false,
        duration: Date.now() - new Date(job.startTime).getTime(),
        errors: [error.message],
        warnings: []
      }
      await job.save()

      await this.emitLog(job.jobId, 'error', `Analysis failed: ${error.message}`, 'system')
      
      this.io.to(`job-${job.jobId}`).emit('done', {
        riskScore: 0,
        riskLevel: 'unknown',
        summary: {
          totalAlerts: 0,
          criticalAlerts: 0,
          dependencyIssues: 0,
          commitIssues: 0
        },
        alerts: [],
        error: error.message
      })

      // Cleanup
      await githubService.cleanup(job.jobId)
      this.activeJobs.delete(job.jobId)

    } catch (saveError) {
      log.error('❌ Failed to save error state', saveError)
    }
  }

  async getJobStatus(jobId) {
    try {
      const job = await Job.findOne({ jobId })
      if (!job) {
        throw new Error('Job not found')
      }
      return job
    } catch (error) {
      log.error('❌ Failed to get job status', error)
      throw error
    }
  }

  async getAllJobs(limit = 50) {
    try {
      const jobs = await Job.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('jobId repoUrl projectType status riskScore riskLevel startTime endTime')
      
      return jobs
    } catch (error) {
      log.error('❌ Failed to get jobs', error)
      throw error
    }
  }
}

export default AnalysisEngine
export { AnalysisEngine }