import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import morgan from 'morgan'
import { v4 as uuidv4 } from 'uuid'

// Import services
import databaseService from './services/database.js'
import aiService from './services/aiService.js'
import AnalysisEngine from './services/analysisEngine.js'

// Import routes
import userRoutes from './routes/users.js'
import repositoryRoutes from './routes/repositories.js'

// Enhanced logging utility
const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [ERROR] ${message}`, error ? error.stack || error : '')
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  debug: (message, data = null) => {
    const timestamp = new Date().toISOString()
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${timestamp}] [DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '')
    }
  }
}

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

const PORT = process.env.PORT || 5000

// Initialize analysis engine
const analysisEngine = new AnalysisEngine(io)

log.info('🚀 Starting CodeDog Backend Server...')
log.info('Environment:', { NODE_ENV: process.env.NODE_ENV || 'development', PORT })

// Compression middleware
app.use(compression())

// HTTP request logging
app.use(morgan('combined'))

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now()
  log.info(`📥 ${req.method} ${req.url}`, {
    body: req.body,
    query: req.query,
    ip: req.ip
  })
  
  res.on('finish', () => {
    const duration = Date.now() - start
    log.info(`📤 ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`)
  })
  
  next()
})

// Security middleware
log.info('🛡️ Setting up security middleware...')
app.use(helmet())
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}))

// Rate limiting disabled for development
log.info('⏱️ Rate limiting disabled for development...')

// Body parsing middleware
log.info('📝 Setting up body parsing middleware...')
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await databaseService.healthCheck()
    const aiHealth = await aiService.getServiceStatus()
    
    const healthData = { 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      services: {
        database: dbHealth,
        ai: aiHealth
      }
    }
    
    log.info('🏥 Health check requested', healthData)
    res.json(healthData)
  } catch (error) {
    log.error('❌ Health check failed', error)
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// Repository analysis endpoint
app.post('/api/analyze-repo', async (req, res) => {
  try {
    log.info('🔍 Repository analysis requested', req.body)
    
    const { repoUrl, projectType } = req.body
    
    // Validation
    if (!repoUrl || !projectType) {
      log.warn('❌ Invalid request - missing required fields', { repoUrl, projectType })
      return res.status(400).json({ 
        error: 'Missing required fields: repoUrl and projectType',
        required: ['repoUrl', 'projectType']
      })
    }

    if (!['nodejs', 'python'].includes(projectType)) {
      log.warn('❌ Invalid project type', { projectType })
      return res.status(400).json({
        error: 'Invalid project type. Must be "nodejs" or "python"',
        provided: projectType
      })
    }

    // URL validation
    const urlPattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+/
    if (!urlPattern.test(repoUrl)) {
      log.warn('❌ Invalid GitHub URL format', { repoUrl })
      return res.status(400).json({
        error: 'Invalid GitHub repository URL format',
        expected: 'https://github.com/owner/repository'
      })
    }
    
    // Generate unique job ID
    const jobId = `job_${Date.now()}_${uuidv4().substring(0, 8)}`
    
    // Start analysis
    const job = await analysisEngine.startAnalysis(jobId, repoUrl, projectType)
    
    log.info('✅ Analysis job created', { jobId, repoUrl, projectType })
    
    res.json({ 
      jobId: job.jobId, 
      status: job.status,
      message: 'Analysis started successfully'
    })
    
  } catch (error) {
    log.error('❌ Failed to start analysis', error)
    res.status(500).json({
      error: 'Failed to start analysis',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Job status endpoint
app.get('/api/job/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params
    log.info('📊 Job status requested', { jobId })
    
    const job = await analysisEngine.getJobStatus(jobId)
    
    const response = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      startTime: job.startTime,
      endTime: job.endTime,
      riskScore: job.riskScore,
      riskLevel: job.riskLevel,
      repoInfo: job.repoInfo,
      summary: {
        totalAlerts: job.totalAlerts,
        criticalAlerts: job.criticalAlerts,
        commits: job.commits?.length || 0,
        dependencies: job.dependencies?.length || 0
      }
    }
    
    log.info('📋 Returning job status', { jobId, status: job.status, progress: job.progress })
    res.json(response)
    
  } catch (error) {
    log.error('❌ Failed to get job status', error)
    res.status(404).json({
      error: 'Job not found',
      jobId: req.params.jobId,
      message: error.message
    })
  }
})

// Get job details endpoint
app.get('/api/job/:jobId/details', async (req, res) => {
  try {
    const { jobId } = req.params
    log.info('📋 Job details requested', { jobId })
    
    const job = await analysisEngine.getJobStatus(jobId)
    
    res.json({
      jobId: job.jobId,
      repoUrl: job.repoUrl,
      projectType: job.projectType,
      status: job.status,
      progress: job.progress,
      startTime: job.startTime,
      endTime: job.endTime,
      riskScore: job.riskScore,
      riskLevel: job.riskLevel,
      repoInfo: job.repoInfo,
      commits: job.commits,
      dependencies: job.dependencies,
      alerts: job.alerts,
      logs: job.logs,
      aiSummary: job.aiSummary,
      buildInfo: job.buildInfo
    })
    
  } catch (error) {
    log.error('❌ Failed to get job details', error)
    res.status(404).json({
      error: 'Job not found',
      jobId: req.params.jobId,
      message: error.message
    })
  }
})

// Get all jobs endpoint
app.get('/api/jobs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const jobs = await analysisEngine.getAllJobs(limit)
    
    log.info('📊 Jobs list requested', { count: jobs.length, limit })
    res.json({ jobs, count: jobs.length })
    
  } catch (error) {
    log.error('❌ Failed to get jobs', error)
    res.status(500).json({
      error: 'Failed to retrieve jobs',
      message: error.message
    })
  }
})

// User routes
app.use('/api/users', userRoutes)

// Repository routes
app.use('/api/repositories', repositoryRoutes)

// WebSocket connection handling
io.on('connection', (socket) => {
  log.info('🔌 WebSocket client connected', { socketId: socket.id, address: socket.handshake.address })
  
  socket.on('join', (room) => {
    socket.join(room)
    log.info('🏠 Client joined room', { socketId: socket.id, room })
    socket.emit('joined', { room, message: 'Successfully joined room' })
  })
  
  socket.on('disconnect', (reason) => {
    log.info('🔌 WebSocket client disconnected', { socketId: socket.id, reason })
  })
  
  socket.on('error', (error) => {
    log.error('🔌 WebSocket error', error)
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  log.error('💥 Unhandled error in request', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  })
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  })
})

// 404 handler
app.use('*', (req, res) => {
  log.warn('🔍 Route not found', { url: req.url, method: req.method })
  res.status(404).json({ 
    error: 'Route not found',
    url: req.url,
    timestamp: new Date().toISOString()
  })
})

// Initialize services and start server
async function startServer() {
  try {
    log.info('🔌 Connecting to database...')
    await databaseService.connect()
    
    log.info('🤖 Initializing AI service...')
    // AI service initializes itself
    
    server.listen(PORT, () => {
      log.info('🎉 CodeDog Backend Server Started Successfully!')
      log.info('📍 Server Details:', {
        port: PORT,
        healthCheck: `http://localhost:${PORT}/health`,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      })
      log.info('🔗 Available endpoints:')
      log.info('  GET  /health - Health check with service status')
      log.info('  POST /api/analyze-repo - Start comprehensive repository analysis')
      log.info('  GET  /api/job/:jobId/status - Get job status')
      log.info('  GET  /api/job/:jobId/details - Get detailed job information')
      log.info('  GET  /api/jobs - Get all jobs')
      log.info('  WS   /socket.io - WebSocket connection for real-time updates')
      log.info('🚀 Server ready to analyze repositories!')
    })
    
  } catch (error) {
    log.error('💥 Failed to start server', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('🛑 SIGTERM received, shutting down gracefully...')
  await databaseService.disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  log.info('🛑 SIGINT received, shutting down gracefully...')
  await databaseService.disconnect()
  process.exit(0)
})

// Start the server
startServer()