import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard, getErrorMessage } from '../services/api'

interface DashboardStats {
  articles: { total: number; drafts: number; published: number }
  pins: { total: number; draft: number; approved: number; published: number }
  images: { total: number }
}

interface ContentItem {
  id: string
  type: 'article' | 'pin' | 'image'
  title: string
  status: string
  createdAt: string
  pinCount?: number
  url?: string
}

interface SavedPin {
  id: string
  articleTitle: string
  status: string
  createdAt: string
  variations: Array<{
    imageUrl?: string
    title: string
  }>
}

interface DashboardData {
  stats: DashboardStats
  recentContent: ContentItem[]
  allPins: SavedPin[]
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)
      const result = await getDashboard()
      setData(result)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Failed to load dashboard: {error}</p>
        <button onClick={loadDashboard} className="btn-primary mt-2">
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    { label: 'Total Pins', value: data.stats.pins.total, color: 'bg-purple-100 text-purple-700' },
    { label: 'Draft Pins', value: data.stats.pins.draft, color: 'bg-yellow-100 text-yellow-700' },
    { label: 'Approved Pins', value: data.stats.pins.approved, color: 'bg-blue-100 text-blue-700' },
    { label: 'Published Pins', value: data.stats.pins.published, color: 'bg-green-100 text-green-700' },
    { label: 'Images Generated', value: data.stats.images.total, color: 'bg-pink-100 text-pink-700' },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="section-title mb-0">Dashboard</h1>
        <button onClick={loadDashboard} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="card">
            <div className={`text-3xl font-bold mb-2 ${stat.color} inline-block px-3 py-1 rounded-lg`}>
              {stat.value}
            </div>
            <p className="text-gray-600 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
            {data.allPins.length === 0 ? (
              <p className="text-gray-500">No recent activity. Generate your first article!</p>
            ) : (
              <div className="space-y-3">
                {data.allPins.slice(0, 8).map((pin) => {
                  const imageUrl = pin.variations[0]?.imageUrl
                  return (
                    <Link
                      key={pin.id}
                      to={`/pins?id=${pin.id}`}
                      className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 hover:border-gray-200 transition-colors cursor-pointer"
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
                            📌
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{pin.articleTitle}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            pin.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                            pin.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                            pin.status === 'published' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {pin.status}
                          </span>
                          <span>{pin.variations.length} pins</span>
                          <span>•</span>
                          <span>{formatTimeAgo(pin.createdAt)}</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="text-gray-400 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card h-fit">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/generate" className="btn-primary w-full text-center block">Generate Article</a>
            <a href="/pins" className="btn-secondary w-full text-center block">Manage Pins</a>
            <a href="/library" className="btn-secondary w-full text-center block">View Library</a>
          </div>
        </div>
      </div>
    </div>
  )
}
