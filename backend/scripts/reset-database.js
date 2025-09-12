#!/usr/bin/env node

/**
 * Database Reset Script
 * Completely resets the database by removing all data
 * USE WITH CAUTION - This will delete ALL data!
 */

import mongoose from 'mongoose'
import { Job } from '../models/Job.js'
import { Repository } from '../models/Repository.js'
import { User } from '../models/User.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codedog'

async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB')
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message)
    process.exit(1)
  }
}

async function resetDatabase() {
  try {
    console.log('🗑️  Dropping all collections...')
    
    // Drop all collections
    const collections = await mongoose.connection.db.listCollections().toArray()
    
    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name)
      console.log(`   ✅ Dropped collection: ${collection.name}`)
    }
    
    console.log('\n🔄 Recreating indexes...')
    
    // Recreate indexes by ensuring models
    await Job.createIndexes()
    await Repository.createIndexes()
    await User.createIndexes()
    
    console.log('   ✅ Indexes recreated')
    
    return true
  } catch (error) {
    console.error('❌ Error resetting database:', error.message)
    return false
  }
}

async function seedSampleData() {
  try {
    console.log('🌱 Seeding sample data...')
    
    // Create sample user
    const sampleUser = new User({
      username: 'demo-user',
      email: 'demo@codedog.com',
      role: 'user'
    })
    await sampleUser.save()
    
    // Create sample repository
    const sampleRepo = new Repository({
      url: 'https://github.com/example/sample-repo',
      name: 'sample-repo',
      owner: 'example',
      language: 'JavaScript',
      stars: 42,
      lastAnalyzed: new Date()
    })
    await sampleRepo.save()
    
    // Create sample job
    const sampleJob = new Job({
      jobId: 'job_sample_demo_123',
      repositoryId: sampleRepo._id,
      userId: sampleUser._id,
      repoUrl: sampleRepo.url,
      projectType: 'nodejs',
      status: 'completed',
      riskScore: 65,
      riskLevel: 'medium',
      startTime: new Date(Date.now() - 300000), // 5 minutes ago
      endTime: new Date(),
      logs: [
        {
          timestamp: new Date(Date.now() - 300000),
          level: 'info',
          source: 'system',
          message: '🚀 Starting analysis for sample repository'
        },
        {
          timestamp: new Date(Date.now() - 240000),
          level: 'info',
          source: 'build',
          message: '📦 Repository cloned successfully'
        },
        {
          timestamp: new Date(Date.now() - 180000),
          level: 'warn',
          source: 'analysis',
          message: '⚠️ Found 2 dependencies with known vulnerabilities'
        },
        {
          timestamp: new Date(Date.now() - 120000),
          level: 'info',
          source: 'ai',
          message: '🧠 AI analysis completed'
        },
        {
          timestamp: new Date(),
          level: 'info',
          source: 'system',
          message: '✅ Analysis completed successfully'
        }
      ],
      alerts: [
        {
          id: 'alert_sample_1',
          type: 'dependency',
          severity: 'medium',
          title: 'Outdated Dependency',
          description: 'lodash@4.17.20 has newer versions available',
          timestamp: new Date(Date.now() - 120000),
          aiConfidence: 0.85
        }
      ],
      commits: [
        {
          hash: 'abc123def456',
          author: 'demo-user',
          message: 'Initial commit',
          date: new Date(Date.now() - 86400000),
          riskScore: 25,
          additions: 150,
          deletions: 0,
          filesChanged: ['package.json', 'index.js', 'README.md']
        }
      ],
      dependencies: [
        {
          name: 'express',
          version: '4.18.2',
          riskLevel: 'low',
          vulnerabilities: 0,
          lastUpdated: '2023-01-15'
        },
        {
          name: 'lodash',
          version: '4.17.20',
          riskLevel: 'medium',
          vulnerabilities: 0,
          lastUpdated: '2021-02-20'
        }
      ]
    })
    await sampleJob.save()
    
    console.log('   ✅ Sample data created:')
    console.log(`      - User: ${sampleUser.username}`)
    console.log(`      - Repository: ${sampleRepo.name}`)
    console.log(`      - Job: ${sampleJob.jobId}`)
    
    return true
  } catch (error) {
    console.error('❌ Error seeding sample data:', error.message)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔄 Database Reset Script

⚠️  WARNING: This will DELETE ALL DATA in the database!

Usage: npm run reset-db [options]

Options:
  --help, -h        Show this help message
  --confirm         Required flag to confirm you want to reset
  --no-seed         Don't create sample data after reset

Examples:
  npm run reset-db -- --confirm
  npm run reset-db -- --confirm --no-seed
`)
    process.exit(0)
  }
  
  if (!args.includes('--confirm')) {
    console.log(`
⚠️  WARNING: This will DELETE ALL DATA in the database!

To proceed, run with --confirm flag:
npm run reset-db -- --confirm

Use --help for more options.
`)
    process.exit(1)
  }
  
  console.log('🔄 Starting database reset...\n')
  console.log('⚠️  WARNING: This will DELETE ALL DATA!\n')
  
  await connectDatabase()
  
  // Reset the database
  const resetSuccess = await resetDatabase()
  if (!resetSuccess) {
    console.error('💥 Database reset failed!')
    process.exit(1)
  }
  
  // Seed sample data unless --no-seed is specified
  if (!args.includes('--no-seed')) {
    const seedSuccess = await seedSampleData()
    if (!seedSuccess) {
      console.warn('⚠️  Sample data seeding failed, but database was reset')
    }
  }
  
  await mongoose.disconnect()
  console.log('\n✅ Database reset completed successfully!')
  console.log('\n🎯 You can now start fresh with a clean database.')
  
  if (!args.includes('--no-seed')) {
    console.log('\n📝 Sample data has been created for testing:')
    console.log('   - Demo user and repository')
    console.log('   - Sample analysis job with logs')
    console.log('   - Visit the dashboard to see the demo data')
  }
}

main().catch(error => {
  console.error('💥 Reset failed:', error.message)
  process.exit(1)
})
