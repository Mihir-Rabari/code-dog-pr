import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { createLogger } from '../services/logger'
import apiService from '../services/api'
import { io } from 'socket.io-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion'
import { toast } from '../components/ui/toast'
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
  Home,
  Copy,
  ExternalLink,
  ChevronRight,
  Terminal,
  Code,
  AlertCircle,
  Info,
  Gauge,
  X
} from 'lucide-react'

const log = createLogger('DASHBOARD')

// Real-time log processing utilities
const formatLogTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })
}

const getLogLevelIcon = (level) => {
  switch (level) {
    case 'error': return '🚨'
    case 'warn': return '⚠️'
    case 'info': return 'ℹ️'
    case 'debug': return '🔍'
    default: return '📝'
  }
}

const getLogSourceIcon = (source) => {
  switch (source) {
    case 'system': return '🖥️'
    case 'build': return '🔨'
    case 'analysis': return '🔍'
    case 'ai': return '🤖'
    default: return '📋'
  }
}



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
              commits: details.commits?.length || 0,
              dependencies: details.dependencies?.length || 0,
              alerts: details.alerts?.length || 0,
              logs: details.logs?.length || 0
            })
            setJobDetails(details)
            setAlerts(details.alerts || [])
            setLogs(details.logs || [])
          } else {
            log.warn('⚠️ Job details API returned error status', { status: detailsResponse.status })
            // Initialize with empty arrays instead of mock data
            setJobDetails({
              commits: [],
              dependencies: [],
              alerts: [],
              logs: []
            })
            setAlerts([])
            setLogs([])
          }
        } catch (detailsError) {
          log.error('❌ Failed to fetch job details', detailsError.message)
          // Initialize with empty arrays instead of mock data
          setJobDetails({
            commits: [],
            dependencies: [],
            alerts: [],
            logs: []
          })
          setAlerts([])
          setLogs([])
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
      {/* Modern Header */}
      <header className="border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-gray-950/95 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo & Repo Info */}
            <div className="flex items-center space-x-6">
              <Link to="/" className="flex items-center space-x-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg group-hover:scale-105 transition-transform">
                  🐕
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    Supply Chain AI
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Threat Detection Platform
                  </div>
                </div>
              </Link>
              
              {job?.repoInfo?.name && (
                <div className="flex items-center space-x-3 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <GitBranch className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {job.repoInfo.owner}/{job.repoInfo.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {job.repoInfo.language} • {job.repoInfo.stars} ⭐
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Right: Status & Risk Score */}
            <div className="flex items-center space-x-4">
              {job?.riskScore !== undefined && (
                <div className="flex items-center space-x-3 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Gauge className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Risk Score
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold" style={{ color: getRiskScoreColor(job.riskScore) }}>
                        {job.riskScore}
                      </span>
                      <span className="text-gray-400">/100</span>
                      <Badge 
                        variant={job.riskLevel === 'critical' ? 'critical' : 
                                job.riskLevel === 'high' ? 'destructive' : 
                                job.riskLevel === 'medium' ? 'warning' : 'success'}
                      >
                        {job.riskLevel?.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(job?.status)}
                <Badge 
                  variant={
                    job?.status === 'completed' ? 'success' :
                    job?.status === 'failed' ? 'destructive' :
                    job?.status === 'running' || job?.status === 'analyzing' ? 'default' :
                    'secondary'
                  }
                  className="px-3 py-1"
                >
                  {job?.status?.toUpperCase() || 'UNKNOWN'}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Enhanced Progress Bar */}
          {job?.progress !== undefined && job.status !== 'completed' && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Analysis in Progress
                  </span>
                </div>
                <span className="text-sm font-mono text-gray-500">
                  {job.progress}%
                </span>
              </div>
              <div className="relative">
                <Progress value={job.progress} className="h-2" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full" />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Modern Navigation Tabs */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="container mx-auto px-6">
          <nav className="flex space-x-1">
            {[
              { id: 'logs', label: 'Live Logs', icon: Terminal, badge: logs.length > 0 ? logs.filter(l => l.level === 'error').length : null },
              { id: 'commits', label: 'Commits', icon: GitCommit, badge: jobDetails?.commits?.filter(c => c.riskScore > 70).length },
              { id: 'dependencies', label: 'Dependencies', icon: Package, badge: jobDetails?.dependencies?.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').length },
              { id: 'summary', label: 'Summary', icon: TrendingUp, badge: null }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-all duration-200 ${
                    activeTab === tab.id 
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/50' 
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.badge > 0 && (
                    <Badge variant="destructive" className="ml-1 px-2 py-0.5 text-xs">
                      {tab.badge}
                    </Badge>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {activeTab === 'logs' && (
          <LogsTab logs={logs} logsEndRef={logsEndRef} job={job} />
        )}
        
        {activeTab === 'commits' && (
          <CommitsTab commits={jobDetails?.commits || []} />
        )}
        
        {activeTab === 'dependencies' && (
          <DependenciesTab dependencies={jobDetails?.dependencies || []} />
        )}
        
        {activeTab === 'summary' && (
          <SummaryTab 
            job={job} 
            jobDetails={jobDetails} 
            alerts={alerts} 
            pieChartData={pieChartData}
            getRiskScoreColor={getRiskScoreColor}
          />
        )}
      </main>
    </div>
  )
}

export default Dashboard

// Modern Summary Tab Component  
function SummaryTab({ job, jobDetails, alerts, pieChartData, getRiskScoreColor }) {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length
  const highRiskCommits = jobDetails?.commits?.filter(c => c.riskScore > 70).length || 0
  const riskyDependencies = jobDetails?.dependencies?.filter(d => 
    d.riskLevel === 'high' || d.riskLevel === 'critical'
  ).length || 0

  const overallStatus = job?.riskScore >= 75 ? 'Compromised' : 
                       job?.riskScore >= 50 ? 'At Risk' : 
                       job?.riskScore >= 25 ? 'Low Risk' : 'Safe'

  return (
    <div className="space-y-8">
      {/* Hero Risk Score Section */}
      <Card className="shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-0">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Final Risk Summary</h2>
                <p className="text-gray-600 dark:text-gray-400">Comprehensive security assessment</p>
              </div>
            </div>
            
            {/* Risk Score Gauge */}
            <div className="relative">
              <div className="w-48 h-48 mx-auto relative">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={getRiskScoreColor(job?.riskScore || 0)}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${((job?.riskScore || 0) / 100) * 251.2} 251.2`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-bold" style={{ color: getRiskScoreColor(job?.riskScore || 0) }}>
                      {job?.riskScore || 0}
                    </div>
                    <div className="text-gray-400 text-sm">/100</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Badge 
                variant={
                  overallStatus === 'Compromised' ? 'critical' :
                  overallStatus === 'At Risk' ? 'destructive' :
                  overallStatus === 'Low Risk' ? 'warning' : 'success'
                }
                className="px-6 py-2 text-lg font-semibold"
              >
                {overallStatus}
              </Badge>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                {overallStatus === 'Compromised' ? 'Critical security issues detected. Immediate action required.' :
                 overallStatus === 'At Risk' ? 'Multiple security concerns identified. Review recommended.' :
                 overallStatus === 'Low Risk' ? 'Minor security issues found. Monitor closely.' :
                 'No significant security threats detected.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{criticalAlerts}</div>
                <div className="text-sm text-gray-500">Critical Alerts</div>
                <div className="text-xs text-gray-400">{alerts.length} total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <GitCommit className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{highRiskCommits}</div>
                <div className="text-sm text-gray-500">Risky Commits</div>
                <div className="text-xs text-gray-400">{jobDetails?.commits?.length || 0} analyzed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{riskyDependencies}</div>
                <div className="text-sm text-gray-500">Risky Dependencies</div>
                <div className="text-xs text-gray-400">{jobDetails?.dependencies?.length || 0} scanned</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {jobDetails?.aiSummary?.confidence ? Math.round(jobDetails.aiSummary.confidence * 100) : 0}%
                </div>
                <div className="text-sm text-gray-500">AI Confidence</div>
                <div className="text-xs text-gray-400">Analysis accuracy</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Alerts Section */}
      {alerts.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <CardTitle>Key Security Alerts</CardTitle>
                  <CardDescription>
                    {alerts.length} alerts detected • {criticalAlerts} critical
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.slice(0, 5).map((alert, index) => (
                <div key={alert.id || index} className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex-shrink-0">
                    {alert.severity === 'critical' ? (
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">🚨</span>
                      </div>
                    ) : alert.severity === 'high' ? (
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">⚠️</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">⚠️</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">{alert.title}</h4>
                      <Badge variant={getSeverityVariant(alert.severity)}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{alert.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Type: {alert.type}</span>
                      <span>Time: {formatDate(alert.timestamp)}</span>
                      {alert.aiConfidence && (
                        <span>AI Confidence: {Math.round(alert.aiConfidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {alerts.length > 5 && (
                <div className="text-center pt-4">
                  <Button variant="outline" size="sm">
                    View All {alerts.length} Alerts
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repository Information */}
      {job?.repoInfo && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Repository Information</CardTitle>
                <CardDescription>
                  Analysis completed • {formatDuration(
                    job.endTime ? new Date(job.endTime) - new Date(job.startTime) : 
                    Date.now() - new Date(job.startTime)
                  )} duration
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Repository</div>
                <div className="flex items-center space-x-2">
                  <div className="text-lg font-semibold">{job.repoInfo.owner}/{job.repoInfo.name}</div>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Language</div>
                <div className="text-lg">{job.repoInfo.language || 'Unknown'}</div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Popularity</div>
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-lg">{job.repoInfo.stars || 0}</span>
                  <span className="text-gray-400">stars</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Contributors</div>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-lg">{job.repoInfo.contributors?.length || 0}</span>
                  <span className="text-gray-400">people</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-lg">{formatDate(job.repoInfo.updatedAt)}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Analysis Time</div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-gray-500" />
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

      {/* Download Report CTA */}
      <Card className="shadow-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 border-blue-200 dark:border-blue-800">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
              <Download className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Download Full Security Report
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Get a comprehensive PDF report with detailed findings, recommendations, and remediation steps.
              </p>
              <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                <Download className="w-5 h-5 mr-2" />
                Download Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Distribution */}
        {pieChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alert Distribution by Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-lg font-medium mb-2">Alert Distribution</div>
                  <div className="space-y-2">
                    {pieChartData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="capitalize">{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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

// Modern Commits Tab Component
function CommitsTab({ commits }) {
  const [expandedCommit, setExpandedCommit] = useState(null)
  
  const getRiskBadgeVariant = (score) => {
    if (score >= 90) return 'critical'
    if (score >= 70) return 'destructive'
    if (score >= 40) return 'warning'
    return 'success'
  }

  const getRiskIcon = (score) => {
    if (score >= 70) return <AlertTriangle className="w-4 h-4" />
    if (score >= 40) return <AlertCircle className="w-4 h-4" />
    return <CheckCircle className="w-4 h-4" />
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <GitCommit className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Commit Analysis</CardTitle>
                <CardDescription>
                  {commits.length} commits analyzed • AI-powered threat detection
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="px-3 py-1">
              {commits.filter(c => c.riskScore > 70).length} High Risk
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {commits.length === 0 ? (
            <div className="text-center py-12">
              <GitCommit className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Commits Analyzed</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Commit analysis will appear here once the repository scan is complete.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commit</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commits.map((commit) => (
                    <TableRow key={commit.hash} className="group">
                      <TableCell>
                        <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                          {commit.hash.substring(0, 8)}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {commit.author.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{commit.author}</div>
                            <div className="text-xs text-gray-500">{formatDate(commit.date)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="font-medium truncate">{commit.message}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="text-green-600">+{commit.additions || 0}</span>
                            <span className="text-red-600 ml-2">-{commit.deletions || 0}</span>
                            <span className="text-gray-400 ml-2">• {commit.filesChanged?.length || 0} files</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="text-2xl font-bold" style={{ color: getRiskScoreColor(commit.riskScore || 0) }}>
                            {commit.riskScore || 0}
                          </div>
                          <div className="text-gray-400">/100</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getRiskIcon(commit.riskScore || 0)}
                          <Badge variant={getRiskBadgeVariant(commit.riskScore || 0)}>
                            {commit.riskScore >= 70 ? '🚨 Suspicious' : commit.riskScore >= 40 ? '⚠️ Medium' : '✅ Safe'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedCommit(expandedCommit === commit.hash ? null : commit.hash)}
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform ${expandedCommit === commit.hash ? 'rotate-90' : ''}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Expanded Commit Details */}
              {expandedCommit && (
                <Card className="mt-4 border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    {(() => {
                      const commit = commits.find(c => c.hash === expandedCommit)
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Code className="w-5 h-5 text-blue-500" />
                            <h4 className="font-semibold">Commit Details: {commit.hash.substring(0, 8)}</h4>
                          </div>
                          
                          {commit.suspiciousPatterns && commit.suspiciousPatterns.length > 0 && (
                            <div>
                              <h5 className="font-medium text-orange-600 mb-2">🚨 Suspicious Patterns Detected:</h5>
                              <div className="space-y-2">
                                {commit.suspiciousPatterns.map((pattern, i) => (
                                  <div key={i} className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                                    <div className="text-sm text-orange-800 dark:text-orange-200">{pattern}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {commit.aiAnalysis?.summary && (
                            <div>
                              <h5 className="font-medium text-blue-600 mb-2">🧠 AI Analysis:</h5>
                              <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-sm text-blue-800 dark:text-blue-200">{commit.aiAnalysis.summary}</p>
                                {commit.aiAnalysis.threats && commit.aiAnalysis.threats.length > 0 && (
                                  <div className="mt-3">
                                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Identified Threats:</div>
                                    <div className="space-y-1">
                                      {commit.aiAnalysis.threats.map((threat, i) => (
                                        <div key={i} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                          • {threat}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Files changed: {commit.filesChanged?.length || 0}</span>
                            <span>Additions: +{commit.additions || 0}</span>
                            <span>Deletions: -{commit.deletions || 0}</span>
                            {commit.aiAnalysis?.confidence && (
                              <span>AI Confidence: {Math.round(commit.aiAnalysis.confidence * 100)}%</span>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Modern Dependencies Tab Component
function DependenciesTab({ dependencies }) {
  const [selectedDep, setSelectedDep] = useState(null)
  
  const groupedDeps = dependencies.reduce((acc, dep) => {
    if (!acc[dep.type]) acc[dep.type] = []
    acc[dep.type].push(dep)
    return acc
  }, {})

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'medium': return <Info className="w-4 h-4 text-yellow-500" />
      default: return <CheckCircle className="w-4 h-4 text-green-500" />
    }
  }

  const totalDeps = dependencies.length
  const riskyDeps = dependencies.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').length
  const typosquatDeps = dependencies.filter(d => d.typosquatting?.isTyposquat).length

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalDeps}</div>
                <div className="text-sm text-gray-500">Total Dependencies</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{riskyDeps}</div>
                <div className="text-sm text-gray-500">High Risk Packages</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{typosquatDeps}</div>
                <div className="text-sm text-gray-500">Typosquatting Detected</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dependencies Table */}
      {Object.entries(groupedDeps).map(([type, deps]) => (
        <Card key={type} className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>{type.toUpperCase()} Dependencies</CardTitle>
                  <CardDescription>
                    {deps.length} packages • {deps.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').length} flagged as risky
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {deps.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Dependencies Found</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  No {type} dependencies were detected in this repository.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deps.map((dep, index) => (
                    <TableRow key={`${dep.name}-${index}`} className="group">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {getRiskIcon(dep.riskLevel)}
                          <div>
                            <div className="font-medium">{dep.name}</div>
                            <div className="text-xs text-gray-500">{dep.category || 'production'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {dep.version}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityVariant(dep.riskLevel)}>
                          {dep.riskLevel === 'critical' ? '🚨 Critical' :
                           dep.riskLevel === 'high' ? '⚠️ High Risk' :
                           dep.riskLevel === 'medium' ? '⚠️ Medium' :
                           '✅ Safe'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          {dep.typosquatting?.isTyposquat && (
                            <div className="text-sm text-orange-600 mb-1">
                              🎯 Typosquatting suspected
                            </div>
                          )}
                          {dep.vulnerabilities && dep.vulnerabilities.length > 0 && (
                            <div className="text-sm text-red-600 mb-1">
                              {dep.vulnerabilities.length} vulnerabilities
                            </div>
                          )}
                          {dep.aiAnalysis?.summary && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {truncateText(dep.aiAnalysis.summary, 100)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDep(selectedDep === dep.name ? null : dep.name)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Detailed Dependency View */}
      {selectedDep && (
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            {(() => {
              const dep = dependencies.find(d => d.name === selectedDep)
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Package className="w-6 h-6 text-orange-500" />
                      <h4 className="text-lg font-semibold">{dep.name}</h4>
                      <Badge variant={getSeverityVariant(dep.riskLevel)}>
                        {dep.riskLevel}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDep(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {dep.typosquatting?.isTyposquat && (
                    <div className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <h5 className="font-medium text-orange-800 dark:text-orange-200 mb-2">🎯 Typosquatting Alert</h5>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                        This package name is similar to popular packages and may be attempting typosquatting.
                      </p>
                      <div className="text-sm">
                        <strong>Similar packages:</strong> {dep.typosquatting.similarPackages.join(', ')}
                      </div>
                      <div className="text-sm mt-1">
                        <strong>Confidence:</strong> {Math.round(dep.typosquatting.confidence * 100)}%
                      </div>
                    </div>
                  )}
                  
                  {dep.aiAnalysis?.summary && (
                    <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">🧠 AI Analysis</h5>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{dep.aiAnalysis.summary}</p>
                      {dep.aiAnalysis.threats && dep.aiAnalysis.threats.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Identified Threats:</div>
                          <div className="space-y-1">
                            {dep.aiAnalysis.threats.map((threat, i) => (
                              <div key={i} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                • {threat}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
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

// Modern Logs Tab Component
function LogsTab({ logs, logsEndRef, job }) {
  const [copied, setCopied] = useState(false)
  
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

  const copyLogs = () => {
    const logText = logs.map(log => 
      `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n')
    
    navigator.clipboard.writeText(logText)
    setCopied(true)
    toast({
      title: "Logs copied!",
      description: "All logs have been copied to your clipboard.",
      variant: "success"
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-gray-900 to-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Terminal className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-white">Build & Runtime Logs</CardTitle>
                <CardDescription className="text-gray-400">
                  Real-time analysis output • {logs.length} entries
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyLogs}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? 'Copied!' : 'Copy Logs'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="bg-black/50 backdrop-blur rounded-lg border border-gray-700 p-4 h-[500px] overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <div>Waiting for analysis to start...</div>
                  <div className="text-xs mt-2">Logs will appear here in real-time</div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={log._id || index} className={`flex items-start space-x-3 py-1 hover:bg-gray-800/30 rounded px-2 -mx-2 ${getLogColor(log.level)}`}>
                    <span className="text-gray-500 text-xs mt-0.5 font-mono">
                      {formatLogTimestamp(log.timestamp)}
                    </span>
                    <span className="text-lg leading-none">{getLogSourceIcon(log.source)}</span>
                    <Badge 
                      variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'warning' : 'secondary'}
                      className="text-xs px-2 py-0"
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                    <span className="flex-1 leading-relaxed">
                      {getLogLevelIcon(log.level)} {log.message}
                    </span>
                    {log.details && (
                      <button 
                        className="text-xs text-gray-400 hover:text-gray-300"
                        onClick={() => console.log('Log details:', log.details)}
                        title="View details"
                      >
                        📋
                      </button>
                    )}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Live Status Indicators */}
      {job?.status === 'running' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <div>
                  <div className="font-medium text-blue-900 dark:text-blue-100">Repository Cloned</div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">Analysis in progress</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                <div>
                  <div className="font-medium text-yellow-900 dark:text-yellow-100">AI Analysis</div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">Processing commits & dependencies</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <div>
                  <div className="font-medium text-green-900 dark:text-green-100">Security Scan</div>
                  <div className="text-sm text-green-700 dark:text-green-300">Threat detection active</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
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