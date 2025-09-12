import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { createLogger } from '../services/logger'
import apiService from '../services/api'
import { io } from 'socket.io-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { formatDate, formatDuration, getRiskColor, getSeverityVariant, truncateText } from '../lib/utils'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  GitCommit, 
  Package, 
  Brain,
  Activity,
  TrendingUp,
  FileText,
  Users,
  Star,
  GitBranch,
  Calendar,
  Zap,
  Eye,
  Download,
  Home
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'

const log = createLogger('DASHBOARD')

function Dashboard() {
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [jobDetails, setJobDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [alerts, setAlerts] = useState([])
  const [socket, setSocket] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const logsEndRef = useRef(null)

  log.info('📊 Dashboard component mounted', { jobId })

  useEffect(() => {
    log.info('🔄 useEffect triggered for job status fetch', { jobId })
    
    const fetchJobData = async () => {
      try {
        log.info('📊 Fetching job status via API service', { jobId })
        
        // Fetch basic job status
        const jobData = await apiService.getJobStatus(jobId)
        log.info('✅ Job status data received', jobData)
        setJob(jobData)
        
        // Fetch detailed job information
        try {
          const detailsResponse = await fetch(`/api/job/${jobId}/details`)
          if (detailsResponse.ok) {
            const details = await detailsResponse.json()
            log.info('✅ Job details received', { 
              commits: details.commits?.length,
              dependencies: details.dependencies?.length,
              alerts: details.alerts?.length
            })
            setJobDetails(details)
            setAlerts(details.alerts || [])
            setLogs(details.logs || [])
          }
        } catch (detailsError) {
          log.warn('⚠️ Could not fetch job details', detailsError.message)
        }
        
      } catch (err) {
        log.error('💥 Error fetching job data', {
          message: err.message,
          stack: err.stack
        })
        setError(err.message)
      } finally {
        log.info('🏁 Job data fetch completed, setting loading to false')
        setLoading(false)
      }
    }

    // Setup WebSocket connection
    const setupWebSocket = () => {
      log.info('🔌 Setting up WebSocket connection')
      const newSocket = io('http://localhost:5000')
      
      newSocket.on('connect', () => {
        log.info('✅ WebSocket connected')
        newSocket.emit('join', `job-${jobId}`)
      })
      
      newSocket.on('log', (logEntry) => {
        log.info('📝 New log entry received', logEntry)
        setLogs(prev => [...prev, logEntry])
      })
      
      newSocket.on('alert', (alert) => {
        log.info('🚨 New alert received', alert)
        setAlerts(prev => [...prev, alert])
      })
      
      newSocket.on('progress', (progress) => {
        log.info('📈 Progress update received', progress)
        setJob(prev => prev ? { ...prev, progress: progress.percentage, status: progress.stage } : null)
      })
      
      newSocket.on('done', (summary) => {
        log.info('✅ Analysis completed', summary)
        setJob(prev => prev ? { 
          ...prev, 
          status: 'completed', 
          progress: 100,
          riskScore: summary.riskScore,
          riskLevel: summary.riskLevel
        } : null)
        
        // Refresh detailed data
        fetchJobData()
      })
      
      newSocket.on('disconnect', () => {
        log.warn('🔌 WebSocket disconnected')
      })
      
      setSocket(newSocket)
      
      return () => {
        log.info('🔌 Cleaning up WebSocket connection')
        newSocket.disconnect()
      }
    }

    if (jobId) {
      log.info('✅ JobId exists, starting fetch', { jobId })
      fetchJobData()
      const cleanup = setupWebSocket()
      
      return cleanup
    } else {
      log.warn('⚠️ No jobId provided, skipping fetch')
      setLoading(false)
      setError('No job ID provided')
    }
  }, [jobId])

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  if (loading) {
    log.info('⏳ Rendering loading state')
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
          <p className="text-xs text-muted-foreground mt-2">Job ID: {jobId}</p>
        </div>
      </div>
    )
  }

  if (error) {
    log.error('❌ Rendering error state', { error })
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Error: {error}</p>
          <p className="text-xs text-muted-foreground mb-4">Job ID: {jobId}</p>
          <button 
            onClick={() => {
              log.info('🏠 Navigating back to home')
              window.location.href = '/'
            }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // Helper functions for data visualization
  const getRiskScoreColor = (score) => {
    if (score >= 75) return '#ef4444' // red
    if (score >= 50) return '#f97316' // orange
    if (score >= 25) return '#eab308' // yellow
    return '#22c55e' // green
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'running': case 'analyzing': case 'building': case 'cloning': 
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const alertsByType = alerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1
    return acc
  }, {})

  const alertsBySeverity = alerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1
    return acc
  }, {})

  const pieChartData = Object.entries(alertsBySeverity).map(([severity, count]) => ({
    name: severity,
    value: count,
    color: severity === 'critical' ? '#ef4444' : 
           severity === 'high' ? '#f97316' : 
           severity === 'medium' ? '#eab308' : '#22c55e'
  }))

  log.info('🎨 Rendering comprehensive dashboard', { 
    job: job?.status, 
    alerts: alerts.length,
    logs: logs.length,
    activeTab 
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center space-x-2 text-2xl font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <Home className="w-6 h-6" />
                <span>🐕 CodeDog</span>
              </Link>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <div>Job ID: {jobId}</div>
                {job?.repoInfo?.name && (
                  <div className="flex items-center space-x-2">
                    <GitBranch className="w-3 h-3" />
                    <span>{job.repoInfo.owner}/{job.repoInfo.name}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {job?.riskScore !== undefined && (
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Risk Score:</span>
                  <Badge 
                    variant={job.riskLevel === 'critical' ? 'critical' : 
                            job.riskLevel === 'high' ? 'destructive' : 
                            job.riskLevel === 'medium' ? 'warning' : 'success'}
                  >
                    {job.riskScore}/100
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(job?.status)}
                <Badge variant={
                  job?.status === 'completed' ? 'success' :
                  job?.status === 'failed' ? 'destructive' :
                  job?.status === 'running' || job?.status === 'analyzing' ? 'default' :
                  'secondary'
                }>
                  {job?.status || 'Unknown'}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          {job?.progress !== undefined && job.status !== 'completed' && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Analysis Progress</span>
                <span>{job.progress}%</span>
              </div>
              <Progress value={job.progress} className="w-full" />
            </div>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'commits', label: 'Commits', icon: GitCommit },
              { id: 'dependencies', label: 'Dependencies', icon: Package },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
              { id: 'logs', label: 'Logs', icon: FileText },
              { id: 'ai-analysis', label: 'AI Analysis', icon: Brain }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors ${
                    activeTab === tab.id 
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.id === 'alerts' && alerts.length > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {alerts.length}
                    </Badge>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <OverviewTab 
            job={job} 
            jobDetails={jobDetails} 
            alerts={alerts} 
            pieChartData={pieChartData}
            getRiskScoreColor={getRiskScoreColor}
          />
        )}
        
        {activeTab === 'commits' && (
          <CommitsTab commits={jobDetails?.commits || []} />
        )}
        
        {activeTab === 'dependencies' && (
          <DependenciesTab dependencies={jobDetails?.dependencies || []} />
        )}
        
        {activeTab === 'alerts' && (
          <AlertsTab alerts={alerts} />
        )}
        
        {activeTab === 'logs' && (
          <LogsTab logs={logs} logsEndRef={logsEndRef} />
        )}
        
        {activeTab === 'ai-analysis' && (
          <AIAnalysisTab aiSummary={jobDetails?.aiSummary} job={jobDetails} />
        )}
      </main>
    </div>
  )
}

export default Dashboard
// Over
view Tab Component
function OverviewTab({ job, jobDetails, alerts, pieChartData, getRiskScoreColor }) {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length
  const highRiskCommits = jobDetails?.commits?.filter(c => c.riskScore > 70).length || 0
  const riskyDependencies = jobDetails?.dependencies?.filter(d => 
    d.riskLevel === 'high' || d.riskLevel === 'critical'
  ).length || 0

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: getRiskScoreColor(job?.riskScore || 0) }}>
              {job?.riskScore || 0}/100
            </div>
            <p className="text-xs text-muted-foreground">
              {job?.riskLevel || 'Unknown'} risk level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {alerts.length} total alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risky Commits</CardTitle>
            <GitCommit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highRiskCommits}</div>
            <p className="text-xs text-muted-foreground">
              {jobDetails?.commits?.length || 0} total commits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risky Dependencies</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{riskyDependencies}</div>
            <p className="text-xs text-muted-foreground">
              {jobDetails?.dependencies?.length || 0} total dependencies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Repository Information */}
      {job?.repoInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <GitBranch className="w-5 h-5" />
              <span>Repository Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Repository</div>
                <div className="text-lg font-semibold">{job.repoInfo.owner}/{job.repoInfo.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Language</div>
                <div className="text-lg">{job.repoInfo.language || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Stars</div>
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-lg">{job.repoInfo.stars || 0}</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Contributors</div>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span className="text-lg">{job.repoInfo.contributors?.length || 0}</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-lg">{formatDate(job.repoInfo.updatedAt)}</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Analysis Duration</div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-lg">{formatDuration(
                    job.endTime ? new Date(job.endTime) - new Date(job.startTime) : 
                    Date.now() - new Date(job.startTime)
                  )}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Distribution */}
        {pieChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alert Distribution by Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Risk Score Trend (placeholder for future enhancement) */}
        <Card>
          <CardHeader>
            <CardTitle>Analysis Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Repository Cloned</span>
                </div>
                <span className="text-sm text-muted-foreground">{formatDate(job?.startTime)}</span>
              </div>
              
              {job?.status !== 'pending' && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Commit Analysis</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Completed</span>
                </div>
              )}
              
              {jobDetails?.dependencies && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Dependency Analysis</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Completed</span>
                </div>
              )}
              
              {job?.status === 'completed' && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>AI Analysis Complete</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{formatDate(job?.endTime)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Commits Tab Component
function CommitsTab({ commits }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GitCommit className="w-5 h-5" />
            <span>Commit Analysis ({commits.length})</span>
          </CardTitle>
          <CardDescription>
            Analysis of recent commits for suspicious patterns and security risks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {commits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No commits analyzed yet
              </div>
            ) : (
              commits.map((commit, index) => (
                <div key={commit.hash} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {commit.hash.substring(0, 8)}
                        </code>
                        <Badge variant={
                          commit.riskScore > 90 ? 'critical' :
                          commit.riskScore > 70 ? 'destructive' :
                          commit.riskScore > 40 ? 'warning' : 'success'
                        }>
                          Risk: {commit.riskScore}/100
                        </Badge>
                      </div>
                      <h4 className="font-medium">{commit.message}</h4>
                      <div className="text-sm text-muted-foreground mt-1">
                        by {commit.author} • {formatDate(commit.date)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Files Changed:</span>
                      <span className="ml-2 font-medium">{commit.filesChanged?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-green-600">+{commit.additions || 0}</span>
                      <span className="text-red-600 ml-2">-{commit.deletions || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Patterns:</span>
                      <span className="ml-2 font-medium">{commit.suspiciousPatterns?.length || 0}</span>
                    </div>
                  </div>
                  
                  {commit.suspiciousPatterns && commit.suspiciousPatterns.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-orange-600 mb-2">Suspicious Patterns:</div>
                      <div className="space-y-1">
                        {commit.suspiciousPatterns.map((pattern, i) => (
                          <div key={i} className="text-sm bg-orange-50 text-orange-800 px-2 py-1 rounded">
                            {pattern}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {commit.aiAnalysis?.summary && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm font-medium text-blue-800 mb-1">AI Analysis:</div>
                      <div className="text-sm text-blue-700">{commit.aiAnalysis.summary}</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Dependencies Tab Component
function DependenciesTab({ dependencies }) {
  const groupedDeps = dependencies.reduce((acc, dep) => {
    if (!acc[dep.type]) acc[dep.type] = []
    acc[dep.type].push(dep)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(groupedDeps).map(([type, deps]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <span>{type.toUpperCase()} Dependencies ({deps.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deps.map((dep, index) => (
                <div key={`${dep.name}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{dep.name}</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{dep.version}</code>
                      <Badge variant={getSeverityVariant(dep.riskLevel)}>
                        {dep.riskLevel}
                      </Badge>
                    </div>
                    
                    {dep.typosquatting?.isTyposquat && (
                      <div className="mt-2 text-sm text-orange-600">
                        ⚠️ Potential typosquatting - similar to: {dep.typosquatting.similarPackages.join(', ')}
                      </div>
                    )}
                    
                    {dep.aiAnalysis?.summary && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {truncateText(dep.aiAnalysis.summary, 150)}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {dep.category || 'production'}
                    </div>
                    {dep.vulnerabilities && dep.vulnerabilities.length > 0 && (
                      <div className="text-sm text-red-600">
                        {dep.vulnerabilities.length} vulnerabilities
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Alerts Tab Component
function AlertsTab({ alerts }) {
  const groupedAlerts = alerts.reduce((acc, alert) => {
    if (!acc[alert.severity]) acc[alert.severity] = []
    acc[alert.severity].push(alert)
    return acc
  }, {})

  const severityOrder = ['critical', 'high', 'medium', 'low']

  return (
    <div className="space-y-6">
      {severityOrder.map(severity => {
        const severityAlerts = groupedAlerts[severity] || []
        if (severityAlerts.length === 0) return null

        return (
          <Card key={severity}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="capitalize">{severity} Alerts ({severityAlerts.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {severityAlerts.map((alert, index) => (
                  <div key={alert.id || index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={getSeverityVariant(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline">{alert.type}</Badge>
                          {alert.aiConfidence && (
                            <span className="text-sm text-muted-foreground">
                              AI Confidence: {Math.round(alert.aiConfidence * 100)}%
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-lg">{alert.title}</h4>
                        <p className="text-muted-foreground mt-1">{alert.description}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(alert.timestamp)}
                      </div>
                    </div>
                    
                    {alert.details && (
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <div className="text-sm font-medium mb-2">Details:</div>
                        <pre className="text-sm whitespace-pre-wrap">
                          {JSON.stringify(alert.details, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {alert.mitigation && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm font-medium text-blue-800 mb-1">Recommended Action:</div>
                        <div className="text-sm text-blue-700">{alert.mitigation}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
      
      {alerts.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Alerts Found</h3>
            <p className="text-muted-foreground">
              Great! No security alerts were detected during the analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Logs Tab Component
function LogsTab({ logs, logsEndRef }) {
  const getLogColor = (level) => {
    switch (level) {
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      case 'debug': return 'text-gray-400'
      default: return 'text-green-400'
    }
  }

  const getLogIcon = (source) => {
    switch (source) {
      case 'ai': return '🧠'
      case 'analysis': return '🔍'
      case 'build': return '🔨'
      case 'system': return '⚙️'
      default: return '📝'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="w-5 h-5" />
          <span>Analysis Logs ({logs.length})</span>
        </CardTitle>
        <CardDescription>
          Real-time logs from the analysis process
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">Waiting for logs...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`mb-1 ${getLogColor(log.level)}`}>
                <span className="text-gray-500">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className="ml-2">{getLogIcon(log.source)}</span>
                <span className="ml-2 uppercase text-xs">
                  [{log.level}]
                </span>
                <span className="ml-2">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </CardContent>
    </Card>
  )
}

// AI Analysis Tab Component
function AIAnalysisTab({ aiSummary, job }) {
  if (!aiSummary) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">AI Analysis Pending</h3>
          <p className="text-muted-foreground">
            AI-powered analysis will appear here once the scan is complete.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>AI Security Assessment</span>
          </CardTitle>
          <CardDescription>
            Comprehensive AI-powered analysis of security threats and risks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Overall Threat Level</div>
              <Badge 
                variant={
                  aiSummary.overallThreat === 'critical' ? 'critical' :
                  aiSummary.overallThreat === 'high' ? 'destructive' :
                  aiSummary.overallThreat === 'medium' ? 'warning' : 'success'
                }
                className="text-lg px-4 py-2"
              >
                {aiSummary.overallThreat?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>
            
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">AI Confidence</div>
              <div className="text-2xl font-bold">
                {Math.round((aiSummary.confidence || 0) * 100)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Findings */}
      {aiSummary.keyFindings && aiSummary.keyFindings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Security Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiSummary.keyFindings.map((finding, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-800">{finding}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {aiSummary.recommendations && aiSummary.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiSummary.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <Zap className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">{recommendation}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {job?.commits?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Commits Analyzed</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {job?.dependencies?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Dependencies Scanned</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {job?.alerts?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Security Alerts</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}