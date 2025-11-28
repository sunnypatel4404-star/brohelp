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

export async function exportPins(status?: string, format: 'csv' | 'json' = 'csv') {
  const response = await api.post('/pins/export', {
    status,
    format
  })
  return response.data
}

export async function exportPinsAsCSV(status?: string): Promise<Blob> {
  const response = await api.post('/pins/export', {
    status,
    format: 'csv'
  }, {
    responseType: 'blob'
  })
  return response.data
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
