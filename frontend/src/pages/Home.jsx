import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
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
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  RefreshCw,
  Calendar,
  Users,
  Database
} from 'lucide-react'
import { toast } from '../components/ui/toast'
import api from '../services/api'

const Home = () => {
  const [user, setUser] = useState(null)
  const [repositories, setRepositories] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all')
  const [sortBy, setSortBy] = useState('lastActivity')
  const [viewMode, setViewMode] = useState('grid')
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [newRepo, setNewRepo] = useState({ url: '', projectType: 'nodejs', category: 'production', tags: [] })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    initializeUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadRepositories(user.userId)
    }
  }, [user, searchTerm, selectedCategory, selectedRiskLevel, sortBy, currentPage])

  const initializeUser = async () => {
    try {
      // For demo purposes, create a default user
      const userData = {
        email: 'demo@codedog.com',
        name: 'Demo User',
        avatar: 'https://github.com/shadcn.png'
      }

      const response = await api.post('/users/profile', userData)
      const { user } = response.data
      setUser(user)
      
      // Load user dashboard and repositories
      await Promise.all([
        loadDashboardStats(user.userId),
        loadRepositories(user.userId)
      ])
    } catch (error) {
      console.error('Failed to initialize user:', error)
      toast({
        title: "Error",
        description: "Failed to initialize user profile",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadDashboardStats = async (userId) => {
    try {
      const response = await api.get(`/users/profile/${userId}/dashboard`)
      setDashboardStats(response.data)
      setRecentActivity(response.data.recentActivity || [])
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
    }
  }

  const loadRepositories = async (userId) => {
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 12,
        sortBy,
        order: 'desc'
      })

      if (selectedCategory !== 'all') params.append('category', selectedCategory)
      if (selectedRiskLevel !== 'all') params.append('riskLevel', selectedRiskLevel)
      if (searchTerm) params.append('search', searchTerm)

      const response = await api.get(`/repositories/user/${userId}?${params}`)
      setRepositories(response.data.repositories)
      setTotalPages(response.data.pagination.pages)
    } catch (error) {
      console.error('Failed to load repositories:', error)
    }
  }

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
      await api.post(`/repositories/user/${user.userId}`, newRepo)
      toast({
        title: "Success",
        description: "Repository added successfully"
      })
      setShowAddRepo(false)
      setNewRepo({ url: '', projectType: 'nodejs', category: 'production', tags: [] })
      loadRepositories(user.userId)
      loadDashboardStats(user.userId)
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to add repository",
        variant: "destructive"
      })
    }
  }

  const handleStartAnalysis = async (repositoryId) => {
    try {
      const repo = repositories.find(r => r.repositoryId === repositoryId)
      if (!repo) return

      const response = await api.post('/analyze-repo', {
        repoUrl: repo.url,
        projectType: repo.config.projectType
      })

      toast({
        title: "Analysis Started",
        description: `Analysis job ${response.data.jobId} has been started`
      })

      // Refresh repository data
      loadRepositories(user.userId)
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to start analysis",
        variant: "destructive"
      })
    }
  }

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">CodeDog</h1>
              </div>
              {user && (
                <div className="flex items-center space-x-3 ml-8">
                  <img 
                    src={user.avatar} 
                    alt={user.name}
                    className="h-8 w-8 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={() => loadRepositories(user?.userId)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setShowAddRepo(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Repository
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Dashboard Stats */}
            {dashboardStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.stats.totalRepositories}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardStats.stats.activeAnalyses} active analyses
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Risk Score</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.stats.averageRiskScore}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardStats.stats.criticalRepositories} critical repos
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Analysis Usage</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {dashboardStats.stats.analysisUsed}/{dashboardStats.stats.analysisLimit}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardStats.planInfo.type} plan
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Risk Distribution</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-1">
                      <div className="flex-1 bg-green-200 h-2 rounded" style={{width: `${(dashboardStats.riskDistribution.low / dashboardStats.stats.totalRepositories) * 100}%`}}></div>
                      <div className="flex-1 bg-yellow-200 h-2 rounded" style={{width: `${(dashboardStats.riskDistribution.medium / dashboardStats.stats.totalRepositories) * 100}%`}}></div>
                      <div className="flex-1 bg-orange-200 h-2 rounded" style={{width: `${(dashboardStats.riskDistribution.high / dashboardStats.stats.totalRepositories) * 100}%`}}></div>
                      <div className="flex-1 bg-red-200 h-2 rounded" style={{width: `${(dashboardStats.riskDistribution.critical / dashboardStats.stats.totalRepositories) * 100}%`}}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      L:{dashboardStats.riskDistribution.low} M:{dashboardStats.riskDistribution.medium} H:{dashboardStats.riskDistribution.high} C:{dashboardStats.riskDistribution.critical}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest repository analyses and updates</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${getRiskColor(activity.riskLevel).replace('text-', 'bg-').replace('100', '500')}`}></div>
                          <div>
                            <p className="font-medium">{activity.name}</p>
                            <p className="text-sm text-gray-500">{activity.fullName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">Risk: {activity.riskScore}/100</p>
                          <p className="text-xs text-gray-500">{formatDate(activity.analyzedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repositories" className="space-y-6">
            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search repositories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-[180px]"
              >
                <option value="all">All Categories</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </Select>
              <Select 
                value={selectedRiskLevel} 
                onChange={(e) => setSelectedRiskLevel(e.target.value)}
                className="w-[180px]"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
                <option value="critical">Critical Risk</option>
              </Select>
              <Select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="w-[180px]"
              >
                <option value="lastActivity">Last Activity</option>
                <option value="risk">Risk Score</option>
                <option value="name">Name</option>
              </Select>
            </div>

            {/* Repository Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {repositories.map((repo) => (
                <Card key={repo.repositoryId} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{repo.name}</CardTitle>
                        <CardDescription className="text-sm text-gray-500">
                          {repo.fullName}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getRiskTrendIcon(repo.riskTrend)}
                        <Badge className={getRiskColor(repo.latestAnalysis?.riskLevel)}>
                          {repo.latestAnalysis?.riskLevel || 'Not analyzed'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {repo.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{repo.description}</p>
                      )}
                      
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4" />
                            <span>{repo.metadata.stars}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <GitBranch className="h-4 w-4" />
                            <span>{repo.metadata.forks}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {repo.metadata.language}
                          </Badge>
                        </div>
                      </div>

                      {repo.latestAnalysis ? (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Risk Score</span>
                            <span className="text-lg font-bold">{repo.latestAnalysis.riskScore}/100</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                repo.latestAnalysis.riskScore >= 75 ? 'bg-red-500' :
                                repo.latestAnalysis.riskScore >= 50 ? 'bg-orange-500' :
                                repo.latestAnalysis.riskScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${repo.latestAnalysis.riskScore}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{repo.latestAnalysis.totalAlerts} alerts</span>
                            <span>{repo.latestAnalysis.criticalAlerts} critical</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Last analyzed: {formatDate(repo.latestAnalysis.analyzedAt)}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-sm text-gray-500 mb-2">No analysis available</p>
                          <Button 
                            size="sm" 
                            onClick={() => handleStartAnalysis(repo.repositoryId)}
                            className="w-full"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start Analysis
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {repo.category}
                          </Badge>
                          {repo.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                          {repo.latestAnalysis?.status !== 'running' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleStartAnalysis(repo.repositoryId)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {repositories.length === 0 && (
              <div className="text-center py-12">
                <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No repositories found</h3>
                <p className="text-gray-500 mb-4">Get started by adding your first repository</p>
                <Button onClick={() => setShowAddRepo(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Repository
                </Button>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center space-x-2">
                <Button 
                  variant="outline" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 py-2 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Detailed view of all repository activities</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length > 0 ? (
                  <div className="space-y-6">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start space-x-4 pb-6 border-b last:border-b-0">
                        <div className={`w-3 h-3 rounded-full mt-2 ${getRiskColor(activity.riskLevel).replace('text-', 'bg-').replace('100', '500')}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{activity.name}</h4>
                            <span className="text-sm text-gray-500">{formatDate(activity.analyzedAt)}</span>
                          </div>
                          <p className="text-sm text-gray-600">{activity.fullName}</p>
                          <div className="mt-2 flex items-center space-x-4 text-sm">
                            <span>Risk Score: <strong>{activity.riskScore}/100</strong></span>
                            <Badge className={getRiskColor(activity.riskLevel)}>
                              {activity.riskLevel}
                            </Badge>
                            {activity.criticalAlerts > 0 && (
                              <span className="text-red-600">
                                {activity.criticalAlerts} critical alerts
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No activity to show</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Repository Modal */}
      {showAddRepo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">Add New Repository</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repository URL
                </label>
                <Input
                  placeholder="https://github.com/owner/repository"
                  value={newRepo.url}
                  onChange={(e) => setNewRepo({ ...newRepo, url: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Type
                </label>
                <Select 
                  value={newRepo.projectType} 
                  onChange={(e) => setNewRepo({ ...newRepo, projectType: e.target.value })}
                >
                  <option value="nodejs">Node.js</option>
                  <option value="python">Python</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <Select 
                  value={newRepo.category} 
                  onChange={(e) => setNewRepo({ ...newRepo, category: e.target.value })}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <Input
                  placeholder="frontend, react, typescript"
                  value={newRepo.tags.join(', ')}
                  onChange={(e) => setNewRepo({ 
                    ...newRepo, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) 
                  })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowAddRepo(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddRepository}>
                Add Repository
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home