import { generateApiKey, validateApiKey, listApiKeys, revokeApiKey, initializeApiKeysTable } from '../src/backend/middleware/auth'
import { getDatabase, closeDatabase } from '../src/backend/database/database'

describe('Authentication Middleware', () => {
  beforeAll(() => {
    getDatabase()
    initializeApiKeysTable()
  })

  afterAll(() => {
    closeDatabase()
  })

  describe('API Key Generation', () => {
    it('should generate a new API key', () => {
      const result = generateApiKey('Test Key')

      expect(result.key).toBeDefined()
      expect(result.key.startsWith('bh_')).toBe(true)
      expect(result.id).toBeGreaterThan(0)
    })

    it('should generate unique keys', () => {
      const key1 = generateApiKey('Key 1')
      const key2 = generateApiKey('Key 2')

      expect(key1.key).not.toBe(key2.key)
    })
  })

  describe('API Key Validation', () => {
    it('should validate a valid API key', () => {
      const { key } = generateApiKey('Validation Test')
      const result = validateApiKey(key)

      expect(result.valid).toBe(true)
      expect(result.name).toBe('Validation Test')
      expect(result.permissions).toContain('read')
      expect(result.permissions).toContain('write')
    })

    it('should reject an invalid API key', () => {
      const result = validateApiKey('invalid_key_12345')

      expect(result.valid).toBe(false)
    })

    it('should reject a revoked API key', () => {
      const { key, id } = generateApiKey('Revoke Test')
      revokeApiKey(id)

      const result = validateApiKey(key)
      expect(result.valid).toBe(false)
    })
  })

  describe('API Key Management', () => {
    it('should list all API keys', () => {
      const keys = listApiKeys()

      expect(Array.isArray(keys)).toBe(true)
      expect(keys.length).toBeGreaterThan(0)
    })

    it('should revoke an API key', () => {
      const { id } = generateApiKey('To Revoke')
      const success = revokeApiKey(id)

      expect(success).toBe(true)
    })
  })
})
