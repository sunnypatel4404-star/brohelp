import * as scheduler from '../src/backend/services/schedulerService'
import { getDatabase, closeDatabase } from '../src/backend/database/database'

describe('Scheduler Service', () => {
  beforeAll(() => {
    getDatabase()
  })

  afterAll(() => {
    scheduler.stopScheduler()
    closeDatabase()
  })

  describe('Content Scheduling', () => {
    it('should schedule content for future generation', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      const scheduled = scheduler.scheduleContent('Test scheduled topic', futureDate)

      expect(scheduled.id).toBeGreaterThan(0)
      expect(scheduled.topic).toBe('Test scheduled topic')
      expect(scheduled.status).toBe('pending')
    })

    it('should schedule recurring content', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const scheduled = scheduler.scheduleContent('Weekly topic', futureDate, { recurrence: 'weekly' })

      expect(scheduled.recurrence).toBe('weekly')
    })

    it('should get upcoming scheduled content', () => {
      const upcoming = scheduler.getUpcomingScheduledContent(10)

      expect(Array.isArray(upcoming)).toBe(true)
    })

    it('should update scheduled content', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      const scheduled = scheduler.scheduleContent('Update test topic', futureDate)

      const success = scheduler.updateScheduledContent(scheduled.id, {
        topic: 'Updated topic',
        recurrence: 'daily'
      })

      expect(success).toBe(true)
    })

    it('should cancel scheduled content', () => {
      const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000)
      const scheduled = scheduler.scheduleContent('Cancel test topic', futureDate)

      const success = scheduler.cancelScheduledContent(scheduled.id)
      expect(success).toBe(true)
    })
  })

  describe('Statistics', () => {
    it('should return scheduler statistics', () => {
      const stats = scheduler.getSchedulerStats()

      expect(typeof stats.pending).toBe('number')
      expect(typeof stats.processing).toBe('number')
      expect(typeof stats.completedToday).toBe('number')
      expect(typeof stats.failedToday).toBe('number')
      expect(typeof stats.upcoming24h).toBe('number')
    })
  })

  describe('Due Content', () => {
    it('should find content due for execution', () => {
      // Schedule something in the past (should be due)
      const pastDate = new Date(Date.now() - 1000)
      const db = getDatabase()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO scheduled_content (topic, scheduled_at, status, created_at)
        VALUES (?, ?, 'pending', ?)
      `).run('Past due content', pastDate.toISOString(), now)

      const due = scheduler.getContentDueForExecution()
      expect(due.length).toBeGreaterThan(0)
    })
  })
})
