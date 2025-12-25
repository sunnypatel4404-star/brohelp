import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { ChatGPTService } from '../services/chatgptService'
import { ImageServiceV2 } from '../services/imageServiceV2'
import { WordPressXmlRpcService } from '../services/wordpressXmlrpcService'
import { PinGenerationService } from '../services/pinGenerationService'
import { PinStorageService } from '../services/pinStorageService'
import { DashboardService } from '../services/dashboardService'
import { BotConfig } from '../config/botConfig'
import { getDatabase, JobRow } from '../database/database'
import { authMiddleware, generateApiKey, listApiKeys, revokeApiKey, initializeApiKeysTable } from '../middleware/auth'
import logger, { apiLogger, jobLifecycle } from '../services/logger'
import { queueForRetry, getJobsDueForRetry, getRetryQueueStats, getPendingRetries } from '../services/retryQueueService'
import { checkForDuplicate, recordArticle, updateArticle, getArticleByJobId, getRecentArticles, getArticleStats } from '../services/duplicateDetectionService'
import * as scheduler from '../services/schedulerService'
import * as imageBackup from '../services/imageBackupService'
import { wordpressSyncService } from '../services/wordpressSyncService'
import { InternalLinkingService } from '../services/internalLinkingService'

dotenv.config()

// ============ JOB TRACKING SYSTEM (SQLite-backed) ============

interface JobStatus {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  topic: string
  createdAt: string
  updatedAt: string
  result?: {
    articleTitle?: string
    postId?: number
    imagePath?: string        // WordPress featured image path
    pinImagePath?: string     // Pinterest pin image path
    pinsGenerated?: number
  }
  error?: string
  steps: {
    article: 'pending' | 'processing' | 'completed' | 'failed'
    image: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
    wordpress: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
    pins: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  }
}

// Convert database row to JobStatus
function rowToJobStatus(row: JobRow): JobStatus {
  return {
    id: row.id,
    status: row.status as JobStatus['status'],
    topic: row.topic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error ?? undefined,
    steps: JSON.parse(row.steps)
  }
}

function createJob(topic: string): JobStatus {
  const db = getDatabase()
  const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()
  const steps = {
    article: 'pending',
    image: 'pending',
    wordpress: 'pending',
    pins: 'pending'
  }

  db.prepare(`
    INSERT INTO jobs (id, status, topic, created_at, updated_at, steps)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, 'queued', topic, now, now, JSON.stringify(steps))

  return {
    id,
    status: 'queued',
    topic,
    createdAt: now,
    updatedAt: now,
    steps: steps as JobStatus['steps']
  }
}

function getJob(jobId: string): JobStatus | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as JobRow | undefined
  return row ? rowToJobStatus(row) : null
}

function updateJob(jobId: string, updates: Partial<JobStatus>): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Build dynamic update
  const sets: string[] = ['updated_at = ?']
  const values: (string | null)[] = [now]

  if (updates.status !== undefined) {
    sets.push('status = ?')
    values.push(updates.status)
  }
  if (updates.result !== undefined) {
    sets.push('result = ?')
    values.push(JSON.stringify(updates.result))
  }
  if (updates.error !== undefined) {
    sets.push('error = ?')
    values.push(updates.error)
  }
  if (updates.steps !== undefined) {
    sets.push('steps = ?')
    values.push(JSON.stringify(updates.steps))
  }

  values.push(jobId)

  db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

// Clean up old jobs (keep last 100)
function cleanupOldJobs(): void {
  const db = getDatabase()
  const count = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }

  if (count.count > 100) {
    db.prepare(`
      DELETE FROM jobs WHERE id NOT IN (
        SELECT id FROM jobs ORDER BY created_at DESC LIMIT 100
      )
    `).run()
  }
}

const app = express()
const PORT = process.env.API_PORT || 5000

// ============ RATE LIMITING ============
// Commented out for now but kept for future implementation
/*
interface RateLimitEntry {
  count: number
  resetTime: number
}

// Rate limiting code

const rateLimitStore = new Map<string, RateLimitEntry>()

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000  // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 100      // Max requests per window for general endpoints
const RATE_LIMIT_MAX_GENERATE = 10       // Max article generations per window (expensive operations)

function getRateLimitKey(req: Request): string {
  // Use IP address as the rate limit key
  const forwarded = req.headers['x-forwarded-for']
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip || req.socket.remoteAddress || 'unknown'
  return ip
}

function checkRateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore) {
      if (v.resetTime < now) rateLimitStore.delete(k)
    }
  }

  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: maxRequests - 1, resetIn: RATE_LIMIT_WINDOW_MS }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetTime - now }
}
*/

// Rate limiting middleware for general endpoints
// Commented out - not currently in use but kept for future implementation
/*
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = getRateLimitKey(req)
  const result = checkRateLimit(key, RATE_LIMIT_MAX_REQUESTS)

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString())
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString())
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetIn / 1000).toString())

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(result.resetIn / 1000)} seconds.`,
      retryAfter: Math.ceil(result.resetIn / 1000)
    })
    return
  }

  next()
}

// Stricter rate limiting for expensive operations (article generation)
function generateRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = `generate:${getRateLimitKey(req)}`
  const result = checkRateLimit(key, RATE_LIMIT_MAX_GENERATE)

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_GENERATE.toString())
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString())
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetIn / 1000).toString())

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many generation requests',
      message: `Article generation is rate limited to ${RATE_LIMIT_MAX_GENERATE} requests per minute. Try again in ${Math.ceil(result.resetIn / 1000)} seconds.`,
      retryAfter: Math.ceil(result.resetIn / 1000)
    })
    return
  }

  next()
}
*/

// Initialize API keys table
initializeApiKeysTable()

// Middleware
app.use(cors())
app.use(express.json())

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - startTime
    apiLogger.http('Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    })
  })
  next()
})

// Apply authentication middleware (can be disabled via API_AUTH_DISABLED=true)
app.use(authMiddleware)

// Load config
const botConfig: BotConfig = {
  systemPrompt: process.env.SYSTEM_PROMPT || 'You are a parenting expert.',
  tone: 'warm and conversational',
  voiceDescription: 'You are writing for Parent Village, a modern parenting blog.',
  wordCountMin: parseInt(process.env.MIN_WORD_COUNT || '800'),
  wordCountMax: parseInt(process.env.MAX_WORD_COUNT || '2000'),
  contentTypes: ['tips', 'advice', 'real-world examples'],
  emojiUsage: true,
  momTipFormat: true,
  callToAction: true,
  publishingFrequency: 'weekly'
}

// Initialize services
const chatgpt = new ChatGPTService(process.env.OPENAI_API_KEY || '', botConfig)
const imageGenerator = new ImageServiceV2('./generated_images')
const wordpress = new WordPressXmlRpcService(
  process.env.WORDPRESS_URL || '',
  process.env.WORDPRESS_USERNAME || '',
  process.env.WORDPRESS_PASSWORD || ''
)
const pinGenerator = new PinGenerationService(process.env.WORDPRESS_URL || '')
const pinStorage = new PinStorageService()
const dashboard = new DashboardService()
const internalLinking = new InternalLinkingService(wordpress)

// Error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err)
  res.status(500).json({ error: err.message || 'Unknown error' })
})

// ============ ARTICLE GENERATION ============

interface GenerateArticleRequest {
  topic: string
  generateImage?: boolean
  uploadToWordPress?: boolean
  generatePins?: boolean
  allowDuplicate?: boolean  // Skip duplicate check if true
}

// Validate and sanitize topic input for API
function validateTopicInput(topic: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (!topic || typeof topic !== 'string') {
    return { valid: false, error: 'Topic is required and must be a string' }
  }

  const trimmed = topic.trim()

  if (trimmed.length < 5) {
    return { valid: false, error: 'Topic must be at least 5 characters long' }
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Topic must be less than 500 characters' }
  }

  // Check for potentially malicious content
  const suspiciousPatterns = [/<script/i, /javascript:/i, /data:/i, /on\w+=/i]
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Topic contains invalid characters' }
    }
  }

  // Sanitize: remove HTML tags and excessive whitespace
  const sanitized = trimmed.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

  return { valid: true, sanitized }
}

app.post('/api/articles/generate', async (req: Request, res: Response) => {
  try {
    const { topic: rawTopic, generateImage = true, uploadToWordPress = true, generatePins = true, allowDuplicate = false } = req.body as GenerateArticleRequest

    // Validate topic input
    const validation = validateTopicInput(rawTopic)
    if (!validation.valid) {
      res.status(400).json({ error: validation.error })
      return
    }

    const topic = validation.sanitized!

    // Check for duplicate topics (unless explicitly allowed)
    if (!allowDuplicate) {
      const duplicateCheck = checkForDuplicate(topic)
      if (duplicateCheck.isDuplicate) {
        res.status(409).json({
          error: 'Duplicate topic detected',
          message: duplicateCheck.exactMatch
            ? `An article with this exact topic already exists (ID: ${duplicateCheck.exactMatch.id})`
            : `A very similar article exists: "${duplicateCheck.similarArticles[0]?.topic}"`,
          existingArticle: duplicateCheck.exactMatch,
          similarArticles: duplicateCheck.similarArticles,
          hint: 'Set allowDuplicate: true to generate anyway'
        })
        return
      }

      // Warn about similar articles but allow generation
      if (duplicateCheck.similarArticles.length > 0) {
        logger.info('Similar topics found but proceeding', {
          topic,
          similarCount: duplicateCheck.similarArticles.length
        })
      }
    }

    // Create a trackable job
    const job = createJob(topic)
    cleanupOldJobs()

    // Record article in database for future duplicate detection
    const articleId = recordArticle({ topic, jobId: job.id, status: 'generating' })

    jobLifecycle.started(job.id, topic)

    res.status(200).json({
      message: 'Article generation started',
      status: 'processing',
      jobId: job.id,
      articleId
    })

    // Run in background with job tracking
    generateArticleBackground(job.id, topic, generateImage, uploadToWordPress, generatePins)
  } catch (error) {
    logger.error('Failed to start article generation', { error: error instanceof Error ? error.message : String(error) })
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start article generation' })
  }
})

// Get job status endpoint
app.get('/api/jobs/:id', (req: Request, res: Response) => {
  const job = getJob(req.params.id)

  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }

  res.json(job)
})

// List all jobs
app.get('/api/jobs', (_req: Request, res: Response) => {
  const db = getDatabase()
  const rows = db.prepare(
    'SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50'
  ).all() as JobRow[]

  const allJobs = rows.map(rowToJobStatus)

  res.json({ jobs: allJobs, count: allJobs.length })
})

async function generateArticleBackground(
  jobId: string,
  topic: string,
  generateImage: boolean,
  uploadToWordPress: boolean,
  generatePins: boolean
): Promise<void> {
  const result: JobStatus['result'] = {}
  const startTime = Date.now()

  try {
    updateJob(jobId, { status: 'processing' })

    // Step 1: Generate article content
    jobLifecycle.stepStarted(jobId, 'article')
    updateJob(jobId, { steps: { ...getJob(jobId)!.steps, article: 'processing' } })
    logger.info(`[Job ${jobId}] Generating article for topic: ${topic}`)

    // Fetch existing articles for internal linking
    const internalLinkingInstructions = await internalLinking.getInternalLinkingInstructions()

    const articleContent = await chatgpt.generateArticle({ topic, internalLinkingInstructions })
    result.articleTitle = articleContent.title

    // Update article record with title
    const articleRecord = getArticleByJobId(jobId)
    if (articleRecord) {
      updateArticle(articleRecord.id, {
        title: articleContent.title,
        wordCount: articleContent.content.split(/\s+/).length
      })
    }

    jobLifecycle.stepCompleted(jobId, 'article', Date.now() - startTime)
    updateJob(jobId, {
      steps: { ...getJob(jobId)!.steps, article: 'completed' },
      result
    })

    // Step 2: Generate images if requested
    let wpImagePath: string | null = null
    let pinImagePath: string | null = null
    let pinImageUrl: string | null = null
    if (generateImage) {
      updateJob(jobId, { steps: { ...getJob(jobId)!.steps, image: 'processing' } })
      console.log(`[Job ${jobId}] Generating images (Pinterest + WordPress from same source)...`)

      try {
        // Generate both images using Gemini
        const images = await imageGenerator.generateBothImages(topic)

        wpImagePath = images.wordpress.localPath
        pinImagePath = images.pinterest.localPath

        result.imagePath = wpImagePath
        result.pinImagePath = pinImagePath

        updateJob(jobId, {
          steps: { ...getJob(jobId)!.steps, image: 'completed' },
          result
        })
      } catch (imgError) {
        console.error(`[Job ${jobId}] Image generation failed:`, imgError instanceof Error ? imgError.message : imgError)
        updateJob(jobId, { steps: { ...getJob(jobId)!.steps, image: 'failed' } })
      }
    } else {
      updateJob(jobId, { steps: { ...getJob(jobId)!.steps, image: 'skipped' } })
    }

    // Generate tags for WordPress and Pinterest
    const ageGroup = articleContent.content.toLowerCase().includes('toddler')
      ? 'toddler'
      : articleContent.content.toLowerCase().includes('infant')
        ? 'infant'
        : articleContent.content.toLowerCase().includes('preschool')
          ? 'preschool'
          : 'child'

    const articleTags = pinGenerator.generateTags(
      { title: articleContent.title, content: articleContent.content },
      ageGroup
    )
    console.log(`[Job ${jobId}] Generated ${articleTags.length} tags`)

    // Step 3: Upload to WordPress if requested
    let postId: number | undefined
    let wordpressImageUrl: string | undefined
    if (uploadToWordPress && articleContent) {
      updateJob(jobId, { steps: { ...getJob(jobId)!.steps, wordpress: 'processing' } })
      console.log(`[Job ${jobId}] Uploading to WordPress...`)

      // Add footer watermark to article content
      const articleWithFooter = articleContent.content + `
<div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e8d4c0;">
  <p style="font-size: 16px; color: #a08c6b; font-weight: bold;">
    Made With Love By Parentvillage.blog 💛
  </p>
</div>`

      try {
        const postResult = await wordpress.createPost({
          title: articleContent.title,
          content: articleWithFooter,
          tagNames: articleTags, // Add tags to WordPress post
          status: 'draft'
        })
        postId = typeof postResult === 'object' ? postResult.id : postResult
        result.postId = postId
        updateJob(jobId, { result })

        // Upload WordPress featured image and get the public URL
        if (wpImagePath && postId) {
          try {
            const fileName = `featured-image-${Date.now()}.png`
            const mediaResult = await wordpress.uploadMedia(wpImagePath, fileName, 'image/png')
            await wordpress.setFeaturedImage(postId, mediaResult.attachmentId)
            wordpressImageUrl = mediaResult.url
            console.log(`[Job ${jobId}] WordPress featured image uploaded and set`)
            if (wordpressImageUrl) {
              console.log(`[Job ${jobId}] WordPress Image URL: ${wordpressImageUrl}`)
            }
          } catch (err) {
            console.error(`[Job ${jobId}] Failed to upload featured image:`, err instanceof Error ? err.message : err)
          }
        }

        // Also upload Pinterest image to WordPress for permanent URL
        if (pinImagePath && postId) {
          try {
            const pinFileName = `pinterest-pin-${Date.now()}.png`
            const pinMediaResult = await wordpress.uploadMedia(pinImagePath, pinFileName, 'image/png')
            pinImageUrl = pinMediaResult.url
            console.log(`[Job ${jobId}] Pinterest image uploaded to WordPress: ${pinImageUrl}`)

            // Pinterest image uploaded successfully
            console.log(`[Job ${jobId}] Pinterest image uploaded: ${pinMediaResult.url}`)
          } catch (err) {
            console.error(`[Job ${jobId}] Failed to upload Pinterest image:`, err instanceof Error ? err.message : err)
          }
        }

        updateJob(jobId, { steps: { ...getJob(jobId)!.steps, wordpress: 'completed' } })
      } catch (wpError) {
        console.error(`[Job ${jobId}] WordPress upload failed:`, wpError instanceof Error ? wpError.message : wpError)
        updateJob(jobId, { steps: { ...getJob(jobId)!.steps, wordpress: 'failed' } })
      }
    } else {
      updateJob(jobId, { steps: { ...getJob(jobId)!.steps, wordpress: 'skipped' } })
    }

    // Step 4: Generate pins if requested
    if (generatePins && articleContent) {
      updateJob(jobId, { steps: { ...getJob(jobId)!.steps, pins: 'processing' } })
      console.log(`[Job ${jobId}] Generating Pinterest pins...`)

      try {
        // Use Pinterest pin image URL (vertical format optimized for Pinterest)
        if (!pinImageUrl && pinImagePath) {
          console.warn(`[Job ${jobId}] Warning: No Pinterest image URL available. Local path: ${pinImagePath}`)
        }

        const pinData = {
          title: articleContent.title,
          content: articleContent.content,
          postId: postId,
          imageUrl: pinImageUrl || undefined,
          localImagePath: pinImagePath || undefined,
          link: postId ? `${process.env.WORDPRESS_URL}/?p=${postId}` : undefined
        }

        const variations = pinGenerator.generatePinVariations(pinData)
        // Use the same tags generated for WordPress
        const savedPin = pinGenerator.createSavedPin(pinData, variations, articleTags)
        pinStorage.savePinDraft(savedPin)
        result.pinsGenerated = variations.length

        updateJob(jobId, {
          steps: { ...getJob(jobId)!.steps, pins: 'completed' },
          result
        })
        console.log(`[Job ${jobId}] Generated ${variations.length} pin variations`)
      } catch (pinError) {
        console.error(`[Job ${jobId}] Pin generation failed:`, pinError instanceof Error ? pinError.message : pinError)
        updateJob(jobId, { steps: { ...getJob(jobId)!.steps, pins: 'failed' } })
      }
    } else {
      updateJob(jobId, { steps: { ...getJob(jobId)!.steps, pins: 'skipped' } })
    }

    // Update article status to completed
    const finalArticleRecord = getArticleByJobId(jobId)
    if (finalArticleRecord && result.postId) {
      updateArticle(finalArticleRecord.id, {
        postId: result.postId,
        status: 'draft',
        wordpressUrl: `${process.env.WORDPRESS_URL}/?p=${result.postId}`
      })
    }

    updateJob(jobId, { status: 'completed', result })
    jobLifecycle.completed(jobId, {
      articleTitle: result.articleTitle,
      postId: result.postId,
      pinsGenerated: result.pinsGenerated,
      duration: Date.now() - startTime
    })
    logger.info(`[Job ${jobId}] Article generation complete`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[Job ${jobId}] Article generation failed:`, { error: errorMessage })
    jobLifecycle.failed(jobId, errorMessage)

    // Queue for retry
    const retryResult = queueForRetry(jobId, errorMessage)
    if (retryResult.queued) {
      logger.info(`[Job ${jobId}] Queued for retry`, {
        retryCount: retryResult.retryCount,
        nextRetryAt: retryResult.nextRetryAt
      })
    }

    updateJob(jobId, {
      status: 'failed',
      error: errorMessage,
      result
    })

    // Update article status to failed
    const articleRecord = getArticleByJobId(jobId)
    if (articleRecord) {
      updateArticle(articleRecord.id, { status: 'failed' })
    }
  }
}

// ============ DASHBOARD ============

app.get('/api/dashboard', (_req: Request, res: Response) => {
  try {
    const data = dashboard.getDashboardData()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch dashboard data' })
  }
})

app.get('/api/dashboard/stats', (_req: Request, res: Response) => {
  try {
    const dashboardData = dashboard.getDashboardData()
    const stats = {
      stats: dashboardData.stats,
      timeline: dashboard.getActivityTimeline(7)
    }
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch stats' })
  }
})

app.get('/api/dashboard/activity', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7
    const timeline = dashboard.getActivityTimeline(days)
    res.json({ timeline })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch activity' })
  }
})

// ============ PIN MANAGEMENT ============

app.get('/api/pins', (req: Request, res: Response) => {
  try {
    const dashboardData = dashboard.getDashboardData()
    const status = req.query.status as string | undefined
    let pins = dashboardData.allPins

    if (status) {
      pins = pins.filter(p => p.status === status)
    }

    res.json({ pins, count: pins.length })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch pins' })
  }
})

app.get('/api/pins/:id', (req: Request, res: Response) => {
  try {
    const dashboardData = dashboard.getDashboardData()
    const pin = dashboardData.allPins.find(p => p.id === req.params.id)

    if (!pin) {
      res.status(404).json({ error: 'Pin not found' })
      return
    }

    res.json(pin)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch pin' })
  }
})

app.post('/api/pins/:id/approve', (req: Request, res: Response) => {
  try {
    const pinId = req.params.id
    const updated = pinStorage.updatePinStatus(pinId, 'approved')

    if (!updated) {
      res.status(404).json({ error: 'Pin not found' })
      return
    }

    res.json({ message: 'Pin approved', pin: updated })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to approve pin' })
  }
})

app.post('/api/pins/:id/publish', (req: Request, res: Response) => {
  try {
    const pinId = req.params.id
    const updated = pinStorage.updatePinStatus(pinId, 'published')

    if (!updated) {
      res.status(404).json({ error: 'Pin not found' })
      return
    }

    res.json({ message: 'Pin published', pin: updated })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to publish pin' })
  }
})

// ============ GENERATE PINS FROM URL ============

interface GeneratePinsFromUrlRequest {
  articleUrl: string
  pinCount?: number  // 2-3 pins, default 3
}

app.post('/api/pins/generate-from-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { articleUrl, pinCount = 3 } = req.body as GeneratePinsFromUrlRequest

    if (!articleUrl) {
      res.status(400).json({ error: 'Article URL is required' })
      return
    }

    // Validate URL format
    let url: URL
    try {
      url = new URL(articleUrl)
    } catch {
      res.status(400).json({ error: 'Invalid URL format' })
      return
    }

    // Fetch article content from WordPress
    console.log(`📥 Fetching article from: ${articleUrl}`)

    // Try to extract post ID from URL
    const postIdMatch = articleUrl.match(/[?&]p=(\d+)/) || articleUrl.match(/\/(\d+)\/?$/)
    let postId: number | undefined
    if (postIdMatch) {
      postId = parseInt(postIdMatch[1])
    }

    // Fetch the article content
    const response = await fetch(articleUrl)
    if (!response.ok) {
      res.status(400).json({ error: `Failed to fetch article: ${response.statusText}` })
      return
    }

    const html = await response.text()

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                       html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    const title = titleMatch ? titleMatch[1].replace(/\s*[-|–]\s*.*$/, '').trim() : 'Untitled Article'

    // Extract content from HTML (basic extraction)
    const contentMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                        html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    const rawContent = contentMatch ? contentMatch[1] : ''

    // Strip HTML tags for excerpt
    const content = rawContent
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000)

    const excerpt = content.substring(0, 500)

    console.log(`📝 Article title: ${title}`)
    console.log(`📄 Content length: ${content.length} chars`)

    // Generate pin variations
    const pinService = new PinGenerationService(process.env.WORDPRESS_URL || 'https://parentvillage.blog')
    const articleData = {
      title,
      content,
      excerpt,
      postId,
      blogUrl: url.origin,
      imageUrl: undefined as string | undefined
    }

    // Generate all variations first
    const allVariations = pinService.generatePinVariations(articleData)

    // Select the requested number of variations (2-3)
    const selectedVariations = allVariations.slice(0, Math.min(Math.max(pinCount, 2), 3))

    // Generate unique images for each pin variation
    console.log(`🎨 Generating ${selectedVariations.length} unique pin images...`)

    const pinImageService = new ImageServiceV2('./generated_images')

    for (let i = 0; i < selectedVariations.length; i++) {
      try {
        console.log(`  🖼️  Generating image ${i + 1}/${selectedVariations.length}`)

        const image = await pinImageService.generateImage({
          topic: title,
          type: 'pinterest'
        })

        selectedVariations[i].imageUrl = image.localPath
        console.log(`  ✅ Image ${i + 1} saved: ${image.localPath}`)
      } catch (imgError) {
        console.error(`  ❌ Failed to generate image ${i + 1}:`, imgError)
        // Continue without image
      }
    }

    // Generate tags
    const ageGroup = content.toLowerCase().includes('toddler') ? 'toddler' :
                     content.toLowerCase().includes('baby') ? 'baby' :
                     content.toLowerCase().includes('teen') ? 'teen' : 'child'
    const tags = pinService.generateTags(articleData, ageGroup)

    // Create and save the pin
    const savedPin = pinService.createSavedPin(articleData, selectedVariations, tags)

    // Update variations with the article URL
    savedPin.variations = savedPin.variations.map(v => ({
      ...v,
      link: articleUrl
    }))

    pinStorage.savePinDraft(savedPin)

    console.log(`✅ Generated ${selectedVariations.length} pins for: ${title}`)

    res.json({
      success: true,
      message: `Generated ${selectedVariations.length} pins`,
      pin: savedPin
    })
  } catch (error) {
    console.error('Error generating pins from URL:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate pins' })
  }
})

// ============ EXPORT SELECTED PINS ============

interface ExportSelectedPinsRequest {
  pinIds: string[]
  format?: 'csv' | 'json'
}

app.post('/api/pins/export-selected', (req: Request, res: Response): void => {
  try {
    const { pinIds, format = 'csv' } = req.body as ExportSelectedPinsRequest

    if (!pinIds || !Array.isArray(pinIds) || pinIds.length === 0) {
      res.status(400).json({ error: 'Pin IDs array is required' })
      return
    }

    const dashboardData = dashboard.getDashboardData()
    const selectedPins = dashboardData.allPins.filter(p => pinIds.includes(p.id))

    if (selectedPins.length === 0) {
      res.status(404).json({ error: 'No pins found with provided IDs' })
      return
    }

    if (format === 'csv') {
      const result = generatePinCSV(selectedPins, { page: 1, limit: PINTEREST_MAX_ROWS })

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="pins-selected-${Date.now()}.csv"`)
      res.setHeader('X-Total-Rows', result.totalRows.toString())
      res.setHeader('X-Pins-Exported', selectedPins.length.toString())
      res.send(result.csv)
    } else {
      res.json({
        pins: selectedPins,
        count: selectedPins.length
      })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to export selected pins' })
  }
})

interface ExportPinsRequest {
  status?: string
  format?: 'csv' | 'json'
  page?: number      // Page number (1-indexed), default 1
  limit?: number     // Rows per page, max 200 (Pinterest limit)
}

// Pinterest maximum rows per CSV upload
const PINTEREST_MAX_ROWS = 200

app.post('/api/pins/export', (req: Request, res: Response): void => {
  try {
    const { status, format = 'csv', page = 1, limit = PINTEREST_MAX_ROWS, pinId } = req.body as ExportPinsRequest & { pinId?: string }
    const dashboardData = dashboard.getDashboardData()
    let pins = dashboardData.allPins

    // Filter by specific pin ID if provided
    if (pinId) {
      pins = pins.filter(p => p.id === pinId)
      if (pins.length === 0) {
        res.status(404).json({ error: 'Pin not found' })
        return
      }
    }

    // Filter by status if provided
    if (status) {
      pins = pins.filter(p => p.status === status)
    }

    if (format === 'csv') {
      // Enforce Pinterest's 200 row limit
      const effectiveLimit = Math.min(limit, PINTEREST_MAX_ROWS)
      const result = generatePinCSV(pins, { page, limit: effectiveLimit })

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="pins-export-page${page}-${Date.now()}.csv"`)
      res.setHeader('X-Total-Rows', result.totalRows.toString())
      res.setHeader('X-Current-Page', result.currentPage.toString())
      res.setHeader('X-Total-Pages', result.totalPages.toString())
      res.setHeader('X-Rows-In-Page', result.rowsInPage.toString())
      res.send(result.csv)
    } else {
      // For JSON format, also paginate
      const effectiveLimit = Math.min(limit, PINTEREST_MAX_ROWS)
      const startIndex = (page - 1) * effectiveLimit
      const paginatedPins = pins.slice(startIndex, startIndex + effectiveLimit)

      res.json({
        pins: paginatedPins,
        count: paginatedPins.length,
        totalPins: pins.length,
        currentPage: page,
        totalPages: Math.ceil(pins.length / effectiveLimit)
      })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to export pins' })
  }
})

// Get export info (how many pages needed)
app.get('/api/pins/export/info', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined
    const dashboardData = dashboard.getDashboardData()
    let pins = dashboardData.allPins

    if (status) {
      pins = pins.filter(p => p.status === status)
    }

    // Count total variations (rows)
    let totalRows = 0
    for (const pin of pins) {
      totalRows += pin.variations?.length || 0
    }

    const totalPages = Math.ceil(totalRows / PINTEREST_MAX_ROWS)

    res.json({
      totalPins: pins.length,
      totalRows,
      pinterestMaxRows: PINTEREST_MAX_ROWS,
      totalPages,
      pages: Array.from({ length: totalPages }, (_, i) => ({
        page: i + 1,
        startRow: i * PINTEREST_MAX_ROWS + 1,
        endRow: Math.min((i + 1) * PINTEREST_MAX_ROWS, totalRows)
      }))
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get export info' })
  }
})

// ============ CONTENT LIBRARY ============

app.get('/api/articles', (_req: Request, res: Response) => {
  try {
    const dashboardData = dashboard.getDashboardData()
    res.json({
      articles: dashboardData.allPins || [],
      count: dashboardData.allPins?.length || 0
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch articles' })
  }
})

// ============ SYNCED WORDPRESS POSTS ============

const SYNCED_POSTS_DIR = path.join(process.cwd(), 'synced_posts')

app.get('/api/wordpress/posts', (_req: Request, res: Response) => {
  try {
    const indexPath = path.join(SYNCED_POSTS_DIR, '_index.json')

    if (!fs.existsSync(indexPath)) {
      res.json({
        posts: [],
        count: 0,
        synced: false,
        message: 'No synced posts. Run: npm run sync-wordpress'
      })
      return
    }

    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

    res.json({
      posts: indexData.posts || [],
      count: indexData.totalPosts || 0,
      published: indexData.published || 0,
      drafts: indexData.drafts || 0,
      syncedAt: indexData.syncedAt,
      synced: true
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch synced posts' })
  }
})

app.get('/api/wordpress/posts/:id', (req: Request, res: Response) => {
  try {
    const postId = req.params.id

    // Find the post file
    const files = fs.readdirSync(SYNCED_POSTS_DIR)
    const postFile = files.find(f => f.startsWith(`${postId}-`) && f.endsWith('.json'))

    if (!postFile) {
      res.status(404).json({ error: 'Post not found' })
      return
    }

    const postData = JSON.parse(fs.readFileSync(path.join(SYNCED_POSTS_DIR, postFile), 'utf-8'))
    res.json(postData)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch post' })
  }
})

// ============ SETTINGS ============

interface SettingsUpdate {
  blogUrl?: string
  username?: string
  publishingFrequency?: string
  minWordCount?: number
  maxWordCount?: number
  generateFeaturedImage?: boolean
  autoUploadToWordPress?: boolean
  generatePinterestPins?: boolean
}

app.get('/api/settings', (_req: Request, res: Response) => {
  try {
    const settings = {
      wordpress: {
        blogUrl: process.env.WORDPRESS_URL || '',
        username: process.env.WORDPRESS_USERNAME ? '••••••••' : '',
        configured: Boolean(process.env.WORDPRESS_URL && process.env.WORDPRESS_USERNAME)
      },
      content: {
        publishingFrequency: process.env.PUBLISHING_FREQUENCY || 'weekly',
        minWordCount: parseInt(process.env.MIN_WORD_COUNT || '800'),
        maxWordCount: parseInt(process.env.MAX_WORD_COUNT || '2000'),
        generateFeaturedImage: process.env.GENERATE_FEATURED_IMAGE !== 'false',
        autoUploadToWordPress: process.env.AUTO_UPLOAD !== 'false',
        generatePinterestPins: process.env.GENERATE_PINS !== 'false'
      }
    }
    res.json(settings)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch settings' })
  }
})

app.post('/api/settings', (req: Request, res: Response) => {
  try {
    const updates = req.body as SettingsUpdate

    // Note: In production, you'd want to persist these to a database or config file
    // For now, we'll just validate they exist and return success
    const updatedSettings = {
      wordpress: {
        blogUrl: updates.blogUrl || process.env.WORDPRESS_URL || '',
        username: updates.username ? '••••••••' : (process.env.WORDPRESS_USERNAME ? '••••••••' : ''),
        configured: Boolean(updates.blogUrl || process.env.WORDPRESS_URL)
      },
      content: {
        publishingFrequency: updates.publishingFrequency || 'weekly',
        minWordCount: updates.minWordCount || 800,
        maxWordCount: updates.maxWordCount || 2000,
        generateFeaturedImage: updates.generateFeaturedImage !== false,
        autoUploadToWordPress: updates.autoUploadToWordPress !== false,
        generatePinterestPins: updates.generatePinterestPins !== false
      }
    }

    res.json({ message: 'Settings saved', settings: updatedSettings })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save settings' })
  }
})

// ============ API KEY MANAGEMENT ============

// Generate a new API key (requires existing admin key or initial setup)
app.post('/api/auth/keys', (req: Request, res: Response): void => {
  try {
    const { name } = req.body as { name: string }
    if (!name || typeof name !== 'string' || name.length < 3) {
      res.status(400).json({ error: 'Name is required (min 3 characters)' })
      return
    }

    const result = generateApiKey(name)
    logger.info('API key generated', { name, id: result.id })

    res.json({
      message: 'API key generated successfully',
      key: result.key,  // Only shown once!
      id: result.id,
      warning: 'Save this key securely - it cannot be retrieved again!'
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate API key' })
  }
})

// List all API keys (without the actual keys)
app.get('/api/auth/keys', (_req: Request, res: Response) => {
  try {
    const keys = listApiKeys()
    res.json({ keys })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list API keys' })
  }
})

// Revoke an API key
app.delete('/api/auth/keys/:id', (req: Request, res: Response): void => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid key ID' })
      return
    }

    const success = revokeApiKey(id)
    if (success) {
      logger.info('API key revoked', { id })
      res.json({ message: 'API key revoked' })
    } else {
      res.status(404).json({ error: 'API key not found' })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to revoke API key' })
  }
})

// ============ RETRY QUEUE MANAGEMENT ============

// Get retry queue stats
app.get('/api/retries/stats', (_req: Request, res: Response) => {
  try {
    const stats = getRetryQueueStats()
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get retry stats' })
  }
})

// Get pending retries
app.get('/api/retries', (_req: Request, res: Response) => {
  try {
    const retries = getPendingRetries()
    res.json({ retries, count: retries.length })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get retries' })
  }
})

// Process due retries manually
app.post('/api/retries/process', async (_req: Request, res: Response) => {
  try {
    const dueRetries = getJobsDueForRetry()
    const results: { jobId: string; status: string }[] = []

    for (const retry of dueRetries) {
      const job = getJob(retry.jobId)
      if (job) {
        // Re-run the job
        generateArticleBackground(job.id, job.topic, true, true, true)
        results.push({ jobId: retry.jobId, status: 'restarted' })
        logger.info('Retry triggered manually', { jobId: retry.jobId })
      }
    }

    res.json({
      message: `Processed ${results.length} retries`,
      results
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to process retries' })
  }
})

// ============ ARTICLE MANAGEMENT ============

// Get article history with duplicate detection info
app.get('/api/articles/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const articles = getRecentArticles(limit)
    const stats = getArticleStats()
    res.json({ articles, stats })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get article history' })
  }
})

// Check if a topic is duplicate
app.post('/api/articles/check-duplicate', (req: Request, res: Response): void => {
  try {
    const { topic } = req.body as { topic: string }
    if (!topic) {
      res.status(400).json({ error: 'Topic is required' })
      return
    }

    const result = checkForDuplicate(topic)
    res.json({
      isDuplicate: result.isDuplicate,
      exactMatch: result.exactMatch,
      similarArticles: result.similarArticles
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to check for duplicates' })
  }
})

// ============ CONTENT SCHEDULING ============

// Schedule content for future generation
app.post('/api/schedule', (req: Request, res: Response): void => {
  try {
    const { topic, scheduledAt, recurrence } = req.body as {
      topic: string
      scheduledAt: string
      recurrence?: 'daily' | 'weekly' | 'monthly'
    }

    if (!topic || !scheduledAt) {
      res.status(400).json({ error: 'Topic and scheduledAt are required' })
      return
    }

    // Validate scheduled time is in the future
    const scheduleDate = new Date(scheduledAt)
    if (isNaN(scheduleDate.getTime())) {
      res.status(400).json({ error: 'Invalid scheduledAt date format' })
      return
    }
    if (scheduleDate <= new Date()) {
      res.status(400).json({ error: 'scheduledAt must be in the future' })
      return
    }

    const scheduled = scheduler.scheduleContent(topic, scheduleDate, { recurrence })
    logger.info('Content scheduled', { id: scheduled.id, topic, scheduledAt })

    res.json({
      message: 'Content scheduled successfully',
      scheduled
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to schedule content' })
  }
})

// Get scheduled content
app.get('/api/schedule', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined
    const limit = parseInt(req.query.limit as string) || 100
    const scheduled = scheduler.getScheduledContent({ status, limit })
    const stats = scheduler.getSchedulerStats()
    res.json({ scheduled, stats })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get scheduled content' })
  }
})

// Get upcoming scheduled content
app.get('/api/schedule/upcoming', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    const upcoming = scheduler.getUpcomingScheduledContent(limit)
    res.json({ upcoming })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get upcoming content' })
  }
})

// Update scheduled content
app.put('/api/schedule/:id', (req: Request, res: Response): void => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid schedule ID' })
      return
    }

    const { topic, scheduledAt, recurrence } = req.body as {
      topic?: string
      scheduledAt?: string
      recurrence?: string | null
    }

    const success = scheduler.updateScheduledContent(id, { topic, scheduledAt, recurrence })
    if (success) {
      res.json({ message: 'Schedule updated' })
    } else {
      res.status(404).json({ error: 'Scheduled content not found or not pending' })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update schedule' })
  }
})

// Cancel scheduled content
app.delete('/api/schedule/:id', (req: Request, res: Response): void => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid schedule ID' })
      return
    }

    const success = scheduler.cancelScheduledContent(id)
    if (success) {
      logger.info('Scheduled content cancelled', { id })
      res.json({ message: 'Scheduled content cancelled' })
    } else {
      res.status(404).json({ error: 'Scheduled content not found or not pending' })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to cancel schedule' })
  }
})

// ============ IMAGE BACKUP ============

// Get backup statistics
app.get('/api/backups/stats', (_req: Request, res: Response) => {
  try {
    const stats = imageBackup.getBackupStats()
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get backup stats' })
  }
})

// Run backup for all new images
app.post('/api/backups/run', (_req: Request, res: Response) => {
  try {
    const result = imageBackup.backupAllNewImages()
    logger.info('Image backup completed', { successful: result.successful, failed: result.failed })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run backup' })
  }
})

// Clean up old backups
app.post('/api/backups/cleanup', (_req: Request, res: Response) => {
  try {
    const result = imageBackup.cleanupOldBackups()
    res.json({
      message: 'Cleanup completed',
      ...result,
      freedMB: Math.round(result.freedBytes / 1024 / 1024 * 100) / 100
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to cleanup backups' })
  }
})

// Verify backup integrity
app.get('/api/backups/verify', (_req: Request, res: Response) => {
  try {
    const result = imageBackup.verifyBackupIntegrity()
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to verify backups' })
  }
})

// Restore an image from backup
app.post('/api/backups/restore', (req: Request, res: Response): void => {
  try {
    const { filename } = req.body as { filename: string }
    if (!filename) {
      res.status(400).json({ error: 'Filename is required' })
      return
    }

    const result = imageBackup.restoreImage(filename)
    if (result.success) {
      res.json({ message: 'Image restored', path: result.backupPath })
    } else {
      res.status(404).json({ error: result.error })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to restore image' })
  }
})

// ============ WORDPRESS SYNC ============

// Get sync summary
app.get('/api/sync/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await wordpressSyncService.getSyncSummary()
    res.json(summary)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get sync summary' })
  }
})

// Run full sync check
app.post('/api/sync/check', async (_req: Request, res: Response) => {
  try {
    const report = await wordpressSyncService.runFullSyncCheck()
    res.json(report)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run sync check' })
  }
})

// Check sync status for a specific post
app.get('/api/sync/post/:postId', async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = parseInt(req.params.postId)
    if (isNaN(postId)) {
      res.status(400).json({ error: 'Invalid post ID' })
      return
    }

    const status = await wordpressSyncService.checkPostSync(postId)
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to check post sync' })
  }
})

// Pull remote status for a post
app.post('/api/sync/pull/:postId', async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = parseInt(req.params.postId)
    if (isNaN(postId)) {
      res.status(400).json({ error: 'Invalid post ID' })
      return
    }

    const success = await wordpressSyncService.pullRemoteStatus(postId)
    if (success) {
      res.json({ message: 'Local status updated from WordPress' })
    } else {
      res.status(404).json({ error: 'Post not found or could not be updated' })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to pull remote status' })
  }
})

// ============ HEALTH CHECK ============

app.get('/api/health', (_req: Request, res: Response) => {
  const retryStats = getRetryQueueStats()
  const schedulerStats = scheduler.getSchedulerStats()
  const articleStats = getArticleStats()
  const backupStats = imageBackup.getBackupStats()

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      authentication: process.env.API_AUTH_DISABLED !== 'true',
      scheduling: true,
      retryQueue: true,
      duplicateDetection: true,
      structuredLogging: true,
      imageBackup: true,
      wordpressSync: true
    },
    stats: {
      retries: retryStats,
      scheduler: schedulerStats,
      articles: articleStats,
      backups: {
        total: backupStats.totalBackups,
        sizeMB: Math.round(backupStats.totalSize / 1024 / 1024 * 100) / 100
      }
    }
  })
})

// ============ HELPER FUNCTIONS ============

interface PaginationOptions {
  page?: number
  limit?: number
}

interface CSVExportResult {
  csv: string
  totalRows: number
  currentPage: number
  totalPages: number
  rowsInPage: number
}

function generatePinCSV(pins: Array<{
  id: string
  articleTitle: string
  suggestedTags?: string[]
  variations: Array<{
    angle: string
    title: string
    description: string
    imageUrl?: string
    link: string
    altText: string
  }>
}>, options?: PaginationOptions): CSVExportResult {
  const { page = 1, limit = 200 } = options || {}
  // Helper to format tags for Pinterest description
  // Pinterest allows hashtags in descriptions - they help with discoverability
  const formatTagsForDescription = (tags: string[] | undefined, maxTags: number = 5): string => {
    if (!tags || tags.length === 0) return ''

    // Ensure tags start with # and are properly formatted
    const formattedTags = tags
      .slice(0, maxTags)
      .map(tag => {
        const cleaned = tag.trim()
        return cleaned.startsWith('#') ? cleaned : `#${cleaned}`
      })
      .filter(tag => tag.length > 1)

    return formattedTags.length > 0 ? '\n\n' + formattedTags.join(' ') : ''
  }

  // Helper to ensure link is a string
  const getLink = (link: unknown): string => {
    if (typeof link === 'string') {
      // If it's already a string with [object Object], extract the ID if possible
      if (link.includes('[object Object]')) {
        return 'https://parentvillage.blog/'
      }
      return link
    }
    if (typeof link === 'object' && link !== null && 'id' in link) {
      const id = (link as { id: number }).id
      return `https://parentvillage.blog/?p=${id}`
    }
    return 'https://parentvillage.blog/'
  }

  // Helper to get a valid image URL for Pinterest bulk upload
  // Media URL is REQUIRED and must be a publicly available, permanent URL
  const getImageUrl = (imageUrl: string | undefined, pinId: string, articleTitle: string): { url: string; isPlaceholder: boolean } => {
    // Check if we have a permanent WordPress URL (not expired DALL-E URLs)
    if (imageUrl && imageUrl.trim() &&
        imageUrl.includes('parentvillageblog.files.wordpress.com') &&
        !imageUrl.includes('[object Object]')) {
      return { url: imageUrl, isPlaceholder: false }
    }

    // Try to look up the Pinterest image from the images database by matching article title
    try {
      const db = getDatabase()

      // Clean the article title for matching (remove emoji, lowercase, extract key words)
      const cleanTitle = articleTitle
        .replace(/[^\w\s-]/g, '')  // Remove emoji and special chars
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 3)
        .join('-')

      // Look for a Pinterest image with matching topic
      const imageRow = db.prepare(`
        SELECT wordpress_url FROM images
        WHERE filename LIKE ?
        AND wordpress_url IS NOT NULL
        AND wordpress_url != ''
        ORDER BY created_at DESC
        LIMIT 1
      `).get(`pin_%${cleanTitle.substring(0, 20)}%`) as { wordpress_url: string } | undefined

      if (imageRow?.wordpress_url) {
        console.log(`Found WordPress image URL for pin ${pinId}: ${imageRow.wordpress_url}`)
        return { url: imageRow.wordpress_url, isPlaceholder: false }
      }
    } catch (error) {
      console.warn(`Could not look up image for pin ${pinId}:`, error)
    }

    // Fallback to placeholder if no permanent URL available
    console.warn(`Warning: Pin ${pinId} has no valid WordPress image URL, using placeholder`)
    return {
      url: `https://via.placeholder.com/1000x1500/e8d5c4/2d3e50?text=Parent+Village+Pin+${pinId.slice(-6)}`,
      isPlaceholder: true
    }
  }

  // Pinterest Bulk Upload format (updated 10/15/25)
  // Simple 7-column format for organic pin uploads
  // Source: https://help.pinterest.com/en/business/article/bulk-upload-video-pins
  const headers = [
    'Title',              // Required: Pin title (max 100 characters)
    'Media URL',          // Required: Publicly available image URL (.png, .jpg, .mp4)
    'Pinterest board',    // Required: Board name (supports sections: "Board/Section")
    'Description',        // Optional: max 500 characters
    'Link',               // Optional: Destination URL when pin is clicked
    'Publish date',       // Optional: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS (UTC)
    'Keywords'            // Optional: Comma-separated keywords for search
  ]

  // Track placeholder usage for summary warning
  let placeholderCount = 0
  let totalPins = 0

  // Create rows - one row per pin variation
  const rows: string[][] = []
  pins.forEach((pin) => {
    pin.variations.forEach((variation) => {
      totalPins++

      // Media URL (required) - look up WordPress URL if not already set
      const imageResult = getImageUrl(variation.imageUrl, pin.id, pin.articleTitle || '')
      if (imageResult.isPlaceholder) placeholderCount++

      // Title (required, max 100 chars)
      const title = variation.title.substring(0, 100)

      // Pinterest board (required)
      const boardName = 'Parenting Tips'

      // Description with hashtags (max 500 chars)
      const tagsString = formatTagsForDescription(pin.suggestedTags, 5)
      const descriptionWithTags = variation.description + tagsString
      const description = descriptionWithTags
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500)

      // Link (destination URL)
      const link = getLink(variation.link)

      // Publish date (empty for immediate publish)
      const publishDate = ''

      // Keywords (comma-separated, no # symbols)
      const keywords = (pin.suggestedTags || [])
        .map(tag => tag.replace(/^#/, ''))
        .join(', ')

      rows.push([
        title,
        imageResult.url,
        boardName,
        description,
        link,
        publishDate,
        keywords
      ])
    })
  })

  // Calculate pagination
  const totalRows = rows.length
  const totalPages = Math.ceil(totalRows / limit)
  const startIndex = (page - 1) * limit
  const endIndex = Math.min(startIndex + limit, totalRows)
  const paginatedRows = rows.slice(startIndex, endIndex)

  // Format CSV with proper escaping
  const headerRow = headers.map(h => `"${h}"`).join(',')

  const dataRows = paginatedRows.map(row => {
    return row
      .map(cell => {
        // Escape double quotes by doubling them
        const escaped = (cell || '').replace(/"/g, '""')
        return `"${escaped}"`
      })
      .join(',')
  })

  // Combine with CRLF line endings (Windows standard for CSV)
  const csvContent = [headerRow, ...dataRows].join('\r\n')

  // Log summary warning about placeholder images
  if (placeholderCount > 0) {
    console.warn(`\n⚠️  CSV Export Warning: ${placeholderCount}/${totalPins} pins are using placeholder images.`)
    console.warn(`   Pinterest requires publicly accessible image URLs.`)
    console.warn(`   To fix: Ensure images are uploaded to WordPress before generating pins.\n`)
  }

  // Log pagination info
  if (totalPages > 1) {
    console.log(`📄 CSV Export: Page ${page} of ${totalPages} (${paginatedRows.length} rows, ${totalRows} total)`)
  }

  return {
    csv: csvContent,
    totalRows,
    currentPage: page,
    totalPages,
    rowsInPage: paginatedRows.length
  }
}

// ============ START SERVER ============

export function startApiServer(): void {
  app.listen(PORT, () => {
    logger.info(`API Server running at http://localhost:${PORT}`)
    console.log(`\n🚀 API Server running at http://localhost:${PORT}`)
    console.log(`\n📚 Core endpoints:`)
    console.log(`   POST   /api/articles/generate    - Generate new article`)
    console.log(`   GET    /api/dashboard            - Dashboard data`)
    console.log(`   GET    /api/pins                 - List pins`)
    console.log(`   POST   /api/pins/export          - Export to CSV`)
    console.log(`\n🔐 Authentication:`)
    console.log(`   POST   /api/auth/keys            - Generate API key`)
    console.log(`   GET    /api/auth/keys            - List API keys`)
    console.log(`   DELETE /api/auth/keys/:id        - Revoke API key`)
    console.log(`\n📅 Scheduling:`)
    console.log(`   POST   /api/schedule             - Schedule content`)
    console.log(`   GET    /api/schedule             - List scheduled`)
    console.log(`   GET    /api/schedule/upcoming    - Upcoming content`)
    console.log(`\n🔄 Retry queue:`)
    console.log(`   GET    /api/retries              - Pending retries`)
    console.log(`   GET    /api/retries/stats        - Queue statistics`)
    console.log(`   POST   /api/retries/process      - Process retries`)
    console.log(`\n📝 Articles:`)
    console.log(`   GET    /api/articles/history     - Article history`)
    console.log(`   POST   /api/articles/check-duplicate - Check duplicates`)
    console.log(`\n💚 /api/health - Health check\n`)

    // Start the scheduler
    scheduler.startScheduler(async (scheduled) => {
      // Create a job for the scheduled content
      const job = createJob(scheduled.topic)
      generateArticleBackground(job.id, scheduled.topic, true, true, true)
      return job.id
    }, 60000)  // Check every minute

    logger.info('Content scheduler started')
    console.log(`⏰ Content scheduler started (checking every 60s)`)

    if (process.env.API_AUTH_DISABLED === 'true') {
      console.log(`\n⚠️  Authentication is DISABLED (API_AUTH_DISABLED=true)`)
    } else {
      console.log(`\n🔒 Authentication is ENABLED`)
      console.log(`   Generate your first API key: POST /api/auth/keys {"name": "admin"}`)
    }
    console.log()
  })
}

// Start the server if this file is run directly
startApiServer()

export { app }
