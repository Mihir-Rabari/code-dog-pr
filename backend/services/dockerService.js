import Docker from 'dockerode'
import fs from 'fs-extra'
import path from 'path'

const log = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [DOCKER-SERVICE-INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [DOCKER-SERVICE-ERROR] ${message}`, error ? error.stack || error : '')
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [DOCKER-SERVICE-WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

class DockerService {
  constructor() {
    this.docker = new Docker()
    this.activeContainers = new Map()
    this.imagePrefix = 'codedog'
    this.networkName = 'codedog-isolated'
    this.initializeService()
  }

  async initializeService() {
    try {
      log.info('🐳 Initializing Docker service...')
      
      // Check Docker connectivity
      await this.checkDockerHealth()
      
      // Ensure images are built
      await this.ensureImagesExist()
      
      // Create isolated network
      await this.ensureNetworkExists()
      
      log.info('✅ Docker service initialized successfully')
    } catch (error) {
      log.error('❌ Failed to initialize Docker service', error)
      throw error
    }
  }

  async checkDockerHealth() {
    try {
      const info = await this.docker.info()
      log.info('🏥 Docker health check passed', {
        containers: info.Containers,
        images: info.Images,
        version: info.ServerVersion
      })
      return true
    } catch (error) {
      log.error('💥 Docker health check failed', error)
      throw new Error('Docker service is not available')
    }
  }

  async ensureImagesExist() {
    try {
      const requiredImages = [
        `${this.imagePrefix}-node:latest`,
        `${this.imagePrefix}-python:latest`
      ]

      for (const imageName of requiredImages) {
        try {
          const image = this.docker.getImage(imageName)
          await image.inspect()
          log.info(`✅ Image exists: ${imageName}`)
        } catch (error) {
          log.warn(`⚠️ Image not found: ${imageName}, will build when needed`)
        }
      }
    } catch (error) {
      log.error('❌ Error checking images', error)
    }
  }

  async ensureNetworkExists() {
    try {
      // Check if network exists
      const networks = await this.docker.listNetworks()
      const networkExists = networks.some(network => network.Name === this.networkName)

      if (!networkExists) {
        log.info(`🌐 Creating isolated network: ${this.networkName}`)
        await this.docker.createNetwork({
          Name: this.networkName,
          Driver: 'bridge',
          Internal: true, // No external connectivity
          Options: {
            'com.docker.network.bridge.enable_icc': 'false'
          }
        })
        log.info(`✅ Network created: ${this.networkName}`)
      } else {
        log.info(`✅ Network exists: ${this.networkName}`)
      }
    } catch (error) {
      log.error('❌ Failed to ensure network exists', error)
    }
  }

  async buildImage(projectType) {
    try {
      const imageName = `${this.imagePrefix}-${projectType}:latest`
      const dockerfilePath = path.join(process.cwd(), 'docker', `Dockerfile.${projectType}`)
      
      log.info(`🔨 Building Docker image: ${imageName}`)

      if (!await fs.pathExists(dockerfilePath)) {
        throw new Error(`Dockerfile not found: ${dockerfilePath}`)
      }

      const buildContext = path.join(process.cwd(), 'docker')
      const tarStream = await this.createBuildContext(buildContext)

      const stream = await this.docker.buildImage(tarStream, {
        t: imageName,
        dockerfile: `Dockerfile.${projectType}`,
        rm: true,
        forcerm: true
      })

      // Wait for build to complete
      await new Promise((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) {
            reject(err)
          } else {
            resolve(res)
          }
        }, (event) => {
          if (event.stream) {
            log.info(`🔨 Build: ${event.stream.trim()}`)
          }
        })
      })

      log.info(`✅ Image built successfully: ${imageName}`)
      return imageName
    } catch (error) {
      log.error(`❌ Failed to build image for ${projectType}`, error)
      throw error
    }
  }

  async createBuildContext(contextPath) {
    const tar = require('tar-stream')
    const pack = tar.pack()

    const addToTar = async (filePath, arcname) => {
      const stats = await fs.stat(filePath)
      if (stats.isFile()) {
        const content = await fs.readFile(filePath)
        pack.entry({ name: arcname, size: content.length }, content)
      } else if (stats.isDirectory()) {
        const files = await fs.readdir(filePath)
        for (const file of files) {
          await addToTar(path.join(filePath, file), path.join(arcname, file))
        }
      }
    }

    await addToTar(contextPath, '.')
    pack.finalize()

    return pack
  }

  async createAnalysisContainer(projectType, workspacePath, jobId) {
    try {
      const imageName = `${this.imagePrefix}-${projectType}:latest`
      
      log.info('🐳 Creating analysis container...', {
        image: imageName,
        workspace: workspacePath,
        jobId
      })

      // Ensure image exists, build if necessary
      try {
        const image = this.docker.getImage(imageName)
        await image.inspect()
      } catch (error) {
        log.info(`📦 Image not found, building: ${imageName}`)
        await this.buildImage(projectType)
      }

      // Container configuration
      const containerConfig = {
        Image: imageName,
        name: `codedog-analysis-${jobId}`,
        WorkingDir: '/workspace',
        Cmd: ['/bin/bash', '-c', 'sleep 3600'], // Keep container alive
        Env: [
          'ANALYSIS_MODE=security',
          `JOB_ID=${jobId}`,
          `PROJECT_TYPE=${projectType}`
        ],
        HostConfig: {
          // Security restrictions
          Memory: 512 * 1024 * 1024, // 512MB limit
          CpuShares: 512, // Limited CPU
          NetworkMode: this.networkName, // Isolated network
          ReadonlyRootfs: false, // Allow writes to /workspace
          SecurityOpt: ['no-new-privileges:true'],
          CapDrop: ['ALL'],
          CapAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID'],
          
          // Mount workspace
          Binds: [
            `${workspacePath}:/workspace:rw`
          ],
          
          // Resource limits
          Ulimits: [
            { Name: 'nofile', Soft: 1024, Hard: 1024 },
            { Name: 'nproc', Soft: 64, Hard: 64 }
          ],
          
          // Prevent container from accessing host network
          ExtraHosts: [],
          Dns: [], // No DNS resolution
          
          // Auto-remove container when stopped
          AutoRemove: true
        },
        
        // Labels for identification
        Labels: {
          'codedog.job-id': jobId,
          'codedog.project-type': projectType,
          'codedog.created': new Date().toISOString()
        }
      }

      const container = await this.docker.createContainer(containerConfig)
      
      // Store container reference
      this.activeContainers.set(jobId, {
        container,
        projectType,
        created: new Date(),
        workspacePath
      })

      log.info('✅ Analysis container created', {
        containerId: container.id.substring(0, 12),
        jobId
      })

      return container
    } catch (error) {
      log.error('❌ Failed to create analysis container', error)
      throw error
    }
  }

  async startContainer(container) {
    try {
      log.info('▶️ Starting container...', { containerId: container.id.substring(0, 12) })
      
      await container.start()
      
      // Wait for container to be ready
      await this.waitForContainer(container, 10000) // 10 second timeout
      
      log.info('✅ Container started successfully')
      return true
    } catch (error) {
      log.error('❌ Failed to start container', error)
      throw error
    }
  }

  async waitForContainer(container, timeout = 10000) {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      try {
        const info = await container.inspect()
        if (info.State.Running) {
          return true
        }
      } catch (error) {
        // Container might not be ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    throw new Error('Container failed to start within timeout')
  }

  async executeCommand(container, command, options = {}) {
    try {
      log.info('⚡ Executing command in container...', {
        containerId: container.id.substring(0, 12),
        command: Array.isArray(command) ? command.join(' ') : command
      })

      const execOptions = {
        Cmd: Array.isArray(command) ? command : ['/bin/bash', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        User: 'analyst', // Run as non-root user
        WorkingDir: '/workspace',
        ...options
      }

      const exec = await container.exec(execOptions)
      const stream = await exec.start({ hijack: true, stdin: false })

      // Collect output
      let stdout = ''
      let stderr = ''

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Command execution timeout'))
        }, 300000) // 5 minute timeout

        container.modem.demuxStream(stream, 
          // stdout
          (chunk) => {
            stdout += chunk.toString()
          },
          // stderr
          (chunk) => {
            stderr += chunk.toString()
          }
        )

        stream.on('end', async () => {
          clearTimeout(timeout)
          
          try {
            const result = await exec.inspect()
            
            log.info('✅ Command executed', {
              exitCode: result.ExitCode,
              stdoutLength: stdout.length,
              stderrLength: stderr.length
            })

            resolve({
              exitCode: result.ExitCode,
              stdout,
              stderr
            })
          } catch (error) {
            reject(error)
          }
        })

        stream.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    } catch (error) {
      log.error('❌ Command execution failed', error)
      throw error
    }
  }

  async runAnalysis(container, projectType) {
    try {
      log.info('🔍 Running security analysis...', { projectType })

      // Run the analysis script
      const result = await this.executeCommand(container, '/usr/local/bin/analyze')

      if (result.exitCode !== 0) {
        log.warn('⚠️ Analysis script returned non-zero exit code', {
          exitCode: result.exitCode,
          stderr: result.stderr
        })
      }

      // Read analysis results
      const outputFiles = [
        'analysis-output/summary.txt',
        'analysis-output/dependencies.txt',
        'analysis-output/suspicious-patterns.txt',
        'analysis-output/vulnerability-scan.txt'
      ]

      const analysisResults = {}

      for (const file of outputFiles) {
        try {
          const fileResult = await this.executeCommand(container, `cat ${file}`)
          if (fileResult.exitCode === 0) {
            analysisResults[file] = fileResult.stdout
          }
        } catch (error) {
          log.warn(`⚠️ Could not read analysis file: ${file}`)
        }
      }

      log.info('✅ Analysis completed', {
        filesRead: Object.keys(analysisResults).length,
        totalOutput: Object.values(analysisResults).join('').length
      })

      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        analysisResults
      }
    } catch (error) {
      log.error('❌ Analysis execution failed', error)
      throw error
    }
  }

  async stopContainer(jobId) {
    try {
      const containerInfo = this.activeContainers.get(jobId)
      if (!containerInfo) {
        log.warn('⚠️ Container not found for cleanup', { jobId })
        return
      }

      const { container } = containerInfo
      
      log.info('🛑 Stopping container...', {
        containerId: container.id.substring(0, 12),
        jobId
      })

      try {
        await container.stop({ t: 10 }) // 10 second grace period
        log.info('✅ Container stopped')
      } catch (error) {
        if (error.statusCode === 304) {
          log.info('ℹ️ Container was already stopped')
        } else {
          throw error
        }
      }

      // Remove from active containers
      this.activeContainers.delete(jobId)
      
    } catch (error) {
      log.error('❌ Failed to stop container', error)
    }
  }

  async cleanup(jobId) {
    try {
      await this.stopContainer(jobId)
      
      // Additional cleanup if needed
      log.info('🧹 Container cleanup completed', { jobId })
    } catch (error) {
      log.error('❌ Cleanup failed', error)
    }
  }

  async getContainerStats(jobId) {
    try {
      const containerInfo = this.activeContainers.get(jobId)
      if (!containerInfo) {
        return null
      }

      const { container } = containerInfo
      const stats = await container.stats({ stream: false })
      
      return {
        memory: stats.memory_stats,
        cpu: stats.cpu_stats,
        network: stats.networks,
        created: containerInfo.created
      }
    } catch (error) {
      log.error('❌ Failed to get container stats', error)
      return null
    }
  }

  async listActiveContainers() {
    const containers = []
    
    for (const [jobId, info] of this.activeContainers.entries()) {
      try {
        const containerInfo = await info.container.inspect()
        containers.push({
          jobId,
          containerId: info.container.id.substring(0, 12),
          projectType: info.projectType,
          created: info.created,
          state: containerInfo.State,
          workspacePath: info.workspacePath
        })
      } catch (error) {
        log.warn('⚠️ Failed to inspect container', { jobId })
      }
    }
    
    return containers
  }

  async getServiceStatus() {
    try {
      const dockerInfo = await this.docker.info()
      const activeContainers = await this.listActiveContainers()
      
      return {
        status: 'healthy',
        dockerVersion: dockerInfo.ServerVersion,
        activeContainers: activeContainers.length,
        totalContainers: dockerInfo.Containers,
        images: dockerInfo.Images,
        network: this.networkName
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      }
    }
  }
}

// Create singleton instance
const dockerService = new DockerService()

export default dockerService
export { DockerService }