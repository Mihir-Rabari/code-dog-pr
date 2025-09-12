import mongoose from 'mongoose'

const alertSchema = new mongoose.Schema({
  id: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  type: { type: String, enum: ['dependency', 'commit', 'runtime', 'ai-analysis'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  aiConfidence: { type: Number, min: 0, max: 1 },
  mitigation: { type: String }
})

const commitAnalysisSchema = new mongoose.Schema({
  hash: { type: String, required: true },
  author: { type: String, required: true },
  email: { type: String, required: true },
  date: { type: Date, required: true },
  message: { type: String, required: true },
  filesChanged: [{ type: String }],
  additions: { type: Number, default: 0 },
  deletions: { type: Number, default: 0 },
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  suspiciousPatterns: [{ type: String }],
  aiAnalysis: {
    summary: { type: String },
    threats: [{ type: String }],
    confidence: { type: Number, min: 0, max: 1 }
  }
})

const dependencyAnalysisSchema = new mongoose.Schema({
  name: { type: String, required: true },
  version: { type: String, required: true },
  type: { type: String, enum: ['npm', 'pip', 'maven', 'nuget'], required: true },
  riskLevel: { type: String, enum: ['safe', 'low', 'medium', 'high', 'critical'], default: 'safe' },
  vulnerabilities: [{ type: String }],
  typosquatting: {
    isTyposquat: { type: Boolean, default: false },
    similarPackages: [{ type: String }],
    confidence: { type: Number, min: 0, max: 1 }
  },
  aiAnalysis: {
    summary: { type: String },
    threats: [{ type: String }],
    confidence: { type: Number, min: 0, max: 1 }
  }
})

const logSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  level: { type: String, enum: ['info', 'warn', 'error', 'debug'], required: true },
  message: { type: String, required: true },
  source: { type: String, enum: ['build', 'analysis', 'system', 'ai'], required: true },
  details: { type: mongoose.Schema.Types.Mixed }
})

const jobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  repoUrl: { type: String, required: true },
  projectType: { type: String, enum: ['nodejs', 'python'], required: true },
  status: { 
    type: String, 
    enum: ['pending', 'cloning', 'building', 'analyzing', 'completed', 'failed'], 
    default: 'pending' 
  },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  
  // Repository Information
  repoInfo: {
    name: { type: String },
    owner: { type: String },
    branch: { type: String, default: 'main' },
    lastCommit: { type: String },
    totalCommits: { type: Number, default: 0 },
    contributors: [{ type: String }]
  },
  
  // Analysis Results
  riskScore: { type: Number, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  
  // Detailed Analysis
  commits: [commitAnalysisSchema],
  dependencies: [dependencyAnalysisSchema],
  alerts: [alertSchema],
  logs: [logSchema],
  
  // AI Analysis Summary
  aiSummary: {
    overallThreat: { type: String },
    keyFindings: [{ type: String }],
    recommendations: [{ type: String }],
    confidence: { type: Number, min: 0, max: 1 }
  },

  // Comprehensive Summary Report
  summaryReport: {
    executiveSummary: { type: String },
    keyFindings: [{ type: String }],
    riskBreakdown: {
      overall: {
        score: { type: Number },
        level: { type: String },
        securityScore: { type: Number }
      },
      commits: {
        total: { type: Number },
        highRisk: { type: Number },
        suspicious: { type: Number },
        averageRisk: { type: Number }
      },
      dependencies: {
        total: { type: Number },
        critical: { type: Number },
        high: { type: Number },
        vulnerable: { type: Number },
        typosquatting: { type: Number }
      },
      alerts: {
        total: { type: Number },
        critical: { type: Number },
        high: { type: Number },
        medium: { type: Number },
        low: { type: Number }
      }
    },
    recommendations: [{
      priority: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
      action: { type: String },
      description: { type: String }
    }],
    technicalDetails: {
      analysisDate: { type: Date },
      analysisDuration: { type: Number },
      toolsUsed: [{ type: String }],
      coverage: {
        commits: { type: Number },
        dependencies: { type: Number },
        filesAnalyzed: { type: Number }
      }
    }
  },
  
  // Build Information
  buildInfo: {
    success: { type: Boolean, default: false },
    duration: { type: Number }, // in milliseconds
    errors: [{ type: String }],
    warnings: [{ type: String }]
  },
  
  // Metadata
  createdBy: { type: String, default: 'system' },
  tags: [{ type: String }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for performance
jobSchema.index({ jobId: 1 })
jobSchema.index({ status: 1 })
jobSchema.index({ riskScore: -1 })
jobSchema.index({ createdAt: -1 })

// Virtual for total alerts count
jobSchema.virtual('totalAlerts').get(function() {
  return this.alerts ? this.alerts.length : 0
})

// Virtual for critical alerts count
jobSchema.virtual('criticalAlerts').get(function() {
  return this.alerts ? this.alerts.filter(alert => alert.severity === 'critical').length : 0
})

// Virtual for high risk alerts count
jobSchema.virtual('highRiskAlerts').get(function() {
  return this.alerts ? this.alerts.filter(alert => alert.severity === 'high').length : 0
})

// Method to add log entry
jobSchema.methods.addLog = function(level, message, source = 'system', details = null) {
  this.logs.push({
    level,
    message,
    source,
    details
  })
  return this.save()
}

// Method to add alert
jobSchema.methods.addAlert = function(alertData) {
  this.alerts.push({
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...alertData
  })
  return this.save()
}

// Method to update progress
jobSchema.methods.updateProgress = function(progress, status = null) {
  this.progress = Math.min(100, Math.max(0, progress))
  if (status) {
    this.status = status
  }
  return this.save()
}

export default mongoose.model('Job', jobSchema)