import mongoose from 'mongoose'

const repositorySchema = new mongoose.Schema({
  repositoryId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  
  // Repository basic info
  name: { type: String, required: true },
  fullName: { type: String, required: true }, // owner/repo
  owner: { type: String, required: true },
  url: { type: String, required: true },
  description: { type: String },
  
  // Repository metadata
  metadata: {
    language: { type: String },
    stars: { type: Number, default: 0 },
    forks: { type: Number, default: 0 },
    size: { type: Number, default: 0 },
    defaultBranch: { type: String, default: 'main' },
    isPrivate: { type: Boolean, default: false },
    topics: [{ type: String }],
    license: { type: String },
    lastPush: { type: Date },
    createdAt: { type: Date },
    updatedAt: { type: Date }
  },
  
  // Analysis configuration
  config: {
    projectType: { type: String, enum: ['nodejs', 'python'], required: true },
    autoAnalysis: { type: Boolean, default: false },
    analysisFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    alertThreshold: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    excludePatterns: [{ type: String }],
    includeBranches: [{ type: String }]
  },
  
  // Latest analysis summary
  latestAnalysis: {
    jobId: { type: String },
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed'] },
    riskScore: { type: Number, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    totalAlerts: { type: Number, default: 0 },
    criticalAlerts: { type: Number, default: 0 },
    analyzedAt: { type: Date },
    duration: { type: Number }, // in milliseconds
    aiSummary: { type: String }
  },
  
  // Analysis history (last 10 analyses)
  analysisHistory: [{
    jobId: { type: String, required: true },
    riskScore: { type: Number, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    totalAlerts: { type: Number, default: 0 },
    criticalAlerts: { type: Number, default: 0 },
    analyzedAt: { type: Date, default: Date.now },
    duration: { type: Number },
    status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    summary: { type: String }
  }],
  
  // Monitoring settings
  monitoring: {
    enabled: { type: Boolean, default: true },
    lastChecked: { type: Date },
    webhookUrl: { type: String },
    notificationChannels: [{
      type: { type: String, enum: ['email', 'slack', 'webhook'] },
      target: { type: String },
      enabled: { type: Boolean, default: true }
    }]
  },
  
  // Tags and organization
  tags: [{ type: String }],
  category: { type: String, enum: ['production', 'staging', 'development', 'archived'], default: 'production' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  
  // Collaboration
  team: [{
    userId: { type: String },
    role: { type: String, enum: ['viewer', 'analyst', 'admin'], default: 'viewer' },
    addedAt: { type: Date, default: Date.now }
  }],
  
  // Status tracking
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  lastActivity: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes
repositorySchema.index({ userId: 1, isActive: 1 })
repositorySchema.index({ repositoryId: 1 })
repositorySchema.index({ fullName: 1 })
repositorySchema.index({ 'latestAnalysis.riskScore': -1 })
repositorySchema.index({ 'latestAnalysis.analyzedAt': -1 })
repositorySchema.index({ lastActivity: -1 })

// Virtual for risk trend
repositorySchema.virtual('riskTrend').get(function() {
  if (this.analysisHistory.length < 2) return 'stable'
  const latest = this.analysisHistory[0]?.riskScore || 0
  const previous = this.analysisHistory[1]?.riskScore || 0
  if (latest > previous + 10) return 'increasing'
  if (latest < previous - 10) return 'decreasing'
  return 'stable'
})

// Methods
repositorySchema.methods.addAnalysis = function(analysisData) {
  // Update latest analysis
  this.latestAnalysis = {
    jobId: analysisData.jobId,
    status: analysisData.status,
    riskScore: analysisData.riskScore,
    riskLevel: analysisData.riskLevel,
    totalAlerts: analysisData.totalAlerts,
    criticalAlerts: analysisData.criticalAlerts,
    analyzedAt: new Date(),
    duration: analysisData.duration,
    aiSummary: analysisData.aiSummary
  }
  
  // Add to history (keep only last 10)
  this.analysisHistory.unshift({
    jobId: analysisData.jobId,
    riskScore: analysisData.riskScore,
    riskLevel: analysisData.riskLevel,
    totalAlerts: analysisData.totalAlerts,
    criticalAlerts: analysisData.criticalAlerts,
    analyzedAt: new Date(),
    duration: analysisData.duration,
    status: analysisData.status,
    summary: analysisData.summary
  })
  
  // Keep only last 10 analyses
  if (this.analysisHistory.length > 10) {
    this.analysisHistory = this.analysisHistory.slice(0, 10)
  }
  
  this.lastActivity = new Date()
  return this.save()
}

repositorySchema.methods.updateMetadata = function(repoData) {
  this.metadata = {
    ...this.metadata,
    language: repoData.language,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    size: repoData.size,
    defaultBranch: repoData.default_branch,
    isPrivate: repoData.private,
    topics: repoData.topics || [],
    license: repoData.license?.name,
    lastPush: new Date(repoData.pushed_at),
    createdAt: new Date(repoData.created_at),
    updatedAt: new Date(repoData.updated_at)
  }
  return this.save()
}

export default mongoose.model('Repository', repositorySchema)