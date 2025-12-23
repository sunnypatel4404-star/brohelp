import { getDatabase } from '../database/database'
import { jobLogger } from './logger'

// Database row interface (snake_case as returned by SQLite)
interface RetryEntryRow {
  id: number
  job_id: string
  retry_count: number
  max_retries: number
  next_retry_at: string | null
  last_error: string | null
  created_at: string
}

// Converted interface (camelCase for application use)
interface RetryEntry {
  id: number
  jobId: string
  retryCount: number
  maxRetries: number
  nextRetryAt: string | null
  lastError: string | null
  createdAt: string
}

// Convert database row to RetryEntry
function rowToRetryEntry(row: RetryEntryRow): RetryEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    nextRetryAt: row.next_retry_at,
    lastError: row.last_error,
    createdAt: row.created_at
  }
}

interface RetryConfig {
  maxRetries?: number
  baseDelayMs?: number  // Base delay for exponential backoff
  maxDelayMs?: number   // Maximum delay between retries
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 30000,      // 30 seconds
  maxDelayMs: 300000       // 5 minutes
}

/**
 * Calculate next retry time using exponential backoff with jitter
 */
function calculateNextRetryTime(retryCount: number, config: Required<RetryConfig>): Date {
  // Exponential backoff: delay = baseDelay * 2^retryCount
  let delay = config.baseDelayMs * Math.pow(2, retryCount)

  // Cap at max delay
  delay = Math.min(delay, config.maxDelayMs)

  // Ensure delay is a valid number
  if (!isFinite(delay) || isNaN(delay)) {
    delay = config.baseDelayMs
  }

  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1)
  delay += jitter

  // Ensure final delay is positive
  delay = Math.max(delay, 1000)

  return new Date(Date.now() + Math.floor(delay))
}

/**
 * Add a failed job to the retry queue
 */
export function queueForRetry(
  jobId: string,
  error: string,
  config: RetryConfig = {}
): { queued: boolean; nextRetryAt?: string; retryCount?: number; reason?: string } {
  const db = getDatabase()
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const now = new Date().toISOString()

  // Check if job is already in retry queue
  const existingRow = db.prepare(`
    SELECT * FROM job_retries WHERE job_id = ?
  `).get(jobId) as RetryEntryRow | undefined
  const existing = existingRow ? rowToRetryEntry(existingRow) : undefined

  if (existing) {
    // Check if we've exceeded max retries (use stored max_retries, not config)
    if (existing.retryCount >= existing.maxRetries) {
      jobLogger.warn('Job exceeded max retries', { jobId, retryCount: existing.retryCount, maxRetries: existing.maxRetries })
      return { queued: false, reason: 'Max retries exceeded' }
    }

    // Update retry entry
    const nextRetry = calculateNextRetryTime(existing.retryCount + 1, cfg)
    db.prepare(`
      UPDATE job_retries
      SET retry_count = retry_count + 1,
          next_retry_at = ?,
          last_error = ?
      WHERE job_id = ?
    `).run(nextRetry.toISOString(), error, jobId)

    jobLogger.info('Job queued for retry', {
      jobId,
      retryCount: existing.retryCount + 1,
      nextRetryAt: nextRetry.toISOString()
    })

    return {
      queued: true,
      nextRetryAt: nextRetry.toISOString(),
      retryCount: existing.retryCount + 1
    }
  }

  // Create new retry entry
  const nextRetry = calculateNextRetryTime(0, cfg)
  db.prepare(`
    INSERT INTO job_retries (job_id, retry_count, max_retries, next_retry_at, last_error, created_at)
    VALUES (?, 0, ?, ?, ?, ?)
  `).run(jobId, cfg.maxRetries, nextRetry.toISOString(), error, now)

  jobLogger.info('Job added to retry queue', {
    jobId,
    retryCount: 0,
    nextRetryAt: nextRetry.toISOString()
  })

  return { queued: true, nextRetryAt: nextRetry.toISOString(), retryCount: 0 }
}

/**
 * Get jobs that are due for retry
 */
export function getJobsDueForRetry(): RetryEntry[] {
  const db = getDatabase()
  const now = new Date().toISOString()

  const rows = db.prepare(`
    SELECT jr.*, j.status as job_status
    FROM job_retries jr
    JOIN jobs j ON j.id = jr.job_id
    WHERE jr.next_retry_at <= ?
    AND jr.retry_count < jr.max_retries
    AND j.status = 'failed'
    ORDER BY jr.next_retry_at ASC
    LIMIT 10
  `).all(now) as (RetryEntry & { job_status: string })[]

  return rows
}

/**
 * Mark a retry as successful (remove from queue)
 */
export function markRetrySuccessful(jobId: string): void {
  const db = getDatabase()
  db.prepare(`DELETE FROM job_retries WHERE job_id = ?`).run(jobId)
  jobLogger.info('Retry successful, removed from queue', { jobId })
}

/**
 * Get retry status for a job
 */
export function getRetryStatus(jobId: string): RetryEntry | null {
  const db = getDatabase()
  const row = db.prepare(`SELECT * FROM job_retries WHERE job_id = ?`).get(jobId)
  return row as RetryEntry | null
}

/**
 * Get all pending retries
 */
export function getPendingRetries(): RetryEntry[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT jr.*, j.topic, j.status as job_status
    FROM job_retries jr
    JOIN jobs j ON j.id = jr.job_id
    WHERE jr.retry_count < jr.max_retries
    ORDER BY jr.next_retry_at ASC
  `).all()
  return rows as RetryEntry[]
}

/**
 * Clear all retries for a job (manual cancellation)
 */
export function cancelRetries(jobId: string): boolean {
  const db = getDatabase()
  const result = db.prepare(`DELETE FROM job_retries WHERE job_id = ?`).run(jobId)
  if (result.changes > 0) {
    jobLogger.info('Retries cancelled for job', { jobId })
    return true
  }
  return false
}

/**
 * Get retry queue statistics
 */
export function getRetryQueueStats(): {
  pending: number
  dueNow: number
  exhausted: number
} {
  const db = getDatabase()
  const now = new Date().toISOString()

  const pending = db.prepare(`
    SELECT COUNT(*) as count FROM job_retries
    WHERE retry_count < max_retries
  `).get() as { count: number }

  const dueNow = db.prepare(`
    SELECT COUNT(*) as count FROM job_retries
    WHERE next_retry_at <= ? AND retry_count < max_retries
  `).get(now) as { count: number }

  const exhausted = db.prepare(`
    SELECT COUNT(*) as count FROM job_retries
    WHERE retry_count >= max_retries
  `).get() as { count: number }

  return {
    pending: pending.count,
    dueNow: dueNow.count,
    exhausted: exhausted.count
  }
}
