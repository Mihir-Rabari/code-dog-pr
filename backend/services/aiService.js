import axios from 'axios'

const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [AI-SERVICE-INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [AI-SERVICE-ERROR] ${message}`, error ? error.stack || error : '')
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [AI-SERVICE-WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

class AIService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
    this.model = process.env.AI_MODEL || 'deepseek-r1:1.5b'
    this.isAvailable = false
    this.initializeService()
  }

  async initializeService() {
    try {
      log.info('🤖 Initializing AI Service...', { ollamaUrl: this.ollamaUrl, model: this.model })
      await this.checkOllamaHealth()
      await this.ensureModelAvailable()
      this.isAvailable = true
      log.info('✅ AI Service initialized successfully')
    } catch (error) {
      log.error('❌ Failed to initialize AI Service', error)
      this.isAvailable = false
    }
  }

  async checkOllamaHealth() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 })
      log.info('🏥 Ollama health check passed', { availableModels: response.data.models?.length || 0 })
      return true
    } catch (error) {
      log.error('💥 Ollama health check failed', error.message)
      throw new Error('Ollama service is not available')
    }
  }

  async ensureModelAvailable() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`)
      const availableModels = response.data.models || []
      const modelExists = availableModels.some(model => model.name.includes(this.model.split(':')[0]))
      
      if (!modelExists) {
        log.warn('⚠️ Model not found, attempting to pull...', { model: this.model })
        await this.pullModel()
      } else {
        log.info('✅ Model is available', { model: this.model })
      }
    } catch (error) {
      log.error('❌ Error checking model availability', error)
      throw error
    }
  }

  async pullModel() {
    try {
      log.info('📥 Pulling AI model...', { model: this.model })
      const response = await axios.post(`${this.ollamaUrl}/api/pull`, {
        name: this.model
      }, { timeout: 300000 }) // 5 minute timeout for model pull
      
      log.info('✅ Model pulled successfully', { model: this.model })
      return response.data
    } catch (error) {
      log.error('❌ Failed to pull model', error)
      throw error
    }
  }

  async generateResponse(prompt, context = null) {
    if (!this.isAvailable) {
      log.warn('⚠️ AI Service not available, returning fallback response')
      return this.getFallbackResponse(prompt)
    }

    try {
      log.info('🧠 Generating AI response...', { promptLength: prompt.length })
      
      const requestData = {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 2048
        }
      }

      if (context) {
        requestData.context = context
      }

      const response = await axios.post(`${this.ollamaUrl}/api/generate`, requestData, {
        timeout: 60000 // 1 minute timeout
      })

      log.info('✅ AI response generated successfully', { 
        responseLength: response.data.response?.length || 0,
        done: response.data.done 
      })

      return {
        response: response.data.response,
        context: response.data.context,
        done: response.data.done,
        model: this.model
      }
    } catch (error) {
      log.error('💥 AI generation failed', error)
      return this.getFallbackResponse(prompt)
    }
  }

  async analyzeCommit(commitData) {
    const prompt = `
Analyze this Git commit for potential security threats and supply chain risks:

Commit Hash: ${commitData.hash}
Author: ${commitData.author} <${commitData.email}>
Date: ${commitData.date}
Message: ${commitData.message}

Files Changed: ${commitData.filesChanged?.join(', ') || 'N/A'}
Additions: ${commitData.additions || 0}
Deletions: ${commitData.deletions || 0}

Code Changes Context:
${commitData.diff || 'No diff available'}

Please analyze this commit and provide:
1. Risk assessment (0-100 score)
2. Potential threats identified
3. Suspicious patterns found
4. Confidence level (0-1)
5. Brief summary of findings

Focus on detecting:
- Malicious code injection
- Backdoors or hidden functionality
- Suspicious network calls
- Obfuscated code
- Unusual file modifications
- Crypto mining code
- Data exfiltration attempts

Respond in JSON format:
{
  "riskScore": number,
  "threats": ["threat1", "threat2"],
  "suspiciousPatterns": ["pattern1", "pattern2"],
  "confidence": number,
  "summary": "brief analysis summary"
}
`

    try {
      const aiResponse = await this.generateResponse(prompt)
      const analysis = this.parseAIResponse(aiResponse.response)
      
      log.info('🔍 Commit analysis completed', { 
        commitHash: commitData.hash,
        riskScore: analysis.riskScore,
        threatsFound: analysis.threats?.length || 0
      })

      return analysis
    } catch (error) {
      log.error('❌ Commit analysis failed', error)
      return this.getFallbackCommitAnalysis()
    }
  }

  async analyzeDependency(dependencyData) {
    const prompt = `
Analyze this software dependency for potential security risks and supply chain threats:

Package Name: ${dependencyData.name}
Version: ${dependencyData.version}
Type: ${dependencyData.type}
Registry: ${dependencyData.registry || 'Unknown'}

Package Information:
- Downloads: ${dependencyData.downloads || 'Unknown'}
- Last Updated: ${dependencyData.lastUpdated || 'Unknown'}
- Maintainers: ${dependencyData.maintainers?.join(', ') || 'Unknown'}
- Description: ${dependencyData.description || 'No description'}

Please analyze this dependency and provide:
1. Risk level (safe, low, medium, high, critical)
2. Potential threats identified
3. Typosquatting analysis
4. Confidence level (0-1)
5. Brief summary of findings

Focus on detecting:
- Typosquatting attempts
- Malicious packages
- Suspicious maintainer patterns
- Unusual version patterns
- Known vulnerabilities
- Suspicious download patterns

Respond in JSON format:
{
  "riskLevel": "safe|low|medium|high|critical",
  "threats": ["threat1", "threat2"],
  "typosquatting": {
    "isTyposquat": boolean,
    "similarPackages": ["package1", "package2"],
    "confidence": number
  },
  "confidence": number,
  "summary": "brief analysis summary"
}
`

    try {
      const aiResponse = await this.generateResponse(prompt)
      const analysis = this.parseAIResponse(aiResponse.response)
      
      log.info('📦 Dependency analysis completed', { 
        packageName: dependencyData.name,
        riskLevel: analysis.riskLevel,
        isTyposquat: analysis.typosquatting?.isTyposquat
      })

      return analysis
    } catch (error) {
      log.error('❌ Dependency analysis failed', error)
      return this.getFallbackDependencyAnalysis()
    }
  }

  async generateOverallAssessment(jobData) {
    const prompt = `
Provide an overall security assessment for this repository analysis:

Repository: ${jobData.repoUrl}
Project Type: ${jobData.projectType}
Total Commits Analyzed: ${jobData.commits?.length || 0}
Total Dependencies: ${jobData.dependencies?.length || 0}
Total Alerts: ${jobData.alerts?.length || 0}

High-Risk Commits: ${jobData.commits?.filter(c => c.riskScore > 70).length || 0}
Critical Dependencies: ${jobData.dependencies?.filter(d => d.riskLevel === 'critical').length || 0}
Critical Alerts: ${jobData.alerts?.filter(a => a.severity === 'critical').length || 0}

Key Findings:
${jobData.alerts?.slice(0, 5).map(alert => `- ${alert.title}: ${alert.description}`).join('\n') || 'No major alerts'}

Please provide:
1. Overall threat assessment
2. Key security findings
3. Actionable recommendations
4. Confidence level (0-1)
5. Risk prioritization

Respond in JSON format:
{
  "overallThreat": "low|medium|high|critical",
  "keyFindings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "confidence": number,
  "riskPriority": "immediate|high|medium|low"
}
`

    try {
      const aiResponse = await this.generateResponse(prompt)
      const assessment = this.parseAIResponse(aiResponse.response)
      
      log.info('📊 Overall assessment completed', { 
        overallThreat: assessment.overallThreat,
        keyFindings: assessment.keyFindings?.length || 0
      })

      return assessment
    } catch (error) {
      log.error('❌ Overall assessment failed', error)
      return this.getFallbackOverallAssessment()
    }
  }

  parseAIResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      // If no JSON found, return a structured fallback
      log.warn('⚠️ Could not parse AI response as JSON, using fallback')
      return {
        error: 'Could not parse AI response',
        rawResponse: response
      }
    } catch (error) {
      log.error('❌ Error parsing AI response', error)
      return {
        error: 'JSON parse error',
        rawResponse: response
      }
    }
  }

  getFallbackResponse(prompt) {
    return {
      response: 'AI service unavailable - using fallback analysis',
      context: null,
      done: true,
      model: 'fallback'
    }
  }

  getFallbackCommitAnalysis() {
    return {
      riskScore: 25,
      threats: ['AI analysis unavailable'],
      suspiciousPatterns: [],
      confidence: 0.1,
      summary: 'Fallback analysis - AI service unavailable'
    }
  }

  getFallbackDependencyAnalysis() {
    return {
      riskLevel: 'medium',
      threats: ['AI analysis unavailable'],
      typosquatting: {
        isTyposquat: false,
        similarPackages: [],
        confidence: 0.1
      },
      confidence: 0.1,
      summary: 'Fallback analysis - AI service unavailable'
    }
  }

  getFallbackOverallAssessment() {
    return {
      overallThreat: 'medium',
      keyFindings: ['AI analysis unavailable - manual review recommended'],
      recommendations: ['Enable AI service for detailed analysis', 'Perform manual security review'],
      confidence: 0.1,
      riskPriority: 'medium'
    }
  }

  async getServiceStatus() {
    try {
      await this.checkOllamaHealth()
      return {
        status: 'healthy',
        model: this.model,
        available: this.isAvailable,
        ollamaUrl: this.ollamaUrl
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        model: this.model,
        available: false,
        error: error.message,
        ollamaUrl: this.ollamaUrl
      }
    }
  }
}

// Create singleton instance
const aiService = new AIService()

export default aiService
export { AIService }