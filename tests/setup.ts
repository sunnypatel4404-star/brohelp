import dotenv from 'dotenv'

// Load test environment variables
dotenv.config({ path: '.env.test' })

// Set default test environment variables
process.env.NODE_ENV = 'test'
process.env.API_AUTH_DISABLED = 'true'
process.env.LOG_LEVEL = 'error'  // Reduce log noise during tests

// Mock the database path for tests
process.env.DB_PATH = './data/test.db'

// Global test timeout
jest.setTimeout(30000)

// Clean up after all tests
afterAll(async () => {
  // Give time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100))
})
