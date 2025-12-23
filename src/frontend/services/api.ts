import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// ============ ARTICLE GENERATION ============

export async function generateArticle(
  topic: string,
  options?: {
    generateImage?: boolean
    uploadToWordPress?: boolean
    generatePins?: boolean
  }
) {
  const response = await api.post('/articles/generate', {
    topic,
    generateImage: options?.generateImage ?? true,
    uploadToWordPress: options?.uploadToWordPress ?? true,
    generatePins: options?.generatePins ?? true
  })
  return response.data
}

// ============ DASHBOARD ============

export async function getDashboard() {
  const response = await api.get('/dashboard')
  return response.data
}

export async function getDashboardStats() {
  const response = await api.get('/dashboard/stats')
  return response.data
}

export async function getActivity(days: number = 7) {
  const response = await api.get('/dashboard/activity', {
    params: { days }
  })
  return response.data
}

// ============ PIN MANAGEMENT ============

export async function getPins(status?: string) {
  const response = await api.get('/pins', {
    params: status ? { status } : {}
  })
  return response.data
}

export async function getPin(id: string) {
  const response = await api.get(`/pins/${id}`)
  return response.data
}

export async function approvePin(id: string) {
  const response = await api.post(`/pins/${id}/approve`)
  return response.data
}

export async function publishPin(id: string) {
  const response = await api.post(`/pins/${id}/publish`)
  return response.data
}

// Pinterest allows max 200 rows per CSV upload
export const PINTEREST_MAX_ROWS = 200

export interface ExportInfo {
  totalPins: number
  totalRows: number
  pinterestMaxRows: number
  totalPages: number
  pages: Array<{ page: number; startRow: number; endRow: number }>
}

export async function getExportInfo(status?: string): Promise<ExportInfo> {
  const response = await api.get('/pins/export/info', {
    params: { status }
  })
  return response.data
}

export async function exportPins(status?: string, format: 'csv' | 'json' = 'csv', page: number = 1) {
  const response = await api.post('/pins/export', {
    status,
    format,
    page
  })
  return response.data
}

export interface CSVExportResult {
  blob: Blob
  totalPages: number
  currentPage: number
  totalRows: number
  rowsInPage: number
}

export async function exportPinsAsCSV(status?: string, page: number = 1, pinId?: string): Promise<CSVExportResult> {
  const response = await api.post('/pins/export', {
    status,
    format: 'csv',
    page,
    pinId
  }, {
    responseType: 'blob'
  })

  // Extract pagination info from headers
  const totalPages = parseInt(response.headers['x-total-pages'] || '1', 10)
  const currentPage = parseInt(response.headers['x-current-page'] || '1', 10)
  const totalRows = parseInt(response.headers['x-total-rows'] || '0', 10)
  const rowsInPage = parseInt(response.headers['x-rows-in-page'] || '0', 10)

  return {
    blob: response.data,
    totalPages,
    currentPage,
    totalRows,
    rowsInPage
  }
}

// Export all pages as separate CSV files (for convenience)
export async function exportAllPinsAsCSV(status?: string): Promise<CSVExportResult[]> {
  const info = await getExportInfo(status)
  const results: CSVExportResult[] = []

  for (let page = 1; page <= info.totalPages; page++) {
    const result = await exportPinsAsCSV(status, page)
    results.push(result)
  }

  return results
}

// Generate pins from a WordPress article URL
export interface GeneratePinsFromUrlResponse {
  success: boolean
  message: string
  pin: {
    id: string
    articleTitle: string
    variations: Array<{
      angle: string
      title: string
      description: string
      imageUrl?: string
      link: string
      altText: string
    }>
    status: string
    createdAt: string
  }
}

export async function generatePinsFromUrl(articleUrl: string, pinCount: number = 3): Promise<GeneratePinsFromUrlResponse> {
  const response = await api.post('/pins/generate-from-url', {
    articleUrl,
    pinCount
  })
  return response.data
}

// Export selected pins by IDs
export async function exportSelectedPinsAsCSV(pinIds: string[]): Promise<CSVExportResult> {
  const response = await api.post('/pins/export-selected', {
    pinIds,
    format: 'csv'
  }, {
    responseType: 'blob'
  })

  const totalRows = parseInt(response.headers['x-total-rows'] || '0', 10)

  return {
    blob: response.data,
    totalPages: 1,
    currentPage: 1,
    totalRows,
    rowsInPage: totalRows
  }
}

// ============ CONTENT LIBRARY ============

export async function getArticles() {
  const response = await api.get('/articles')
  return response.data
}

// ============ SETTINGS ============

export interface Settings {
  wordpress: {
    blogUrl: string
    username: string
    configured: boolean
  }
  content: {
    publishingFrequency: string
    minWordCount: number
    maxWordCount: number
    generateFeaturedImage: boolean
    autoUploadToWordPress: boolean
    generatePinterestPins: boolean
  }
}

export async function getSettings(): Promise<Settings> {
  const response = await api.get('/settings')
  return response.data
}

export async function saveSettings(settings: Partial<Settings>) {
  const response = await api.post('/settings', settings)
  return response.data
}

// ============ JOBS ============

export interface JobStatus {
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

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await api.get(`/jobs/${jobId}`)
  return response.data
}

export async function getJobs(): Promise<{ jobs: JobStatus[]; count: number }> {
  const response = await api.get('/jobs')
  return response.data
}

// ============ HEALTH CHECK ============

export async function checkHealth() {
  const response = await api.get('/health')
  return response.data
}

// ============ ERROR HANDLING ============

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.message || 'An error occurred'
  }
  return error instanceof Error ? error.message : 'An error occurred'
}

export default api
