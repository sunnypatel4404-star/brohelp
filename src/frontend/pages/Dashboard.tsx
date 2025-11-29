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

interface WordPressPost {
  id: number
  title: string
  status: string
  slug: string
  date: string
}

interface WordPressSyncData {
  posts: WordPressPost[]
  count: number
  published: number
  drafts: number
  syncedAt: string
  synced: boolean
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [wpData, setWpData] = useState<WordPressSyncData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)

      // Load both dashboard data and WordPress posts in parallel
      const [dashResult, wpResult] = await Promise.all([
        getDashboard(),
        fetch('http://localhost:5000/api/wordpress/posts').then(r => r.json()).catch(() => null)
      ])

      setData(dashResult)
      setWpData(wpResult)
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

  const wordpressUrl = 'https://parentvillage.blog'

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="section-title mb-0">Dashboard</h1>
        <button onClick={loadDashboard} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      {/* WordPress Stats */}
      {wpData?.synced && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">WordPress Posts</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-3xl font-bold text-blue-700 mb-2">{wpData.count}</div>
              <p className="text-gray-600 text-sm">Total Posts</p>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-green-700 mb-2">{wpData.published}</div>
              <p className="text-gray-600 text-sm">Published</p>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-yellow-700 mb-2">{wpData.drafts}</div>
              <p className="text-gray-600 text-sm">Drafts</p>
            </div>
            <div className="card">
              <div className="text-sm text-gray-500">Last Synced</div>
              <div className="text-base font-semibold text-gray-700 mt-1">
                {formatTimeAgo(wpData.syncedAt)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pin Stats */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Pinterest Pins</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card">
            <div className="text-3xl font-bold bg-purple-100 text-purple-700 inline-block px-3 py-1 rounded-lg mb-2">
              {data.stats.pins.total}
            </div>
            <p className="text-gray-600 text-sm">Total Pins</p>
          </div>
          <div className="card">
            <div className="text-3xl font-bold bg-yellow-100 text-yellow-700 inline-block px-3 py-1 rounded-lg mb-2">
              {data.stats.pins.draft}
            </div>
            <p className="text-gray-600 text-sm">Draft Pins</p>
          </div>
          <div className="card">
            <div className="text-3xl font-bold bg-blue-100 text-blue-700 inline-block px-3 py-1 rounded-lg mb-2">
              {data.stats.pins.approved}
            </div>
            <p className="text-gray-600 text-sm">Approved</p>
          </div>
          <div className="card">
            <div className="text-3xl font-bold bg-green-100 text-green-700 inline-block px-3 py-1 rounded-lg mb-2">
              {data.stats.pins.published}
            </div>
            <p className="text-gray-600 text-sm">Published</p>
          </div>
          <div className="card">
            <div className="text-3xl font-bold bg-pink-100 text-pink-700 inline-block px-3 py-1 rounded-lg mb-2">
              {data.stats.images.total}
            </div>
            <p className="text-gray-600 text-sm">Images</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent WordPress Posts */}
        <div className="lg:col-span-2">
          {wpData?.synced && wpData.posts.length > 0 && (
            <div className="card mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Recent WordPress Posts</h2>
                <Link to="/library" className="text-sm text-blue-600 hover:text-blue-800">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {wpData.posts.slice(0, 5).map((post) => {
                  const linkUrl = post.status === 'draft'
                    ? `${wordpressUrl}/wp-admin/post.php?post=${post.id}&action=edit`
                    : `${wordpressUrl}/?p=${post.id}`

                  return (
                    <a
                      key={post.id}
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {post.title || '(Untitled)'}
                        </p>
                      </div>
                      <span className={`ml-3 px-2 py-0.5 rounded text-xs flex-shrink-0 ${
                        post.status === 'publish'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {post.status}
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Pin Activity */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Recent Pin Activity</h2>
            {data.allPins.length === 0 ? (
              <p className="text-gray-500">No pin activity yet. Generate your first article!</p>
            ) : (
              <div className="space-y-3">
                {data.allPins.slice(0, 5).map((pin) => {
                  const imageUrl = pin.variations[0]?.imageUrl
                  return (
                    <Link
                      key={pin.id}
                      to={`/pins?id=${pin.id}`}
                      className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 hover:border-gray-200 transition-colors cursor-pointer"
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
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
                          <div className="w-full h-full flex items-center justify-center text-xl text-gray-400">
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
            <Link to="/generate" className="btn-primary w-full text-center block">
              Generate Article
            </Link>
            <Link to="/pins" className="btn-secondary w-full text-center block">
              Manage Pins
            </Link>
            <Link to="/library" className="btn-secondary w-full text-center block">
              View Library
            </Link>
          </div>

          {!wpData?.synced && (
            <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                Run <code className="bg-yellow-100 px-1 rounded">npm run sync-wordpress</code> to sync posts from WordPress.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
