import { getDatabase } from '../database/database'
import logger from './logger'

export interface ScheduledContent {
  id: number
  topic: string
  scheduledAt: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  jobId: string | null
  createdAt: string
  executedAt: string | null
  error: string | null
  recurrence: string | null  // 'daily', 'weekly', 'monthly', or cron expression
}

interface ScheduleOptions {
  recurrence?: 'daily' | 'weekly' | 'monthly' | null
}

/**
 * Schedule content for future generation
 */
export function scheduleContent(
  topic: string,
  scheduledAt: Date | string,
  options: ScheduleOptions = {}
): ScheduledContent {
  const db = getDatabase()
  const now = new Date().toISOString()
  const scheduleTime = typeof scheduledAt === 'string' ? scheduledAt : scheduledAt.toISOString()

  const result = db.prepare(`
    INSERT INTO scheduled_content (topic, scheduled_at, status, created_at, recurrence)
    VALUES (?, ?, 'pending', ?, ?)
  `).run(topic, scheduleTime, now, options.recurrence || null)

  logger.info('Content scheduled', {
    id: result.lastInsertRowid,
    topic,
    scheduledAt: scheduleTime,
    recurrence: options.recurrence
  })

  return {
    id: result.lastInsertRowid as number,
    topic,
    scheduledAt: scheduleTime,
    status: 'pending',
    jobId: null,
    createdAt: now,
    executedAt: null,
    error: null,
    recurrence: options.recurrence || null
  }
}

/**
 * Get content due for execution
 */
export function getContentDueForExecution(): ScheduledContent[] {
  const db = getDatabase()
  const now = new Date().toISOString()

  const rows = db.prepare(`
    SELECT * FROM scheduled_content
    WHERE scheduled_at <= ?
    AND status = 'pending'
    ORDER BY scheduled_at ASC
    LIMIT 10
  `).all(now) as Array<{
    id: number
    topic: string
    scheduled_at: string
    status: string
    job_id: string | null
    created_at: string
    executed_at: string | null
    error: string | null
    recurrence: string | null
  }>

  return rows.map(row => ({
    id: row.id,
    topic: row.topic,
    scheduledAt: row.scheduled_at,
    status: row.status as ScheduledContent['status'],
    jobId: row.job_id,
    createdAt: row.created_at,
    executedAt: row.executed_at,
    error: row.error,
    recurrence: row.recurrence
  }))
}

/**
 * Mark scheduled content as processing
 */
export function markAsProcessing(id: number, jobId: string): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE scheduled_content
    SET status = 'processing', job_id = ?
    WHERE id = ?
  `).run(jobId, id)
}

/**
 * Mark scheduled content as completed
 */
export function markAsCompleted(id: number): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Get the current entry to check for recurrence
  const entry = db.prepare(`SELECT * FROM scheduled_content WHERE id = ?`).get(id) as {
    topic: string
    recurrence: string | null
  } | undefined

  db.prepare(`
    UPDATE scheduled_content
    SET status = 'completed', executed_at = ?
    WHERE id = ?
  `).run(now, id)

  // If recurring, create the next occurrence
  if (entry?.recurrence) {
    const nextSchedule = calculateNextOccurrence(new Date(), entry.recurrence)
    if (nextSchedule) {
      scheduleContent(entry.topic, nextSchedule, { recurrence: entry.recurrence as 'daily' | 'weekly' | 'monthly' })
      logger.info('Next recurring content scheduled', {
        topic: entry.topic,
        nextScheduledAt: nextSchedule.toISOString()
      })
    }
  }
}

/**
 * Mark scheduled content as failed
 */
export function markAsFailed(id: number, error: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE scheduled_content
    SET status = 'failed', executed_at = ?, error = ?
    WHERE id = ?
  `).run(now, error, id)
}

/**
 * Cancel scheduled content
 */
export function cancelScheduledContent(id: number): boolean {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE scheduled_content
    SET status = 'cancelled'
    WHERE id = ? AND status = 'pending'
  `).run(id)

  if (result.changes > 0) {
    logger.info('Scheduled content cancelled', { id })
    return true
  }
  return false
}

/**
 * Get all scheduled content
 */
export function getScheduledContent(options?: {
  status?: string
  limit?: number
}): ScheduledContent[] {
  const db = getDatabase()
  const { status, limit = 100 } = options || {}

  let query = 'SELECT * FROM scheduled_content'
  const params: (string | number)[] = []

  if (status) {
    query += ' WHERE status = ?'
    params.push(status)
  }

  query += ' ORDER BY scheduled_at ASC LIMIT ?'
  params.push(limit)

  const rows = db.prepare(query).all(...params) as Array<{
    id: number
    topic: string
    scheduled_at: string
    status: string
    job_id: string | null
    created_at: string
    executed_at: string | null
    error: string | null
    recurrence: string | null
  }>

  return rows.map(row => ({
    id: row.id,
    topic: row.topic,
    scheduledAt: row.scheduled_at,
    status: row.status as ScheduledContent['status'],
    jobId: row.job_id,
    createdAt: row.created_at,
    executedAt: row.executed_at,
    error: row.error,
    recurrence: row.recurrence
  }))
}

/**
 * Get upcoming scheduled content (next N items)
 */
export function getUpcomingScheduledContent(limit = 10): ScheduledContent[] {
  return getScheduledContent({ status: 'pending', limit })
}

/**
 * Calculate next occurrence for recurring content
 */
function calculateNextOccurrence(from: Date, recurrence: string): Date | null {
  const next = new Date(from)

  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
    default:
      return null
  }

  return next
}

/**
 * Update scheduled content
 */
export function updateScheduledContent(id: number, updates: {
  topic?: string
  scheduledAt?: string
  recurrence?: string | null
}): boolean {
  const db = getDatabase()

  const sets: string[] = []
  const values: (string | number | null)[] = []

  if (updates.topic !== undefined) {
    sets.push('topic = ?')
    values.push(updates.topic)
  }
  if (updates.scheduledAt !== undefined) {
    sets.push('scheduled_at = ?')
    values.push(updates.scheduledAt)
  }
  if (updates.recurrence !== undefined) {
    sets.push('recurrence = ?')
    values.push(updates.recurrence)
  }

  if (sets.length === 0) return false

  values.push(id)
  const result = db.prepare(`
    UPDATE scheduled_content SET ${sets.join(', ')}
    WHERE id = ? AND status = 'pending'
  `).run(...values)

  return result.changes > 0
}

/**
 * Delete scheduled content
 */
export function deleteScheduledContent(id: number): boolean {
  const db = getDatabase()
  const result = db.prepare(`DELETE FROM scheduled_content WHERE id = ?`).run(id)
  return result.changes > 0
}

/**
 * Get scheduler statistics
 */
export function getSchedulerStats(): {
  pending: number
  processing: number
  completedToday: number
  failedToday: number
  upcoming24h: number
} {
  const db = getDatabase()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const pending = db.prepare(`SELECT COUNT(*) as count FROM scheduled_content WHERE status = 'pending'`).get() as { count: number }
  const processing = db.prepare(`SELECT COUNT(*) as count FROM scheduled_content WHERE status = 'processing'`).get() as { count: number }
  const completedToday = db.prepare(`
    SELECT COUNT(*) as count FROM scheduled_content
    WHERE status = 'completed' AND executed_at >= ?
  `).get(todayStart) as { count: number }
  const failedToday = db.prepare(`
    SELECT COUNT(*) as count FROM scheduled_content
    WHERE status = 'failed' AND executed_at >= ?
  `).get(todayStart) as { count: number }
  const upcoming24h = db.prepare(`
    SELECT COUNT(*) as count FROM scheduled_content
    WHERE status = 'pending' AND scheduled_at <= ?
  `).get(tomorrow) as { count: number }

  return {
    pending: pending.count,
    processing: processing.count,
    completedToday: completedToday.count,
    failedToday: failedToday.count,
    upcoming24h: upcoming24h.count
  }
}

// Scheduler runner - processes due content at intervals
let schedulerInterval: NodeJS.Timeout | null = null

/**
 * Start the scheduler (call this when API server starts)
 * @param processCallback Function to call when content is due (should trigger article generation)
 * @param intervalMs How often to check for due content (default: 60 seconds)
 */
export function startScheduler(
  processCallback: (scheduled: ScheduledContent) => Promise<string>,  // Returns job ID
  intervalMs = 60000
): void {
  if (schedulerInterval) {
    logger.warn('Scheduler already running')
    return
  }

  logger.info('Starting content scheduler', { intervalMs })

  schedulerInterval = setInterval(async () => {
    const dueContent = getContentDueForExecution()

    for (const content of dueContent) {
      try {
        logger.info('Processing scheduled content', { id: content.id, topic: content.topic })

        // Call the callback to trigger article generation
        const jobId = await processCallback(content)

        // Mark as processing
        markAsProcessing(content.id, jobId)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to process scheduled content', { id: content.id, error: errorMessage })
        markAsFailed(content.id, errorMessage)
      }
    }
  }, intervalMs)
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    logger.info('Content scheduler stopped')
  }
}
