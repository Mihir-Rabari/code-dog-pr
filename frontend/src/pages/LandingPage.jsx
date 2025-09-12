import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createLogger } from '../services/logger'
import apiService from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Shield, Zap, Eye, Lock } from 'lucide-react'

const log = createLogger('LANDING')

function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [projectType, setProjectType] = useState('nodejs')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  log.info('🏠 LandingPage component mounted')

  const handleSubmit = async (e) => {
    e.preventDefault()
    log.info('📝 Form submission started', { repoUrl, projectType })
    
    if (!repoUrl.trim()) {
      log.warn('❌ Validation failed - empty repository URL')
      alert('Please enter a repository URL')
      return
    }

    setIsSubmitting(true)
    log.info('🔄 Setting submitting state to true')
    
    try {
      const requestData = {
        repoUrl: repoUrl.trim(),
        projectType
      }
      
      log.info('🔍 Starting repository analysis via API service', requestData)
      
      const responseData = await apiService.analyzeRepo(requestData.repoUrl, requestData.projectType)
      
      const { jobId } = responseData
      log.info('🧭 Navigating to dashboard', { jobId })
      navigate(`/dashboard/${jobId}`)
      
    } catch (error) {
      log.error('💥 Error during form submission', {
        message: error.message,
        stack: error.stack
      })
      alert(`Failed to start analysis: ${error.message}`)
    } finally {
      setIsSubmitting(false)
      log.info('🔄 Setting submitting state to false')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="flex items-center space-x-2 text-6xl">
                <span>🐕</span>
                <span className="text-4xl font-bold text-gray-900 dark:text-white">CodeDog</span>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              AI-Powered Supply Chain
              <span className="text-blue-600 dark:text-blue-400"> Threat Detection</span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Proactively detect and flag malicious changes in your software supply chain using 
              advanced AI analysis, commit pattern recognition, and dependency scanning.
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="flex flex-col items-center p-6">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">AI Analysis</h3>
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  DeepSeek-R1 powered analysis for sophisticated threat detection
                </p>
              </div>
              
              <div className="flex flex-col items-center p-6">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Secure Sandboxing</h3>
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  Isolated Docker containers ensure safe analysis of any repository
                </p>
              </div>
              
              <div className="flex flex-col items-center p-6">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Real-time Results</h3>
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  Live streaming of analysis progress and instant threat alerts
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Form */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Start Security Analysis</CardTitle>
            <p className="text-gray-600 dark:text-gray-300">
              Enter a GitHub repository URL to begin comprehensive threat detection
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Repository URL
                </label>
                <Input
                  id="repoUrl"
                  type="url"
                  placeholder="https://github.com/user/repository"
                  value={repoUrl}
                  onChange={(e) => {
                    const newValue = e.target.value
                    log.debug('📝 Repository URL changed', { oldValue: repoUrl, newValue })
                    setRepoUrl(newValue)
                  }}
                  required
                />
              </div>

              <div>
                <label htmlFor="projectType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Type
                </label>
                <Select
                  id="projectType"
                  value={projectType}
                  onChange={(e) => {
                    const newValue = e.target.value
                    log.debug('🔧 Project type changed', { oldValue: projectType, newValue })
                    setProjectType(newValue)
                  }}
                >
                  <option value="nodejs">Node.js</option>
                  <option value="python">Python</option>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Starting Analysis...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4" />
                    <span>Analyze Repository</span>
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <Lock className="w-4 h-4" />
                  <span>Secure Analysis</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>Real-time Monitoring</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Brain className="w-4 h-4" />
                  <span>AI-Powered</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Trusted by security teams worldwide
          </p>
          <div className="flex justify-center items-center space-x-8 opacity-60">
            <div className="text-2xl">🏢</div>
            <div className="text-2xl">🛡️</div>
            <div className="text-2xl">🔒</div>
            <div className="text-2xl">⚡</div>
            <div className="text-2xl">🎯</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage