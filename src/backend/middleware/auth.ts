import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { getDatabase } from '../database/database'

// Initialize API keys table
export function initializeApiKeysTable(): void {
  const db = getDatabase()
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      permissions TEXT NOT NULL DEFAULT '["read", "write"]'
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
  `)
}

// Hash an API key for storage
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// Generate a new API key
export function generateApiKey(name: string): { key: string; id: number } {
  const db = getDatabase()
  initializeApiKeysTable()

  // Generate a secure random API key
  const key = `bh_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = hashApiKey(key)
  const now = new Date().toISOString()

  const result = db.prepare(`
    INSERT INTO api_keys (key_hash, name, created_at)
    VALUES (?, ?, ?)
  `).run(keyHash, name, now)

  return { key, id: result.lastInsertRowid as number }
}

// Validate an API key
export function validateApiKey(key: string): { valid: boolean; name?: string; permissions?: string[] } {
  const db = getDatabase()
  initializeApiKeysTable()

  const keyHash = hashApiKey(key)

  const row = db.prepare(`
    SELECT name, permissions, is_active FROM api_keys WHERE key_hash = ?
  `).get(keyHash) as { name: string; permissions: string; is_active: number } | undefined

  if (!row || !row.is_active) {
    return { valid: false }
  }

  // Update last_used_at
  db.prepare(`UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?`)
    .run(new Date().toISOString(), keyHash)

  return {
    valid: true,
    name: row.name,
    permissions: JSON.parse(row.permissions)
  }
}

// List all API keys (without the actual keys)
export function listApiKeys(): Array<{
  id: number
  name: string
  createdAt: string
  lastUsedAt: string | null
  isActive: boolean
}> {
  const db = getDatabase()
  initializeApiKeysTable()

  const rows = db.prepare(`
    SELECT id, name, created_at, last_used_at, is_active FROM api_keys ORDER BY created_at DESC
  `).all() as Array<{
    id: number
    name: string
    created_at: string
    last_used_at: string | null
    is_active: number
  }>

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    isActive: row.is_active === 1
  }))
}

// Revoke an API key
export function revokeApiKey(id: number): boolean {
  const db = getDatabase()
  const result = db.prepare(`UPDATE api_keys SET is_active = 0 WHERE id = ?`).run(id)
  return result.changes > 0
}

// Delete an API key
export function deleteApiKey(id: number): boolean {
  const db = getDatabase()
  const result = db.prepare(`DELETE FROM api_keys WHERE id = ?`).run(id)
  return result.changes > 0
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKeyName?: string
      apiKeyPermissions?: string[]
    }
  }
}

/**
 * Authentication middleware
 * Checks for API key in Authorization header (Bearer token) or X-API-Key header
 *
 * Can be bypassed if API_AUTH_DISABLED=true in environment (for development)
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow bypassing auth in development
  if (process.env.API_AUTH_DISABLED === 'true') {
    return next()
  }

  // Allow health check without auth
  if (req.path === '/api/health') {
    return next()
  }

  // Get API key from headers
  let apiKey: string | undefined

  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7)
  } else if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'] as string
  }

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Provide via Authorization: Bearer <key> or X-API-Key header.'
    })
    return
  }

  const validation = validateApiKey(apiKey)

  if (!validation.valid) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or revoked API key'
    })
    return
  }

  // Attach API key info to request
  req.apiKeyName = validation.name
  req.apiKeyPermissions = validation.permissions

  next()
}

/**
 * Permission check middleware
 * Use after authMiddleware to check specific permissions
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.API_AUTH_DISABLED === 'true') {
      return next()
    }

    if (!req.apiKeyPermissions || !req.apiKeyPermissions.includes(permission)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `API key does not have '${permission}' permission`
      })
      return
    }

    next()
  }
}
