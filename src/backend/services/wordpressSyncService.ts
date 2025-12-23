import { getDatabase } from '../database/database'
import { WordPressXmlRpcService } from './wordpressXmlrpcService'
import logger from './logger'

interface SyncStatus {
  postId: number
  localStatus: string | null
  remoteStatus: string | null
  localTitle: string | null
  remoteTitle: string | null
  inSync: boolean
  issue?: string
}

interface SyncReport {
  synced: number
  outOfSync: number
  deletedRemotely: number
  newRemotely: number
  details: SyncStatus[]
}

/**
 * WordPress Sync Detection Service
 * Monitors changes to WordPress posts and detects sync issues
 */
export class WordPressSyncService {
  private wordpress: WordPressXmlRpcService

  constructor() {
    this.wordpress = new WordPressXmlRpcService(
      process.env.WORDPRESS_URL || '',
      process.env.WORDPRESS_USERNAME || '',
      process.env.WORDPRESS_PASSWORD || ''
    )
  }

  /**
   * Check if a specific post is in sync with WordPress
   */
  async checkPostSync(postId: number): Promise<SyncStatus> {
    const db = getDatabase()

    // Get local article record
    const localArticle = db.prepare(`
      SELECT post_id, title, status FROM articles WHERE post_id = ?
    `).get(postId) as { post_id: number; title: string | null; status: string } | undefined

    try {
      // Get remote post from WordPress
      const remotePosts = await this.wordpress.getPosts({ number: 1, offset: 0 })
      const remotePost = remotePosts.find((p: { id: number }) => p.id === postId) as {
        id: number
        title: string
        status: string
      } | undefined

      if (!localArticle && !remotePost) {
        return {
          postId,
          localStatus: null,
          remoteStatus: null,
          localTitle: null,
          remoteTitle: null,
          inSync: true,
          issue: 'Post does not exist in either location'
        }
      }

      if (!localArticle && remotePost) {
        return {
          postId,
          localStatus: null,
          remoteStatus: remotePost.status,
          localTitle: null,
          remoteTitle: remotePost.title,
          inSync: false,
          issue: 'Post exists on WordPress but not in local database (new remote post)'
        }
      }

      if (localArticle && !remotePost) {
        return {
          postId,
          localStatus: localArticle.status,
          remoteStatus: null,
          localTitle: localArticle.title,
          remoteTitle: null,
          inSync: false,
          issue: 'Post exists locally but was deleted from WordPress'
        }
      }

      // Both exist - compare status
      const inSync = localArticle!.status === remotePost!.status

      return {
        postId,
        localStatus: localArticle!.status,
        remoteStatus: remotePost!.status,
        localTitle: localArticle!.title,
        remoteTitle: remotePost!.title,
        inSync,
        issue: inSync ? undefined : `Status mismatch: local=${localArticle!.status}, remote=${remotePost!.status}`
      }
    } catch (error) {
      logger.error('Failed to check post sync', {
        postId,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        postId,
        localStatus: localArticle?.status || null,
        remoteStatus: null,
        localTitle: localArticle?.title || null,
        remoteTitle: null,
        inSync: false,
        issue: `Failed to fetch from WordPress: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * Run a full sync check between local database and WordPress
   */
  async runFullSyncCheck(): Promise<SyncReport> {
    const db = getDatabase()

    // Get all local articles with post IDs
    const localArticles = db.prepare(`
      SELECT id, post_id, title, status FROM articles WHERE post_id IS NOT NULL
    `).all() as Array<{ id: number; post_id: number; title: string | null; status: string }>

    const report: SyncReport = {
      synced: 0,
      outOfSync: 0,
      deletedRemotely: 0,
      newRemotely: 0,
      details: []
    }

    // Get all posts from WordPress
    let remotePosts: Array<{ id: number; title: string; status: string }> = []
    try {
      remotePosts = await this.wordpress.getPosts({ number: 100, offset: 0 }) as Array<{ id: number; title: string; status: string }>
    } catch (error) {
      logger.error('Failed to fetch WordPress posts for sync check', {
        error: error instanceof Error ? error.message : String(error)
      })
      return report
    }

    const localPostIds = new Set(localArticles.map(a => a.post_id))

    // Check each local article
    for (const article of localArticles) {
      const remotePost = remotePosts.find(p => p.id === article.post_id)

      if (!remotePost) {
        report.deletedRemotely++
        report.outOfSync++
        report.details.push({
          postId: article.post_id,
          localStatus: article.status,
          remoteStatus: null,
          localTitle: article.title,
          remoteTitle: null,
          inSync: false,
          issue: 'Deleted from WordPress'
        })
      } else {
        const inSync = article.status === remotePost.status
        if (inSync) {
          report.synced++
        } else {
          report.outOfSync++
        }
        report.details.push({
          postId: article.post_id,
          localStatus: article.status,
          remoteStatus: remotePost.status,
          localTitle: article.title,
          remoteTitle: remotePost.title,
          inSync,
          issue: inSync ? undefined : `Status mismatch`
        })
      }
    }

    // Check for new remote posts
    for (const remotePost of remotePosts) {
      if (!localPostIds.has(remotePost.id)) {
        report.newRemotely++
        report.details.push({
          postId: remotePost.id,
          localStatus: null,
          remoteStatus: remotePost.status,
          localTitle: null,
          remoteTitle: remotePost.title,
          inSync: false,
          issue: 'New post on WordPress not in local database'
        })
      }
    }

    logger.info('WordPress sync check completed', {
      synced: report.synced,
      outOfSync: report.outOfSync,
      deletedRemotely: report.deletedRemotely,
      newRemotely: report.newRemotely
    })

    return report
  }

  /**
   * Sync local status to match WordPress
   */
  async pullRemoteStatus(postId: number): Promise<boolean> {
    try {
      const remotePosts = await this.wordpress.getPosts({ number: 100, offset: 0 }) as Array<{ id: number; status: string }>
      const remotePost = remotePosts.find(p => p.id === postId)

      if (!remotePost) {
        logger.warn('Post not found on WordPress', { postId })
        return false
      }

      const db = getDatabase()
      const result = db.prepare(`
        UPDATE articles SET status = ? WHERE post_id = ?
      `).run(remotePost.status, postId)

      if (result.changes > 0) {
        logger.info('Local status updated from WordPress', { postId, status: remotePost.status })
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to pull remote status', {
        postId,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Mark a post as deleted in local database
   */
  markAsDeletedRemotely(postId: number): boolean {
    const db = getDatabase()
    const result = db.prepare(`
      UPDATE articles SET status = 'deleted_remotely' WHERE post_id = ?
    `).run(postId)

    if (result.changes > 0) {
      logger.info('Post marked as deleted remotely', { postId })
      return true
    }
    return false
  }

  /**
   * Get summary of sync status
   */
  async getSyncSummary(): Promise<{
    localCount: number
    remoteCount: number
    inSync: number
    outOfSync: number
    lastChecked: string
  }> {
    const db = getDatabase()

    const localCount = db.prepare(`
      SELECT COUNT(*) as count FROM articles WHERE post_id IS NOT NULL
    `).get() as { count: number }

    try {
      const remotePosts = await this.wordpress.getPosts({ number: 1, offset: 0 })
      const report = await this.runFullSyncCheck()

      return {
        localCount: localCount.count,
        remoteCount: remotePosts.length,
        inSync: report.synced,
        outOfSync: report.outOfSync,
        lastChecked: new Date().toISOString()
      }
    } catch (error) {
      return {
        localCount: localCount.count,
        remoteCount: 0,
        inSync: 0,
        outOfSync: 0,
        lastChecked: new Date().toISOString()
      }
    }
  }
}

// Export singleton instance
export const wordpressSyncService = new WordPressSyncService()
