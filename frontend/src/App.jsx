import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import { appLogger } from './services/logger'

function App() {
  appLogger.info('🚀 CodeDog Frontend Application Starting...')
  appLogger.info('🌍 Environment Info', {
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    prod: import.meta.env.PROD,
    baseUrl: import.meta.env.BASE_URL
  })

  // Global error handler
  window.addEventListener('error', (event) => {
    appLogger.error('💥 Global JavaScript Error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    })
  })

  // Global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    appLogger.error('💥 Unhandled Promise Rejection', {
      reason: event.reason,
      promise: event.promise
    })
  })

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard/:jobId" element={<Dashboard />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  )
}

export default App