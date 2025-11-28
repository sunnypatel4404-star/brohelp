import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { ChatGPTService } from '../services/chatgptService'
import { ImageGenerationService } from '../services/imageGenerationService'
import { WordPressXmlRpcService } from '../services/wordpressXmlrpcService'
import { PinGenerationService } from '../services/pinGenerationService'
import { PinStorageService } from '../services/pinStorageService'
import { DashboardService } from '../services/dashboardService'
import { BotConfig } from '../config/botConfig'

dotenv.config()

// ============ JOB TRACKING SYSTEM ============

interface JobStatus {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  topic: string
  createdAt: string
  updatedAt: string
  result?: {
    articleTitle?: string
    postId?: number
    imagePath?: string
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

// In-memory job store (in production, use Redis or a database)
const jobs = new Map<string, JobStatus>()

function createJob(topic: string): JobStatus {
  const job: JobStatus = {
    id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'queued',
    topic,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: {
      article: 'pending',
      image: 'pending',
      wordpress: 'pending',
      pins: 'pending'
    }
  }
  jobs.set(job.id, job)
  return job
}

function updateJob(jobId: string, updates: Partial<JobStatus>): void {
  const job = jobs.get(jobId)
  if (job) {
    Object.assign(job, updates, { updatedAt: new Date().toISOString() })
  }
}

// Clean up old jobs (keep last 100)
function cleanupOldJobs(): void {
  if (jobs.size > 100) {
    const sortedJobs = Array.from(jobs.entries())
      .sort((a, b) => new Date(b[1].createdAt).getTime() - new Date(a[1].createdAt).getTime())

    sortedJobs.slice(100).forEach(([id]) => jobs.delete(id))
  }
}

const app = express()
const PORT = process.env.API_PORT || 5000

// ============ RATE LIMITING ============

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000  // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 10       // Max requests per window for general endpoints
const RATE_LIMIT_MAX_GENERATE = 3        // Max article generations per window (expensive operations)

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

// Rate limiting middleware for general endpoints
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

// Middleware
app.use(cors())
app.use(express.json())
app.use(rateLimitMiddleware)  // Apply general rate limiting to all routes

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
const imageGenerator = new ImageGenerationService(process.env.OPENAI_API_KEY || '')
const wordpress = new WordPressXmlRpcService(
  process.env.WORDPRESS_URL || '',
  process.env.WORDPRESS_USERNAME || '',
  process.env.WORDPRESS_PASSWORD || ''
)
const pinGenerator = new PinGenerationService(process.env.WORDPRESS_URL || '')
const pinStorage = new PinStorageService()
const dashboard = new DashboardService()

// Error handling middleware
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

app.post('/api/articles/generate', generateRateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { topic: rawTopic, generateImage = true, uploadToWordPress = true, generatePins = true } = req.body as GenerateArticleRequest

    // Validate topic input
    const validation = validateTopicInput(rawTopic)
    if (!validation.valid) {
      res.status(400).json({ error: validation.error })
      return
    }

    const topic = validation.sanitized!

    // Create a trackable job
    const job = createJob(topic)
    cleanupOldJobs()

    res.status(200).json({
      message: 'Article generation started',
      status: 'processing',
      jobId: job.id
    })

    // Run in background with job tracking
    generateArticleBackground(job.id, topic, generateImage, uploadToWordPress, generatePins)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start article generation' })
  }
})

// Get job status endpoint
app.get('/api/jobs/:id', (req: Request, res: Response) => {
  const job = jobs.get(req.params.id)

  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }

  res.json(job)
})

// List all jobs
app.get('/api/jobs', (_req: Request, res: Response) => {
  const allJobs = Array.from(jobs.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)

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

  try {
    updateJob(jobId, { status: 'processing' })

    // Step 1: Generate article content
    updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, article: 'processing' } })
    console.log(`[Job ${jobId}] Generating article for topic: ${topic}`)

    const articleContent = await chatgpt.generateArticle({ topic })
    result.articleTitle = articleContent.title
    updateJob(jobId, {
      steps: { ...jobs.get(jobId)!.steps, article: 'completed' },
      result
    })

    // Step 2: Generate image if requested
    let imagePath: string | null = null
    if (generateImage) {
      updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, image: 'processing' } })
      console.log(`[Job ${jobId}] Generating featured image...`)

      try {
        const imageResult = await imageGenerator.generateArticleImage({ topic })
        imagePath = imageResult.localPath
        result.imagePath = imagePath
        updateJob(jobId, {
          steps: { ...jobs.get(jobId)!.steps, image: 'completed' },
          result
        })
      } catch (imgError) {
        console.error(`[Job ${jobId}] Image generation failed:`, imgError instanceof Error ? imgError.message : imgError)
        updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, image: 'failed' } })
      }
    } else {
      updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, image: 'skipped' } })
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
      updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, wordpress: 'processing' } })
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

        // Upload featured image and get the public URL
        if (imagePath && postId) {
          try {
            const fileName = `featured-image-${Date.now()}.png`
            const mediaResult = await wordpress.uploadMedia(imagePath, fileName, 'image/png')
            await wordpress.setFeaturedImage(postId, mediaResult.attachmentId)
            wordpressImageUrl = mediaResult.url
            console.log(`[Job ${jobId}] Featured image uploaded and set`)
            if (wordpressImageUrl) {
              console.log(`[Job ${jobId}] Image URL: ${wordpressImageUrl}`)
            }
          } catch (err) {
            console.error(`[Job ${jobId}] Failed to upload featured image:`, err instanceof Error ? err.message : err)
          }
        }

        updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, wordpress: 'completed' } })
      } catch (wpError) {
        console.error(`[Job ${jobId}] WordPress upload failed:`, wpError instanceof Error ? wpError.message : wpError)
        updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, wordpress: 'failed' } })
      }
    } else {
      updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, wordpress: 'skipped' } })
    }

    // Step 4: Generate pins if requested
    if (generatePins && articleContent) {
      updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, pins: 'processing' } })
      console.log(`[Job ${jobId}] Generating Pinterest pins...`)

      try {
        // Use WordPress media URL if available, otherwise warn about missing public URL
        const pinImageUrl = wordpressImageUrl || undefined
        if (!pinImageUrl && imagePath) {
          console.warn(`[Job ${jobId}] Warning: No public image URL available for pins. Local path: ${imagePath}`)
        }

        const pinData = {
          title: articleContent.title,
          content: articleContent.content,
          postId: postId,
          imageUrl: pinImageUrl,
          link: postId ? `${process.env.WORDPRESS_URL}/?p=${postId}` : undefined
        }

        const variations = pinGenerator.generatePinVariations(pinData)
        // Use the same tags generated for WordPress
        const savedPin = pinGenerator.createSavedPin(pinData, variations, articleTags)
        pinStorage.savePinDraft(savedPin)
        result.pinsGenerated = variations.length

        updateJob(jobId, {
          steps: { ...jobs.get(jobId)!.steps, pins: 'completed' },
          result
        })
        console.log(`[Job ${jobId}] Generated ${variations.length} pin variations`)
      } catch (pinError) {
        console.error(`[Job ${jobId}] Pin generation failed:`, pinError instanceof Error ? pinError.message : pinError)
        updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, pins: 'failed' } })
      }
    } else {
      updateJob(jobId, { steps: { ...jobs.get(jobId)!.steps, pins: 'skipped' } })
    }

    updateJob(jobId, { status: 'completed', result })
    console.log(`[Job ${jobId}] Article generation complete`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Job ${jobId}] Article generation failed:`, errorMessage)
    updateJob(jobId, {
      status: 'failed',
      error: errorMessage,
      result
    })
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

interface ExportPinsRequest {
  status?: string
  format?: 'csv' | 'json'
}

app.post('/api/pins/export', (req: Request, res: Response) => {
  try {
    const { status, format = 'csv' } = req.body as ExportPinsRequest
    const dashboardData = dashboard.getDashboardData()
    let pins = dashboardData.allPins

    if (status) {
      pins = pins.filter(p => p.status === status)
    }

    if (format === 'csv') {
      const csv = generatePinCSV(pins)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="pins-export-${Date.now()}.csv"`)
      res.send(csv)
    } else {
      res.json({ pins, count: pins.length })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to export pins' })
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

// ============ HEALTH CHECK ============

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// ============ HELPER FUNCTIONS ============

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
}>) {
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
  const getLink = (link: any): string => {
    if (typeof link === 'string') {
      // If it's already a string with [object Object], extract the ID if possible
      if (link.includes('[object Object]')) {
        return 'https://parentvillage.blog/'
      }
      return link
    }
    if (typeof link === 'object' && link?.id) return `https://parentvillage.blog/?p=${link.id}`
    return 'https://parentvillage.blog/'
  }

  // Helper to get a valid image URL for Pinterest bulk upload
  // Media URL is REQUIRED and must be a publicly available URL
  const getImageUrl = (imageUrl: string | undefined, pinId: string): { url: string; isPlaceholder: boolean } => {
    // If we have a valid URL (http/https), use it
    if (imageUrl && imageUrl.trim() &&
        (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) &&
        !imageUrl.includes('[object Object]')) {
      return { url: imageUrl, isPlaceholder: false }
    }

    // Otherwise use a placeholder image service with unique seed
    // Using placeholder.com with a unique ID ensures different image for each pin
    console.warn(`Warning: Pin ${pinId} has no valid public image URL, using placeholder`)
    return {
      url: `https://via.placeholder.com/1000x1500/e8d5c4/2d3e50?text=Parent+Village+Pin+${pinId.slice(-6)}`,
      isPlaceholder: true
    }
  }

  // Pinterest Bulk Editor v2 format - 153 columns
  // This matches the official Pinterest template for managing promoted pins and ads
  const headers = [
    'Campaign ID', 'Campaign Objective', 'Campaign Name', 'Campaign Status', 'Lifetime Spend Limit',
    'Daily Spend Limit', 'Campaign Order Line ID', 'Campaign Third Party Tracking Urls', 'Campaign Budget',
    'Default Ad Group Budget', 'Campaign Start Date', 'Campaign Start Time', 'Campaign End Date',
    'Campaign End Time', 'Performance+ daily budget', 'Campaign Keyword (Match Type NEGATIVE_PHRASE)',
    'Campaign Keyword (Match Type NEGATIVE_EXACT)', 'Ad Group ID', 'Ad Group Name', 'Ad Group Start Date*',
    'Ad Group Start Time', 'Ad Group End Date*', 'Ad Group End Time', 'Ad Group Budget', 'Ad Group Pacing Type',
    'Ad Group Budget Type', 'Ad Group Status', 'Max Bid', 'Monthly Frequency Cap', 'Ad Group Third Party Tracking Urls',
    'Performance+ Targeting', 'Ad Placement', 'Goal Value', 'Conversion Tag ID', 'Conversion Event',
    'Conversion Optimization', 'Click Window Days', 'Engagement Window Days', 'View Window Days',
    'Frequency Target Time Range', 'Frequency Target', 'Bid strategy type', 'Targeting Template ID',
    'Promo Id', 'Locations', 'Geos', 'Genders', 'AgeBuckets', 'Languages', 'Devices', 'Interests',
    'Included Audiences', 'Excluded Audiences', 'Dynamic Retargeting Lookback', 'Dynamic Retargeting Exclusion',
    'Dynamic Retargeting Event Tag Types', 'Ad Group Keyword (Match Type BROAD)', 'Ad Group Keyword (Match Type EXACT)',
    'Ad Group Keyword (Match Type PHRASE)', 'Ad Group Keyword (Match Type NEGATIVE_PHRASE)',
    'Ad Group Keyword (Match Type NEGATIVE_EXACT)', 'Existing Pin ID', 'Media File Name', 'Pin Title',
    'Pin Description', 'Organic Pin URL', 'Image Alternative Text', 'Is Ad-only Pin', 'Promoted Pin Status',
    'Promoted Pin ID', 'Ad Format', 'Promoted Pin Name', 'Promoted Pin URL', 'Promoted Pin Third Party Tracking Urls',
    'Is Removable Pin Promotion', 'Carousel Card 1 Image File Name', 'Carousel Card 1 Title',
    'Carousel Card 1 Description', 'Carousel Card 1 Organic Pin URL', 'Carousel Card 1 Destination URL',
    'Carousel Card 1 Android Deep Link', 'Carousel Card 1 iOS Deep Link', 'Carousel Card 2 Image File Name',
    'Carousel Card 2 Title', 'Carousel Card 2 Description', 'Carousel Card 2 Organic Pin URL',
    'Carousel Card 2 Destination URL', 'Carousel Card 2 Android Deep Link', 'Carousel Card 2 iOS Deep Link',
    'Carousel Card 3 Image File Name', 'Carousel Card 3 Title', 'Carousel Card 3 Description',
    'Carousel Card 3 Organic Pin URL', 'Carousel Card 3 Destination URL', 'Carousel Card 3 Android Deep Link',
    'Carousel Card 3 iOS Deep Link', 'Carousel Card 4 Image File Name', 'Carousel Card 4 Title',
    'Carousel Card 4 Description', 'Carousel Card 4 Organic Pin URL', 'Carousel Card 4 Destination URL',
    'Carousel Card 4 Android Deep Link', 'Carousel Card 4 iOS Deep Link', 'Carousel Card 5 Image File Name',
    'Carousel Card 5 Title', 'Carousel Card 5 Description', 'Carousel Card 5 Organic Pin URL',
    'Carousel Card 5 Destination URL', 'Carousel Card 5 Android Deep Link', 'Carousel Card 5 iOS Deep Link',
    'Collections Secondary Creative Destination Url', 'Title Card Organic PinID', 'Card 1 Organic PinID',
    'Card 2 Organic PinID', 'Card 3 Organic PinID', 'Card 4 Organic PinID', 'Quiz pin question 1 text',
    'Question 1 options text', 'Quiz pin question 2 text', 'Question 2 options text', 'Quiz pin question 3 text',
    'Question 3 options text', 'Result 1 organic Pin ID', 'Result 1 iOS deep link url', 'Result 1 Android deep link url',
    'Result 1 destination url', 'Result 2 organic Pin ID', 'Result 2 iOS deep link url', 'Result 2 Android deep link url',
    'Result 2 destination url', 'Result 3 organic Pin ID', 'Result 3 iOS deep link url', 'Result 3 Android deep link url',
    'Result 3 destination url', 'Grid Click Type', 'CTA Selection', 'Keyword Status', 'Keyword (Match Type BROAD)',
    'Keyword (Match Type EXACT)', 'Keyword (Match Type PHRASE)', 'Keyword (Match Type NEGATIVE_PHRASE)',
    'Keyword (Match Type NEGATIVE_EXACT)', 'Product Group ID', 'Product Group Reference ID', 'Product Group Name',
    'Product Group Status', 'Tracking Template', 'Shopping Collections Hero Pin ID', 'Shopping Collections Hero Pin URL',
    'Slideshow Collections Title', 'Slideshow Collections Description', 'Status', 'Version'
  ]

  // Track placeholder usage for summary warning
  let placeholderCount = 0
  let totalPins = 0

  // Create rows - one row per pin variation
  const rows: string[][] = []
  pins.forEach((pin) => {
    pin.variations.forEach((variation) => {
      totalPins++
      // Create an empty row with 153 columns
      const row = new Array(153).fill('')

      // Column 62: Media File Name (image URL)
      const imageResult = getImageUrl(variation.imageUrl, pin.id)
      row[62] = imageResult.url
      if (imageResult.isPlaceholder) placeholderCount++

      // Column 63: Pin Title (required)
      row[63] = variation.title.substring(0, 100)

      // Column 64: Pin Description (max 500 chars) with hashtags appended
      const tagsString = formatTagsForDescription(pin.suggestedTags, 5)
      const descriptionWithTags = variation.description + tagsString
      row[64] = descriptionWithTags.substring(0, 500)

      // Column 65: Organic Pin URL (destination link)
      row[65] = getLink(variation.link)

      // Column 66: Image Alternative Text
      row[66] = variation.altText.substring(0, 200)

      // Column 67: Is Ad-only Pin (NO for organic pins)
      row[67] = 'NO'

      // Column 151: Status (ACTIVE for ready to promote)
      row[151] = 'ACTIVE'

      // Column 152: Version (V2 required)
      row[152] = 'V2'

      rows.push(row)
    })
  })

  // Format CSV with proper escaping
  const headerRow = headers.map(h => `"${h}"`).join(',')

  const dataRows = rows.map(row => {
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

  return csvContent
}

// ============ START SERVER ============

export function startApiServer(): void {
  app.listen(PORT, () => {
    console.log(`\n🚀 API Server running at http://localhost:${PORT}`)
    console.log(`📚 Available endpoints:`)
    console.log(`   POST   /api/articles/generate`)
    console.log(`   GET    /api/dashboard`)
    console.log(`   GET    /api/dashboard/stats`)
    console.log(`   GET    /api/pins`)
    console.log(`   POST   /api/pins/:id/approve`)
    console.log(`   POST   /api/pins/:id/publish`)
    console.log(`   POST   /api/pins/export`)
    console.log(`   GET    /api/articles`)
    console.log(`   GET    /api/settings`)
    console.log(`   POST   /api/settings`)
    console.log(`   GET    /api/health\n`)
  })
}

// Start the server if this file is run directly
startApiServer()

export { app }
