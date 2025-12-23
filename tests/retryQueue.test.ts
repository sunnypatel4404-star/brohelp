import { queueForRetry, getJobsDueForRetry, markRetrySuccessful, getRetryQueueStats, cancelRetries } from '../src/backend/services/retryQueueService'
import { getDatabase, closeDatabase } from '../src/backend/database/database'

describe('Retry Queue Service', () => {
  const testJobId = `test_job_${Date.now()}`

  beforeAll(() => {
    // Initialize database
    const db = getDatabase()
    // Create a test job
    const now = new Date().toISOString()
    db.prepare(`
      INSERT OR REPLACE INTO jobs (id, status, topic, created_at, updated_at, steps)
      VALUES (?, 'failed', 'Test Topic', ?, ?, '{}')
    `).run(testJobId, now, now)
  })

  afterAll(() => {
    closeDatabase()
  })

  describe('Queue Management', () => {
    it('should add a job to the retry queue', () => {
      const result = queueForRetry(testJobId, 'Test error message')

      expect(result.queued).toBe(true)
      expect(result.retryCount).toBeDefined()
      expect(result.nextRetryAt).toBeDefined()
    })

    it('should increment retry count on subsequent failures', () => {
      // Use a different job ID for this test
      const newJobId = `test_job_increment_${Date.now()}`
      const db = getDatabase()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO jobs (id, status, topic, created_at, updated_at, steps)
        VALUES (?, 'failed', 'Increment Test', ?, ?, '{}')
      `).run(newJobId, now, now)

      const result1 = queueForRetry(newJobId, 'First error')
      expect(result1.queued).toBe(true)
      expect(result1.retryCount).toBe(0)

      const result2 = queueForRetry(newJobId, 'Second error')
      expect(result2.queued).toBe(true)
      // After first queue (count 0), second call increments to 1
      expect(result2.retryCount).toBeGreaterThanOrEqual(1)
    })

    it('should respect max retries', () => {
      // Use a different job ID for this test with low max retries
      const newJobId = `test_job_max_${Date.now()}`
      const db = getDatabase()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO jobs (id, status, topic, created_at, updated_at, steps)
        VALUES (?, 'failed', 'Max Retries Test', ?, ?, '{}')
      `).run(newJobId, now, now)

      // Queue with max 2 retries - must use same config each time
      // First call creates entry with retry_count=0, max_retries=2
      queueForRetry(newJobId, 'Error 1', { maxRetries: 2 })
      // Second call increments to retry_count=1
      queueForRetry(newJobId, 'Error 2', { maxRetries: 2 })
      // Third call increments to retry_count=2, which equals max_retries
      queueForRetry(newJobId, 'Error 3', { maxRetries: 2 })
      // Fourth call should be rejected since retry_count (2) >= max_retries (2)
      const result = queueForRetry(newJobId, 'Error 4', { maxRetries: 2 })

      expect(result.queued).toBe(false)
      expect(result.reason).toBe('Max retries exceeded')
    })
  })

  describe('Statistics', () => {
    it('should return retry queue stats', () => {
      const stats = getRetryQueueStats()

      expect(typeof stats.pending).toBe('number')
      expect(typeof stats.dueNow).toBe('number')
      expect(typeof stats.exhausted).toBe('number')
    })
  })

  describe('Cancellation', () => {
    it('should cancel retries for a job', () => {
      const newJobId = `test_job_cancel_${Date.now()}`
      const db = getDatabase()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO jobs (id, status, topic, created_at, updated_at, steps)
        VALUES (?, 'failed', 'Cancel Test', ?, ?, '{}')
      `).run(newJobId, now, now)

      queueForRetry(newJobId, 'Error to cancel')
      const cancelled = cancelRetries(newJobId)

      expect(cancelled).toBe(true)
    })
  })
})
