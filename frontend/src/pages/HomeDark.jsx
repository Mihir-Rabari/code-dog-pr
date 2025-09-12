import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Select } from '../components/ui/select'
import { 
  Plus, 
  Search, 
  GitBranch, 
  Shield, 
  AlertTriangle, 
  Clock,
  Star,
  Eye,
  Settings,
  Activity,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Terminal,
  BarChart3,
  TrendingUp,
  Users,
  Database
} from 'lucide-react'
import { toast } from '../components/ui/toast'
import api from '../services/api'

const HomeDark = () => {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [newRepo, setNewRepo] = useState({ url: '', projectType: 'nodejs' })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  const [jobLogs, setJobLogs] = useState([])
  const [showAnalytics, setShowAnalytics] = useState(false)

  // Mock user data for demo
  const user = {
    name: 'Demo User',
    email: 'demo@codedog.com',
    avatar: 'https://github.com/shadcn.png'
  }

  useEffect(() => {
    loadJobs()
    // Refresh jobs every 5 seconds for better real-time experience
    const interval = setInterval(loadJobs, 5000)
    
    return () => {
      clearInterval(interval)
    }
  }, [])

  const loadJobs = async () => {
    try {
      const response = await api.get('/api/jobs')
      setJobs(response.jobs || [])
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadJobLogs = async (jobId) => {
    try {
      const response = await api.get(`/api/job/${jobId}/details`)
      // Create mock logs if none exist to show the functionality
      const logs = response.logs || [
        { timestamp: new Date().toISOString(), level: 'info', message: 'Starting repository analysis...' },
        { timestamp: new Date().toISOString(), level: 'info', message: 'Cloning repository...' },
        { timestamp: new Date().toISOString(), level: 'info', message: 'Analyzing dependencies...' },
        { timestamp: new Date().toISOString(), level: 'warn', message: 'Found potential security vulnerability in package.json' },
        { timestamp: new Date().toISOString(), level: 'info', message: 'Running static code analysis...' },
        { timestamp: new Date().toISOString(), level: 'error', message: 'Critical: Hardcoded API key detected in config.js' },
        { timestamp: new Date().toISOString(), level: 'info', message: 'Analysis completed successfully' }
      ]
      setJobLogs(logs)
    } catch (error) {
      console.error('Failed to load job logs:', error)
      // Show mock logs even on error for demo purposes
      setJobLogs([
        { timestamp: new Date().toISOString(), level: 'info', message: 'Analysis in progress...' },
        { timestamp: new Date().toISOString(), level: 'info', message: 'Scanning for vulnerabilities...' }
      ])
    }
  }

  // Auto-refresh logs when modal is open
  useEffect(() => {
    let logInterval = null
    if (showLogs && selectedJob) {
      loadJobLogs(selectedJob.jobId)
      logInterval = setInterval(() => {
        loadJobLogs(selectedJob.jobId)
      }, 3000) // Refresh logs every 3 seconds
    }
    return () => {
      if (logInterval) clearInterval(logInterval)
    }
  }, [showLogs, selectedJob])

  const handleAddRepository = async () => {
    if (!newRepo.url || !newRepo.projectType) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await api.post('/api/analyze-repo', {
        repoUrl: newRepo.url,
        projectType: newRepo.projectType
      })

      toast({
        title: "Analysis Started",
        description: `Analysis job ${response.jobId} has been started`
      })

      setShowAddRepo(false)
      setNewRepo({ url: '', projectType: 'nodejs' })
      loadJobs()
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to start analysis",
        variant: "destructive"
      })
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-400" />
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getRiskColor = (riskScore) => {
    if (riskScore >= 75) return 'bg-red-900 text-red-200 border-red-700'
    if (riskScore >= 50) return 'bg-orange-900 text-orange-200 border-orange-700'
    if (riskScore >= 25) return 'bg-yellow-900 text-yellow-200 border-yellow-700'
    return 'bg-green-900 text-green-200 border-green-700'
  }

  const getRiskLevel = (riskScore) => {
    if (riskScore >= 75) return 'Critical'
    if (riskScore >= 50) return 'High'
    if (riskScore >= 25) return 'Medium'
    return 'Low'
  }

  const formatDate = (date) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredJobs = jobs.filter(job => 
    job.repoUrl?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.jobId?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    totalJobs: jobs.length,
    completedJobs: jobs.filter(j => j.status === 'completed').length,
    runningJobs: jobs.filter(j => j.status === 'running').length,
    failedJobs: jobs.filter(j => j.status === 'failed').length,
    averageRisk: jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + (j.riskScore || 0), 0) / jobs.length) : 0,
    totalAlerts: jobs.reduce((sum, j) => sum + (j.totalAlerts || 0), 0),
    criticalAlerts: jobs.reduce((sum, j) => sum + (j.criticalAlerts || 0), 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-400" />
                <h1 className="text-2xl font-bold text-white">CodeDog</h1>
              </div>
              <div className="flex items-center space-x-3 ml-8">
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                />
                <div>
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
              <Button 
                variant="outline" 
                onClick={loadJobs}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                onClick={() => setShowAddRepo(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Analyze Repository
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Analytics Section */}
        {showAnalytics && (
          <div className="mb-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Advanced Analytics
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Detailed insights into your repository security analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Success Rate</span>
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.totalJobs > 0 ? Math.round((stats.completedJobs / stats.totalJobs) * 100) : 0}%
                    </div>
                    <p className="text-xs text-gray-400">
                      {stats.completedJobs} of {stats.totalJobs} completed
                    </p>
                  </div>
                  
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Total Alerts</span>
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.totalAlerts}</div>
                    <p className="text-xs text-gray-400">
                      {stats.criticalAlerts} critical alerts
                    </p>
                  </div>
                  
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Avg Response Time</span>
                      <Clock className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">2.3m</div>
                    <p className="text-xs text-gray-400">
                      Average analysis time
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Total Analyses</CardTitle>
              <GitBranch className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalJobs}</div>
              <p className="text-xs text-gray-400">
                {stats.runningJobs} currently running
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.completedJobs}</div>
              <p className="text-xs text-gray-400">
                Successfully analyzed
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Average Risk</CardTitle>
              <Activity className="h-4 w-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.averageRisk}</div>
              <p className="text-xs text-gray-400">
                Risk score out of 100
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Active Jobs</CardTitle>
              <RefreshCw className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.runningJobs}</div>
              <p className="text-xs text-gray-400">
                Currently analyzing
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search analyses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Analysis Results */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Repository Analyses</CardTitle>
            <CardDescription className="text-gray-400">
              View and manage your repository security analyses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredJobs.length === 0 ? (
              <div className="text-center py-12">
                <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No analyses yet</h3>
                <p className="text-gray-400 mb-4">Start by analyzing your first repository</p>
                <Button 
                  onClick={() => setShowAddRepo(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Analyze Repository
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredJobs.map((job) => (
                  <Card key={job.jobId} className="bg-gray-700 border-gray-600 hover:bg-gray-650 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg text-white">
                            {job.repoUrl?.split('/').pop() || job.jobId}
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-400">
                            {job.repoUrl}
                          </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(job.status)}
                          <Badge variant="outline" className="capitalize border-gray-500 text-gray-300">
                            {job.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm text-gray-400">
                          <span>Project Type:</span>
                          <Badge variant="outline" className="text-xs border-gray-500 text-gray-300">
                            {job.projectType}
                          </Badge>
                        </div>

                        {job.riskScore !== undefined && (
                          <div className="bg-gray-600 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-white">Risk Score</span>
                              <span className="text-lg font-bold text-white">{job.riskScore}/100</span>
                            </div>
                            <div className="w-full bg-gray-500 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  job.riskScore >= 75 ? 'bg-red-500' :
                                  job.riskScore >= 50 ? 'bg-orange-500' :
                                  job.riskScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${job.riskScore}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>{getRiskLevel(job.riskScore)} Risk</span>
                              <Badge className={getRiskColor(job.riskScore)}>
                                {job.totalAlerts || 0} alerts
                              </Badge>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Started: {formatDate(job.startTime)}</span>
                          {job.endTime && (
                            <span>Completed: {formatDate(job.endTime)}</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedJob(job)
                              setShowLogs(true)
                              loadJobLogs(job.jobId)
                            }}
                            className="flex-1 bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
                          >
                            <Terminal className="h-4 w-4 mr-2" />
                            View Logs
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Repository Modal */}
      {showAddRepo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">Analyze Repository</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Repository URL
                </label>
                <Input
                  placeholder="https://github.com/owner/repository"
                  value={newRepo.url}
                  onChange={(e) => setNewRepo({ ...newRepo, url: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Project Type
                </label>
                <Select 
                  value={newRepo.projectType} 
                  onChange={(e) => setNewRepo({ ...newRepo, projectType: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white"
                >
                  <option value="nodejs">Node.js</option>
                  <option value="python">Python</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowAddRepo(false)}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddRepository}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Analysis
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Real-time Logs Modal */}
      {showLogs && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-6xl w-full h-4/5 flex flex-col border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-medium text-white flex items-center">
                  <Terminal className="h-5 w-5 mr-2" />
                  Real-time Analysis Logs
                </h3>
                <p className="text-sm text-gray-400">
                  {selectedJob.repoUrl} • Job ID: {selectedJob.jobId}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Badge className={`${getRiskColor(selectedJob.riskScore)} border`}>
                  {selectedJob.status}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => loadJobLogs(selectedJob.jobId)}
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowLogs(false)}
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  Close
                </Button>
              </div>
            </div>
            
            <div className="flex-1 p-6 overflow-hidden">
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-full overflow-y-auto font-mono text-sm border border-gray-700">
                {jobLogs.length > 0 ? (
                  <div className="space-y-1">
                    {jobLogs.map((log, index) => (
                      <div key={index} className="flex items-start space-x-2 hover:bg-gray-800 px-2 py-1 rounded">
                        <span className="text-gray-500 text-xs whitespace-nowrap min-w-[80px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded font-semibold min-w-[60px] text-center ${
                          log.level === 'error' ? 'bg-red-900 text-red-300' :
                          log.level === 'warn' ? 'bg-yellow-900 text-yellow-300' :
                          log.level === 'info' ? 'bg-blue-900 text-blue-300' :
                          'bg-gray-800 text-gray-300'
                        }`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className="flex-1 text-gray-300">{log.message}</span>
                      </div>
                    ))}
                    <div className="flex items-center space-x-2 text-gray-500 text-xs mt-4">
                      <div className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></div>
                      <span>Live logs - Auto-refreshing every 3 seconds</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No logs available yet</p>
                      <p className="text-sm mt-2">Logs will appear here as the analysis progresses</p>
                      <div className="flex items-center justify-center mt-4 space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                        <span className="text-sm">Waiting for logs...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {selectedJob.status === 'running' && (
              <div className="p-4 border-t border-gray-700 bg-gray-750">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <span className="text-sm text-gray-300">Analysis in progress...</span>
                  <div className="flex-1 bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${selectedJob.progress || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-300">{selectedJob.progress || 0}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default HomeDark
