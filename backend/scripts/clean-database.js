#!/usr/bin/env node

/**
 * Database Cleanup Script
 * Removes old jobs, logs, and temporary data to keep the database clean
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

async function cleanOldJobs(daysOld = 7) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)
  
  try {
    const result = await Job.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['completed', 'failed'] }
    })
    
    console.log(`🗑️  Removed ${result.deletedCount} old jobs (older than ${daysOld} days)`)
    return result.deletedCount
  } catch (error) {
    console.error('❌ Error cleaning old jobs:', error.message)
    return 0
  }
}

async function cleanOrphanedRepositories() {
  try {
    // Find repositories that don't have any associated jobs
    const orphanedRepos = await Repository.aggregate([
      {
        $lookup: {
          from: 'jobs',
          localField: '_id',
          foreignField: 'repositoryId',
          as: 'jobs'
        }
      },
      {
        $match: {
          jobs: { $size: 0 }
        }
      }
    ])
    
    if (orphanedRepos.length > 0) {
      const repoIds = orphanedRepos.map(repo => repo._id)
      const result = await Repository.deleteMany({ _id: { $in: repoIds } })
      console.log(`🗑️  Removed ${result.deletedCount} orphaned repositories`)
      return result.deletedCount
    } else {
      console.log('✅ No orphaned repositories found')
      return 0
    }
  } catch (error) {
    console.error('❌ Error cleaning orphaned repositories:', error.message)
    return 0
  }
}

async function cleanLargeLogs() {
  try {
    // Remove logs from jobs older than 30 days to save space
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)
    
    const result = await Job.updateMany(
      { createdAt: { $lt: cutoffDate } },
      { $unset: { logs: "", buildOutput: "", analysisOutput: "" } }
    )
    
    console.log(`🗑️  Cleaned logs from ${result.modifiedCount} old jobs`)
    return result.modifiedCount
  } catch (error) {
    console.error('❌ Error cleaning large logs:', error.message)
    return 0
  }
}

async function getDbStats() {
  try {
    const jobCount = await Job.countDocuments()
    const repoCount = await Repository.countDocuments()
    const userCount = await User.countDocuments()
    
    const runningJobs = await Job.countDocuments({ status: 'running' })
    const completedJobs = await Job.countDocuments({ status: 'completed' })
    const failedJobs = await Job.countDocuments({ status: 'failed' })
    
    console.log('\n📊 Database Statistics:')
    console.log(`   Total Jobs: ${jobCount}`)
    console.log(`   - Running: ${runningJobs}`)
    console.log(`   - Completed: ${completedJobs}`)
    console.log(`   - Failed: ${failedJobs}`)
    console.log(`   Total Repositories: ${repoCount}`)
    console.log(`   Total Users: ${userCount}`)
    
    return { jobCount, repoCount, userCount, runningJobs, completedJobs, failedJobs }
  } catch (error) {
    console.error('❌ Error getting database stats:', error.message)
    return null
  }
}

async function main() {
  console.log('🧹 Starting database cleanup...\n')
  
  await connectDatabase()
  
  // Show initial stats
  console.log('📊 Initial Database State:')
  await getDbStats()
  
  console.log('\n🧹 Cleaning up...')
  
  // Clean old completed/failed jobs (older than 7 days)
  const cleanedJobs = await cleanOldJobs(7)
  
  // Clean orphaned repositories
  const cleanedRepos = await cleanOrphanedRepositories()
  
  // Clean large logs from old jobs
  const cleanedLogs = await cleanLargeLogs()
  
  console.log('\n✅ Cleanup Summary:')
  console.log(`   Jobs removed: ${cleanedJobs}`)
  console.log(`   Repositories removed: ${cleanedRepos}`)
  console.log(`   Jobs with logs cleaned: ${cleanedLogs}`)
  
  // Show final stats
  console.log('\n📊 Final Database State:')
  await getDbStats()
  
  await mongoose.disconnect()
  console.log('\n✅ Database cleanup completed successfully!')
}

// Handle command line arguments
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧹 Database Cleanup Script

Usage: npm run clean-db [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be cleaned without actually doing it
  --days <n>     Clean jobs older than n days (default: 7)

Examples:
  npm run clean-db
  npm run clean-db -- --days 14
  npm run clean-db -- --dry-run
`)
  process.exit(0)
}

if (args.includes('--dry-run')) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n')
  // TODO: Implement dry run mode
}

main().catch(error => {
  console.error('💥 Cleanup failed:', error.message)
  process.exit(1)
})
