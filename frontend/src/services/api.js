import { createLogger } from './logger'

const logger = createLogger('API')

class ApiService {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
    logger.info('🔧 API Service initialized', { baseUrl })
  }

  async request(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`
    logger.logRequest(method, url, data)

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    }

    if (data) {
      config.body = JSON.stringify(data)
    }

    try {
      const response = await fetch(url, config)
      logger.logResponse(method, url, response.status)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`❌ API Error: ${method} ${url}`, {
          status: response.status,
          statusText: response.statusText,
          errorText
        })
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const responseData = await response.json()
      logger.info(`✅ API Success: ${method} ${url}`, responseData)
      return responseData

    } catch (error) {
      logger.error(`💥 API Request Failed: ${method} ${url}`, {
        message: error.message,
        stack: error.stack
      })
      throw error
    }
  }

  // Convenience methods
  async get(endpoint) {
    return this.request('GET', endpoint)
  }

  async post(endpoint, data) {
    return this.request('POST', endpoint, data)
  }

  async put(endpoint, data) {
    return this.request('PUT', endpoint, data)
  }

  async delete(endpoint) {
    return this.request('DELETE', endpoint)
  }

  // Specific API methods
  async analyzeRepo(repoUrl, projectType) {
    logger.info('🔍 Starting repository analysis', { repoUrl, projectType })
    return this.post('/api/analyze-repo', { repoUrl, projectType })
  }

  async getJobStatus(jobId) {
    logger.info('📊 Fetching job status', { jobId })
    return this.get(`/api/job/${jobId}/status`)
  }

  async healthCheck() {
    logger.info('🏥 Performing health check')
    return this.get('/health')
  }
}

// Create and export a default instance
const apiService = new ApiService()
export default apiService
export { ApiService }