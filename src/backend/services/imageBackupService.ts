import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database/database'
import logger from './logger'

/**
 * Image backup service
 * Supports multiple backup strategies:
 * 1. WordPress (already implemented via upload)
 * 2. Local backup directory
 * 3. Can be extended for S3, Google Cloud Storage, etc.
 */

interface BackupResult {
  success: boolean
  backupPath?: string
  error?: string
}

// ImageRecord interface - used for type documentation
// interface ImageRecord {
//   id: number
//   filename: string
//   localPath: string
//   wordpressUrl: string | null
//   createdAt: string
// }

// Backup configuration from environment
const BACKUP_DIR = process.env.IMAGE_BACKUP_DIR || './backups/images'
const BACKUP_RETENTION_DAYS = parseInt(process.env.IMAGE_BACKUP_RETENTION_DAYS || '90')

/**
 * Initialize backup directory
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    logger.info('Image backup directory created', { path: BACKUP_DIR })
  }
}

/**
 * Backup a single image to the backup directory
 */
export function backupImage(sourcePath: string): BackupResult {
  try {
    ensureBackupDir()

    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Source file not found' }
    }

    const filename = path.basename(sourcePath)
    const dateDir = new Date().toISOString().split('T')[0]  // YYYY-MM-DD
    const backupSubDir = path.join(BACKUP_DIR, dateDir)

    if (!fs.existsSync(backupSubDir)) {
      fs.mkdirSync(backupSubDir, { recursive: true })
    }

    const backupPath = path.join(backupSubDir, filename)
    fs.copyFileSync(sourcePath, backupPath)

    logger.info('Image backed up', { source: sourcePath, backup: backupPath })
    return { success: true, backupPath }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Image backup failed', { source: sourcePath, error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

/**
 * Backup all images that haven't been backed up yet
 */
export function backupAllNewImages(): {
  total: number
  successful: number
  failed: number
  results: Array<{ filename: string; success: boolean; error?: string }>
} {
  const db = getDatabase()
  ensureBackupDir()

  // Get all images from database
  const images = db.prepare(`
    SELECT id, filename, local_path, wordpress_url, created_at
    FROM images
    ORDER BY created_at DESC
  `).all() as Array<{
    id: number
    filename: string
    local_path: string
    wordpress_url: string | null
    created_at: string
  }>

  const results: Array<{ filename: string; success: boolean; error?: string }> = []
  let successful = 0
  let failed = 0

  for (const image of images) {
    // Check if already backed up today
    const dateDir = image.created_at.split('T')[0]
    const expectedBackupPath = path.join(BACKUP_DIR, dateDir, image.filename)

    if (fs.existsSync(expectedBackupPath)) {
      // Already backed up
      continue
    }

    // Try to backup
    if (fs.existsSync(image.local_path)) {
      const result = backupImage(image.local_path)
      if (result.success) {
        successful++
        results.push({ filename: image.filename, success: true })
      } else {
        failed++
        results.push({ filename: image.filename, success: false, error: result.error })
      }
    } else {
      failed++
      results.push({ filename: image.filename, success: false, error: 'Source file not found' })
    }
  }

  logger.info('Batch image backup completed', { total: images.length, successful, failed })
  return { total: images.length, successful, failed, results }
}

/**
 * Clean up old backups beyond retention period
 */
export function cleanupOldBackups(): {
  deleted: number
  freedBytes: number
} {
  ensureBackupDir()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS)
  const cutoffStr = cutoffDate.toISOString().split('T')[0]

  let deleted = 0
  let freedBytes = 0

  try {
    const dateDirs = fs.readdirSync(BACKUP_DIR)

    for (const dateDir of dateDirs) {
      // Skip if not a date directory (YYYY-MM-DD format)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) continue

      if (dateDir < cutoffStr) {
        const dirPath = path.join(BACKUP_DIR, dateDir)
        const stats = fs.statSync(dirPath)

        if (stats.isDirectory()) {
          // Sum up file sizes before deletion
          const files = fs.readdirSync(dirPath)
          for (const file of files) {
            const filePath = path.join(dirPath, file)
            const fileStats = fs.statSync(filePath)
            freedBytes += fileStats.size
            deleted++
          }

          // Remove directory and contents
          fs.rmSync(dirPath, { recursive: true })
          logger.info('Old backup directory removed', { dir: dirPath })
        }
      }
    }
  } catch (error) {
    logger.error('Backup cleanup failed', { error: error instanceof Error ? error.message : String(error) })
  }

  logger.info('Backup cleanup completed', { deleted, freedBytes, retentionDays: BACKUP_RETENTION_DAYS })
  return { deleted, freedBytes }
}

/**
 * Get backup statistics
 */
export function getBackupStats(): {
  totalBackups: number
  totalSize: number
  oldestBackup: string | null
  newestBackup: string | null
  backupsByDate: Array<{ date: string; count: number; size: number }>
} {
  ensureBackupDir()

  let totalBackups = 0
  let totalSize = 0
  let oldestBackup: string | null = null
  let newestBackup: string | null = null
  const backupsByDate: Array<{ date: string; count: number; size: number }> = []

  try {
    const dateDirs = fs.readdirSync(BACKUP_DIR).sort()

    for (const dateDir of dateDirs) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) continue

      const dirPath = path.join(BACKUP_DIR, dateDir)
      const stats = fs.statSync(dirPath)

      if (stats.isDirectory()) {
        const files = fs.readdirSync(dirPath)
        let dateSize = 0

        for (const file of files) {
          const filePath = path.join(dirPath, file)
          const fileStats = fs.statSync(filePath)
          dateSize += fileStats.size
          totalBackups++
        }

        totalSize += dateSize
        backupsByDate.push({ date: dateDir, count: files.length, size: dateSize })

        if (!oldestBackup) oldestBackup = dateDir
        newestBackup = dateDir
      }
    }
  } catch (error) {
    logger.error('Failed to get backup stats', { error: error instanceof Error ? error.message : String(error) })
  }

  return {
    totalBackups,
    totalSize,
    oldestBackup,
    newestBackup,
    backupsByDate
  }
}

/**
 * Restore an image from backup
 */
export function restoreImage(filename: string, targetPath?: string): BackupResult {
  ensureBackupDir()

  try {
    // Search for the file in backup directories
    const dateDirs = fs.readdirSync(BACKUP_DIR).sort().reverse()  // Most recent first

    for (const dateDir of dateDirs) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) continue

      const backupPath = path.join(BACKUP_DIR, dateDir, filename)

      if (fs.existsSync(backupPath)) {
        const restorePath = targetPath || path.join('./generated_images', filename)

        // Ensure target directory exists
        const targetDir = path.dirname(restorePath)
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }

        fs.copyFileSync(backupPath, restorePath)
        logger.info('Image restored from backup', { source: backupPath, target: restorePath })
        return { success: true, backupPath: restorePath }
      }
    }

    return { success: false, error: 'Backup not found' }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Image restore failed', { filename, error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

/**
 * Verify backup integrity by checking WordPress URLs
 */
export function verifyBackupIntegrity(): {
  total: number
  hasWordPressBackup: number
  hasLocalBackup: number
  missingBoth: number
  missingImages: Array<{ id: number; filename: string }>
} {
  const db = getDatabase()

  const images = db.prepare(`
    SELECT id, filename, local_path, wordpress_url
    FROM images
  `).all() as Array<{
    id: number
    filename: string
    local_path: string
    wordpress_url: string | null
  }>

  let hasWordPressBackup = 0
  let hasLocalBackup = 0
  let missingBoth = 0
  const missingImages: Array<{ id: number; filename: string }> = []

  for (const image of images) {
    const hasWP = image.wordpress_url && image.wordpress_url.includes('wordpress.com')
    const hasLocal = fs.existsSync(image.local_path)

    // Check backup directories too
    let hasBackup = false
    const dateDirs = fs.readdirSync(BACKUP_DIR).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    for (const dateDir of dateDirs) {
      if (fs.existsSync(path.join(BACKUP_DIR, dateDir, image.filename))) {
        hasBackup = true
        break
      }
    }

    if (hasWP) hasWordPressBackup++
    if (hasLocal || hasBackup) hasLocalBackup++

    if (!hasWP && !hasLocal && !hasBackup) {
      missingBoth++
      missingImages.push({ id: image.id, filename: image.filename })
    }
  }

  return {
    total: images.length,
    hasWordPressBackup,
    hasLocalBackup,
    missingBoth,
    missingImages
  }
}
