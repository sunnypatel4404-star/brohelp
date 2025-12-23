import winston from 'winston'
import * as path from 'path'
import * as fs from 'fs'

// Ensure logs directory exists
const LOGS_DIR = './logs'
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true })
}

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} ${level}: ${message}${metaStr}`
  })
)

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: { service: 'brohelp' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    }),
    // API access log
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'api.log'),
      level: 'http',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
})

// Add console output for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }))
}

// Specialized loggers for different contexts
export const apiLogger = logger.child({ context: 'api' })
export const jobLogger = logger.child({ context: 'job' })
export const wordpressLogger = logger.child({ context: 'wordpress' })
export const imageLogger = logger.child({ context: 'image' })
export const pinLogger = logger.child({ context: 'pin' })

// Express request logging middleware
export function requestLogger(req: { method: string; path: string; ip?: string }, res: { statusCode: number }, responseTime: number): void {
  apiLogger.http('Request', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip
  })
}

// Job lifecycle logging
export const jobLifecycle = {
  started: (jobId: string, topic: string) => {
    jobLogger.info('Job started', { jobId, topic })
  },
  stepStarted: (jobId: string, step: string) => {
    jobLogger.info('Job step started', { jobId, step })
  },
  stepCompleted: (jobId: string, step: string, duration?: number) => {
    jobLogger.info('Job step completed', { jobId, step, duration })
  },
  stepFailed: (jobId: string, step: string, error: string) => {
    jobLogger.error('Job step failed', { jobId, step, error })
  },
  completed: (jobId: string, result: Record<string, unknown>) => {
    jobLogger.info('Job completed', { jobId, ...result })
  },
  failed: (jobId: string, error: string) => {
    jobLogger.error('Job failed', { jobId, error })
  }
}

// WordPress operations logging
export const wordpressLifecycle = {
  postCreated: (postId: number, title: string) => {
    wordpressLogger.info('Post created', { postId, title })
  },
  postUpdated: (postId: number) => {
    wordpressLogger.info('Post updated', { postId })
  },
  mediaUploaded: (attachmentId: number, filename: string) => {
    wordpressLogger.info('Media uploaded', { attachmentId, filename })
  },
  error: (operation: string, error: string) => {
    wordpressLogger.error('WordPress error', { operation, error })
  }
}

// Image generation logging
export const imageLifecycle = {
  started: (topic: string, type: string) => {
    imageLogger.info('Image generation started', { topic, type })
  },
  completed: (topic: string, path: string, duration: number) => {
    imageLogger.info('Image generation completed', { topic, path, duration })
  },
  failed: (topic: string, error: string) => {
    imageLogger.error('Image generation failed', { topic, error })
  }
}

// Pin operations logging
export const pinLifecycle = {
  created: (pinId: string, articleTitle: string, variationCount: number) => {
    pinLogger.info('Pin created', { pinId, articleTitle, variationCount })
  },
  statusChanged: (pinId: string, oldStatus: string, newStatus: string) => {
    pinLogger.info('Pin status changed', { pinId, oldStatus, newStatus })
  },
  exported: (count: number, format: string) => {
    pinLogger.info('Pins exported', { count, format })
  }
}

export default logger
