import mongoose from 'mongoose'

const repositorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  owner: { type: String, required: true },
  url: { type: String, required: true },
  language: { type: String },
  stars: { type: Number, default: 0 },
  lastAnalyzed: { type: Date },
  riskScore: { type: Number, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  status: { type: String, enum: ['never_analyzed', 'analyzing', 'completed', 'failed'], default: 'never_analyzed' },
  totalAlerts: { type: Number, default: 0 },
  criticalAlerts: { type: Number, default: 0 },
  lastJobId: { type: String },
  projectType: { type: String, enum: ['nodejs', 'python'], required: true },
  isPrivate: { type: Boolean, default: false },
  description: { type: String },
  tags: [{ type: String }],
  watchlist: { type: Boolean, default: false },
  notifications: { type: Boolean, default: true }
})

const userConfigSchema = new mongoose.Schema({
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  notifications: {
    email: { type: Boolean, default: true },
    browser: { type: Boolean, default: true },
    criticalOnly: { type: Boolean, default: false }
  },
  analysis: {
    autoAnalyze: { type: Boolean, default: false },
    scheduleFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    riskThreshold: { type: Number, min: 0, max: 100, default: 70 }
  },
  dashboard: {
    defaultView: { type: String, enum: ['grid', 'list'], default: 'grid' },
    itemsPerPage: { type: Number, default: 12 },
    sortBy: { type: String, enum: ['name', 'riskScore', 'lastAnalyzed', 'stars'], default: 'lastAnalyzed' },
    sortOrder: { type: String, enum: ['asc', 'desc'], default: 'desc' }
  }
})

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  avatar: { type: String },
  repositories: [repositorySchema],
  config: { type: userConfigSchema, default: () => ({}) },
  stats: {
    totalRepositories: { type: Number, default: 0 },
    totalAnalyses: { type: Number, default: 0 },
    averageRiskScore: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  },
  subscription: {
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    limits: {
      repositories: { type: Number, default: 10 },
      analysesPerMonth: { type: Number, default: 50 }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for performance
userSchema.index({ userId: 1 })
userSchema.index({ email: 1 })
userSchema.index({ 'repositories.id': 1 })

// Virtual for high-risk repositories
userSchema.virtual('highRiskRepositories').get(function() {
  return this.repositories.filter(repo => repo.riskScore >= 70)
})

// Method to add repository
userSchema.methods.addRepository = function(repoData) {
  const existingRepo = this.repositories.find(r => r.url === repoData.url)
  if (existingRepo) {
    throw new Error('Repository already exists')
  }
  
  this.repositories.push({
    id: `repo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...repoData
  })
  
  this.stats.totalRepositories = this.repositories.length
  return this.save()
}

// Method to update repository
userSchema.methods.updateRepository = function(repoId, updateData) {
  const repo = this.repositories.id(repoId)
  if (!repo) {
    throw new Error('Repository not found')
  }
  
  Object.assign(repo, updateData)
  return this.save()
}

// Method to remove repository
userSchema.methods.removeRepository = function(repoId) {
  this.repositories.id(repoId).remove()
  this.stats.totalRepositories = this.repositories.length
  return this.save()
}

// Method to update config
userSchema.methods.updateConfig = function(configData) {
  Object.assign(this.config, configData)
  return this.save()
}

export default mongoose.model('User', userSchema)