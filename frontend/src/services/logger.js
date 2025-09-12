// Centralized logging service for frontend
class Logger {
  constructor(component = 'APP') {
    this.component = component
  }

  _log(level, message, data = null) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [${this.component}-${level}] ${message}`
    
    switch (level) {
      case 'ERROR':
        console.error(logMessage, data || '')
        break
      case 'WARN':
        console.warn(logMessage, data || '')
        break
      case 'INFO':
        console.log(logMessage, data || '')
        break
      case 'DEBUG':
        if (import.meta.env.DEV) {
          console.log(logMessage, data || '')
        }
        break
      default:
        console.log(logMessage, data || '')
    }
  }

  info(message, data = null) {
    this._log('INFO', message, data)
  }

  error(message, error = null) {
    this._log('ERROR', message, error)
  }

  warn(message, data = null) {
    this._log('WARN', message, data)
  }

  debug(message, data = null) {
    this._log('DEBUG', message, data)
  }

  // Performance logging
  time(label) {
    console.time(`[${this.component}] ${label}`)
  }

  timeEnd(label) {
    console.timeEnd(`[${this.component}] ${label}`)
  }

  // Network request logging
  logRequest(method, url, data = null) {
    this.info(`🌐 ${method} ${url}`, data)
  }

  logResponse(method, url, status, data = null) {
    const emoji = status >= 200 && status < 300 ? '✅' : '❌'
    this.info(`${emoji} ${method} ${url} - ${status}`, data)
  }
}

// Create logger instances for different components
export const createLogger = (component) => new Logger(component)
export const appLogger = new Logger('APP')
export default Logger