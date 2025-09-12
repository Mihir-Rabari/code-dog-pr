import mongoose from 'mongoose'

const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [DATABASE-INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [DATABASE-ERROR] ${message}`, error ? error.stack || error : '')
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [DATABASE-WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

class DatabaseService {
  constructor() {
    this.isConnected = false
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/codedog'
  }

  async connect() {
    try {
      log.info('🔌 Connecting to MongoDB...', { connectionString: this.connectionString })
      
      await mongoose.connect(this.connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })

      this.isConnected = true
      log.info('✅ MongoDB connected successfully')

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        log.error('💥 MongoDB connection error', error)
        this.isConnected = false
      })

      mongoose.connection.on('disconnected', () => {
        log.warn('🔌 MongoDB disconnected')
        this.isConnected = false
      })

      mongoose.connection.on('reconnected', () => {
        log.info('🔄 MongoDB reconnected')
        this.isConnected = true
      })

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect()
        process.exit(0)
      })

    } catch (error) {
      log.error('❌ Failed to connect to MongoDB', error)
      throw error
    }
  }

  async disconnect() {
    try {
      log.info('🔌 Disconnecting from MongoDB...')
      await mongoose.connection.close()
      this.isConnected = false
      log.info('✅ MongoDB disconnected successfully')
    } catch (error) {
      log.error('❌ Error disconnecting from MongoDB', error)
      throw error
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected')
      }

      // Simple ping to check connection
      await mongoose.connection.db.admin().ping()
      
      const stats = await mongoose.connection.db.stats()
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        database: mongoose.connection.name,
        collections: stats.collections,
        dataSize: stats.dataSize,
        indexSize: stats.indexSize
      }
    } catch (error) {
      log.error('🏥 Database health check failed', error)
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      }
    }
  }

  async clearTestData() {
    if (process.env.NODE_ENV === 'test') {
      log.warn('🧹 Clearing test data...')
      await mongoose.connection.db.dropDatabase()
      log.info('✅ Test data cleared')
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService()

export default databaseService
export { DatabaseService }