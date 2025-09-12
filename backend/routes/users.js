import express from 'express'
import User from '../models/User.js'
import Job from '../models/Job.js'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()

const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [USER-ROUTES-INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [USER-ROUTES-ERROR] ${message}`, error ? error.stack || error : '')
  }
}

// Get or create user
router.post('/profile', async (req, res) => {
  try {
    const { email, name, avatar } = req.body
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' })
    }

    let user = await User.findOne({ email })
    
    if (!user) {
      user = new User({
        userId: uuidv4(),
        email,
        name,
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`
      })
      await user.save()
      log.info('New user created', { userId: user.userId, email })
    } else {
      // Update user info if provided
      if (name !== user.name || avatar !== user.avatar) {
        user.name = name
        if (avatar) user.avatar = avatar
        await user.save()
        log.info('User updated', { userId: user.userId })
      }
    }

    res.json({
      userId: user.userId,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      stats: user.stats,
      config: user.config,
      subscription: user.subscription
    })
  } catch (error) {
    log.error('Error in user profile', error)
    res.status(500).json({ error: 'Failed to get/create user profile' })
  }
})

// Get user repositories
router.get('/:userId/repositories', async (req, res) => {
  try {
    const { userId } = req.params
    const { sortBy = 'lastAnalyzed', sortOrder = 'desc', search, riskLevel } = req.query
    
    const user = await User.findOne({ userId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    let repositories = [...user.repositories]

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      repositories = repositories.filter(repo => 
        repo.name.toLowerCase().includes(searchLower) ||
        repo.owner.toLowerCase().includes(searchLower) ||
        repo.description?.toLowerCase().includes(searchLower)
      )
    }

    if (riskLevel) {
      repositories = repositories.filter(repo => repo.riskLevel === riskLevel)
    }

    // Apply sorting
    repositories.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      
      if (sortBy === 'lastAnalyzed' && (!aVal || !bVal)) {
        if (!aVal && !bVal) return 0
        if (!aVal) return 1
        if (!bVal) return -1
      }
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      }
    })

    res.json({
      repositories,
      total: repositories.length,
      stats: {
        total: user.repositories.length,
        highRisk: user.repositories.filter(r => r.riskScore >= 70).length,
        analyzing: user.repositories.filter(r => r.status === 'analyzing').length,
        neverAnalyzed: user.repositories.filter(r => r.status === 'never_analyzed').length
      }
    })
  } catch (error) {
    log.error('Error getting repositories', error)
    res.status(500).json({ error: 'Failed to get repositories' })
  }
})

// Add repository
router.post('/:userId/repositories', async (req, res) => {
  try {
    const { userId } = req.params
    const { url, projectType, name, owner, description, tags } = req.body
    
    if (!url || !projectType || !name || !owner) {
      return res.status(400).json({ error: 'URL, project type, name, and owner are required' })
    }

    const user = await User.findOne({ userId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check subscription limits
    if (user.repositories.length >= user.subscription.limits.repositories) {
      return res.status(403).json({ 
        error: 'Repository limit reached',
        limit: user.subscription.limits.repositories,
        plan: user.subscription.plan
      })
    }

    const repoData = {
      name,
      owner,
      url,
      projectType,
      description: description || '',
      tags: tags || []
    }

    await user.addRepository(repoData)
    
    const newRepo = user.repositories[user.repositories.length - 1]
    
    log.info('Repository added', { userId, repoId: newRepo.id, url })
    
    res.json({
      repository: newRepo,
      message: 'Repository added successfully'
    })
  } catch (error) {
    if (error.message === 'Repository already exists') {
      return res.status(409).json({ error: error.message })
    }
    log.error('Error adding repository', error)
    res.status(500).json({ error: 'Failed to add repository' })
  }
})

// Update repository
router.put('/:userId/repositories/:repoId', async (req, res) => {
  try {
    const { userId, repoId } = req.params
    const updateData = req.body
    
    const user = await User.findOne({ userId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await user.updateRepository(repoId, updateData)
    
    const updatedRepo = user.repositories.id(repoId)
    
    log.info('Repository updated', { userId, repoId })
    
    res.json({
      repository: updatedRepo,
      message: 'Repository updated successfully'
    })
  } catch (error) {
    if (error.message === 'Repository not found') {
      return res.status(404).json({ error: error.message })
    }
    log.error('Error updating repository', error)
    res.status(500).json({ error: 'Failed to update repository' })
  }
})

// Delete repository
router.delete('/:userId/repositories/:repoId', async (req, res) => {
  try {
    const { userId, repoId } = req.params
    
    const user = await User.findOne({ userId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await user.removeRepository(repoId)
    
    log.info('Repository removed', { userId, repoId })
    
    res.json({ message: 'Repository removed successfully' })
  } catch (error) {
    if (error.message === 'Repository not found') {
      return res.status(404).json({ error: error.message })
    }
    log.error('Error removing repository', error)
    res.status(500).json({ error: 'Failed to remove repository' })
  }
})

// Update user configuration
router.put('/:userId/config', async (req, res) => {
  try {
    const { userId } = req.params
    const configData = req.body
    
    const user = await User.findOne({ userId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await user.updateConfig(configData)
    
    log.info('User config updated', { userId })
    
    res.json({
      config: user.config,
      message: 'Configuration updated successfully'
    })
  } catch (error) {
    log.error('Error updating config', error)
    res.status(500).json({ error: 'Failed to update configuration' })
  }
})

// Get user dashboard stats
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params
    
    const user = await User.findOne({ userId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get recent jobs for this user's repositories
    const recentJobs = await Job.find({
      repoUrl: { $in: user.repositories.map(r => r.url) }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('jobId repoUrl status riskScore createdAt')

    // Calculate stats
    const totalAnalyses = await Job.countDocuments({
      repoUrl: { $in: user.repositories.map(r => r.url) }
    })

    const avgRiskScore = user.repositories.length > 0 
      ? user.repositories.reduce((sum, repo) => sum + (repo.riskScore || 0), 0) / user.repositories.length
      : 0

    const riskDistribution = {
      low: user.repositories.filter(r => r.riskScore < 30).length,
      medium: user.repositories.filter(r => r.riskScore >= 30 && r.riskScore < 70).length,
      high: user.repositories.filter(r => r.riskScore >= 70).length
    }

    // Update user stats
    user.stats.totalAnalyses = totalAnalyses
    user.stats.averageRiskScore = Math.round(avgRiskScore)
    user.stats.lastActivity = new Date()
    await user.save()

    res.json({
      stats: user.stats,
      riskDistribution,
      recentJobs,
      subscription: user.subscription
    })
  } catch (error) {
    log.error('Error getting user stats', error)
    res.status(500).json({ error: 'Failed to get user stats' })
  }
})

export default router