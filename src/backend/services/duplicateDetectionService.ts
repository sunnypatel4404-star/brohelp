import { getDatabase } from '../database/database'
import logger from './logger'

interface ArticleRecord {
  id: number
  topic: string
  topicNormalized: string
  title: string | null
  postId: number | null
  jobId: string | null
  wordpressUrl: string | null
  status: string
  createdAt: string
  publishedAt: string | null
  wordCount: number | null
}

interface SimilarArticle {
  id: number
  topic: string
  title: string | null
  similarity: number
  createdAt: string
  status: string
}

/**
 * Normalize a topic for comparison
 * - Lowercase
 * - Remove punctuation
 * - Remove common stop words
 * - Sort remaining words
 */
function normalizeTopic(topic: string): string {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'about', 'how', 'what', 'when', 'where', 'which', 'who', 'why',
    'your', 'my', 'our', 'their', 'its', 'his', 'her'
  ])

  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .sort()
    .join(' ')
}

/**
 * Calculate similarity between two normalized topics (Jaccard similarity)
 */
function calculateSimilarity(topic1: string, topic2: string): number {
  const words1 = new Set(topic1.split(' '))
  const words2 = new Set(topic2.split(' '))

  if (words1.size === 0 && words2.size === 0) return 1
  if (words1.size === 0 || words2.size === 0) return 0

  let intersection = 0
  for (const word of words1) {
    if (words2.has(word)) intersection++
  }

  const union = words1.size + words2.size - intersection
  return intersection / union
}

/**
 * Check if a topic is a duplicate or very similar to existing articles
 */
export function checkForDuplicate(topic: string, similarityThreshold = 0.7): {
  isDuplicate: boolean
  exactMatch: ArticleRecord | null
  similarArticles: SimilarArticle[]
} {
  const db = getDatabase()
  const normalized = normalizeTopic(topic)

  // Check for exact match (normalized)
  const exactMatch = db.prepare(`
    SELECT * FROM articles WHERE topic_normalized = ?
  `).get(normalized) as {
    id: number
    topic: string
    topic_normalized: string
    title: string | null
    post_id: number | null
    job_id: string | null
    wordpress_url: string | null
    status: string
    created_at: string
    published_at: string | null
    word_count: number | null
  } | undefined

  if (exactMatch) {
    logger.info('Exact duplicate topic found', { topic, existingId: exactMatch.id })
    return {
      isDuplicate: true,
      exactMatch: {
        id: exactMatch.id,
        topic: exactMatch.topic,
        topicNormalized: exactMatch.topic_normalized,
        title: exactMatch.title,
        postId: exactMatch.post_id,
        jobId: exactMatch.job_id,
        wordpressUrl: exactMatch.wordpress_url,
        status: exactMatch.status,
        createdAt: exactMatch.created_at,
        publishedAt: exactMatch.published_at,
        wordCount: exactMatch.word_count
      },
      similarArticles: []
    }
  }

  // Get all articles and check similarity
  const allArticles = db.prepare(`
    SELECT id, topic, topic_normalized, title, status, created_at
    FROM articles
    ORDER BY created_at DESC
    LIMIT 500
  `).all() as Array<{
    id: number
    topic: string
    topic_normalized: string
    title: string | null
    status: string
    created_at: string
  }>

  const similarArticles: SimilarArticle[] = []

  for (const article of allArticles) {
    const similarity = calculateSimilarity(normalized, article.topic_normalized)
    if (similarity >= similarityThreshold) {
      similarArticles.push({
        id: article.id,
        topic: article.topic,
        title: article.title,
        similarity: Math.round(similarity * 100) / 100,
        createdAt: article.created_at,
        status: article.status
      })
    }
  }

  // Sort by similarity descending
  similarArticles.sort((a, b) => b.similarity - a.similarity)

  const isDuplicate = similarArticles.length > 0 && similarArticles[0].similarity >= 0.9

  if (isDuplicate) {
    logger.info('Similar topic found', {
      topic,
      mostSimilar: similarArticles[0].topic,
      similarity: similarArticles[0].similarity
    })
  }

  return { isDuplicate, exactMatch: null, similarArticles: similarArticles.slice(0, 5) }
}

/**
 * Record a new article in the database
 */
export function recordArticle(data: {
  topic: string
  title?: string
  postId?: number
  jobId?: string
  wordpressUrl?: string
  status?: string
  wordCount?: number
}): number {
  const db = getDatabase()
  const normalized = normalizeTopic(data.topic)
  const now = new Date().toISOString()

  const result = db.prepare(`
    INSERT INTO articles (topic, topic_normalized, title, post_id, job_id, wordpress_url, status, created_at, word_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.topic,
    normalized,
    data.title || null,
    data.postId || null,
    data.jobId || null,
    data.wordpressUrl || null,
    data.status || 'draft',
    now,
    data.wordCount || null
  )

  logger.info('Article recorded', { id: result.lastInsertRowid, topic: data.topic })
  return result.lastInsertRowid as number
}

/**
 * Update an existing article record
 */
export function updateArticle(id: number, updates: {
  title?: string
  postId?: number
  wordpressUrl?: string
  status?: string
  publishedAt?: string
  wordCount?: number
}): boolean {
  const db = getDatabase()

  const sets: string[] = []
  const values: (string | number | null)[] = []

  if (updates.title !== undefined) {
    sets.push('title = ?')
    values.push(updates.title)
  }
  if (updates.postId !== undefined) {
    sets.push('post_id = ?')
    values.push(updates.postId)
  }
  if (updates.wordpressUrl !== undefined) {
    sets.push('wordpress_url = ?')
    values.push(updates.wordpressUrl)
  }
  if (updates.status !== undefined) {
    sets.push('status = ?')
    values.push(updates.status)
  }
  if (updates.publishedAt !== undefined) {
    sets.push('published_at = ?')
    values.push(updates.publishedAt)
  }
  if (updates.wordCount !== undefined) {
    sets.push('word_count = ?')
    values.push(updates.wordCount)
  }

  if (sets.length === 0) return false

  values.push(id)
  const result = db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * Get article by job ID
 */
export function getArticleByJobId(jobId: string): ArticleRecord | null {
  const db = getDatabase()
  const row = db.prepare(`SELECT * FROM articles WHERE job_id = ?`).get(jobId) as {
    id: number
    topic: string
    topic_normalized: string
    title: string | null
    post_id: number | null
    job_id: string | null
    wordpress_url: string | null
    status: string
    created_at: string
    published_at: string | null
    word_count: number | null
  } | undefined

  if (!row) return null

  return {
    id: row.id,
    topic: row.topic,
    topicNormalized: row.topic_normalized,
    title: row.title,
    postId: row.post_id,
    jobId: row.job_id,
    wordpressUrl: row.wordpress_url,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    wordCount: row.word_count
  }
}

/**
 * Get recent articles
 */
export function getRecentArticles(limit = 50): ArticleRecord[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT * FROM articles ORDER BY created_at DESC LIMIT ?
  `).all(limit) as Array<{
    id: number
    topic: string
    topic_normalized: string
    title: string | null
    post_id: number | null
    job_id: string | null
    wordpress_url: string | null
    status: string
    created_at: string
    published_at: string | null
    word_count: number | null
  }>

  return rows.map(row => ({
    id: row.id,
    topic: row.topic,
    topicNormalized: row.topic_normalized,
    title: row.title,
    postId: row.post_id,
    jobId: row.job_id,
    wordpressUrl: row.wordpress_url,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    wordCount: row.word_count
  }))
}

/**
 * Search articles by topic keyword
 */
export function searchArticles(query: string, limit = 20): ArticleRecord[] {
  const db = getDatabase()
  const searchTerm = `%${query.toLowerCase()}%`

  const rows = db.prepare(`
    SELECT * FROM articles
    WHERE LOWER(topic) LIKE ? OR LOWER(title) LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(searchTerm, searchTerm, limit) as Array<{
    id: number
    topic: string
    topic_normalized: string
    title: string | null
    post_id: number | null
    job_id: string | null
    wordpress_url: string | null
    status: string
    created_at: string
    published_at: string | null
    word_count: number | null
  }>

  return rows.map(row => ({
    id: row.id,
    topic: row.topic,
    topicNormalized: row.topic_normalized,
    title: row.title,
    postId: row.post_id,
    jobId: row.job_id,
    wordpressUrl: row.wordpress_url,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    wordCount: row.word_count
  }))
}

/**
 * Get article statistics
 */
export function getArticleStats(): {
  total: number
  draft: number
  published: number
  thisWeek: number
  thisMonth: number
} {
  const db = getDatabase()

  const total = db.prepare(`SELECT COUNT(*) as count FROM articles`).get() as { count: number }
  const draft = db.prepare(`SELECT COUNT(*) as count FROM articles WHERE status = 'draft'`).get() as { count: number }
  const published = db.prepare(`SELECT COUNT(*) as count FROM articles WHERE status = 'published'`).get() as { count: number }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const thisWeek = db.prepare(`SELECT COUNT(*) as count FROM articles WHERE created_at >= ?`).get(weekAgo) as { count: number }
  const thisMonth = db.prepare(`SELECT COUNT(*) as count FROM articles WHERE created_at >= ?`).get(monthAgo) as { count: number }

  return {
    total: total.count,
    draft: draft.count,
    published: published.count,
    thisWeek: thisWeek.count,
    thisMonth: thisMonth.count
  }
}
