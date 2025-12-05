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

// Stat card with icon and gradient accent
function StatCard({ value, label, icon, color }: { value: number; label: string; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    terracotta: 'from-terracotta-400 to-terracotta-500',
    sage: 'from-sage-400 to-sage-500',
    mustard: 'from-mustard-400 to-mustard-500',
    coral: 'from-coral-400 to-coral-500',
    brand: 'from-brand-400 to-brand-500',
  }

  return (
    <div className="stat-card group">
      <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${colorClasses[color] || colorClasses.brand} rounded-l-2xl`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-value">{value}</p>
          <p className="stat-label">{label}</p>
        </div>
        <span className="text-3xl opacity-80 group-hover:scale-110 group-hover:animate-wiggle transition-transform duration-300">
          {icon}
        </span>
      </div>
    </div>
  )
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

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="h-10 w-48 skeleton" />
          <div className="h-10 w-24 skeleton" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 skeleton" />
          <div className="h-96 skeleton" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert-error">
        <div className="flex items-start gap-3">
          <span className="text-2xl">😕</span>
          <div>
            <p className="font-semibold">Oops! Something went wrong</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadDashboard} className="btn-primary mt-4">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const wordpressUrl = 'https://parentvillage.blog'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="section-title mb-1">Welcome Back! 👋</h1>
          <p className="text-brand-500">Here's what's happening with your content</p>
        </div>
        <button
          onClick={loadDashboard}
          className="btn-secondary inline-flex items-center gap-2 self-start"
        >
          <span>↻</span>
          Refresh
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 stagger-animation">
        {wpData?.synced && (
          <StatCard value={wpData.count} label="Total Posts" icon="📝" color="brand" />
        )}
        <StatCard value={data.stats.pins.total} label="Pinterest Pins" icon="📌" color="terracotta" />
        <StatCard value={data.stats.pins.draft} label="Draft Pins" icon="✏️" color="mustard" />
        <StatCard value={data.stats.pins.approved} label="Approved" icon="✅" color="sage" />
        <StatCard value={data.stats.images.total} label="Images" icon="🖼️" color="coral" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Posts & Pins */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent WordPress Posts */}
          {wpData?.synced && wpData.posts.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                    <span className="text-xl">📄</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-brand-800">Recent Posts</h2>
                    <p className="text-xs text-brand-400">From WordPress</p>
                  </div>
                </div>
                <Link to="/library" className="text-sm font-medium text-terracotta-500 hover:text-terracotta-600 transition-colors">
                  View all →
                </Link>
              </div>
              <div className="space-y-3">
                {wpData.posts.slice(0, 4).map((post, index) => {
                  const linkUrl = post.status === 'draft'
                    ? `${wordpressUrl}/wp-admin/post.php?post=${post.id}&action=edit`
                    : `${wordpressUrl}/?p=${post.id}`

                  return (
                    <a
                      key={post.id}
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="list-item"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">
                          {post.status === 'publish' ? '✨' : '📝'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-brand-800 truncate">
                          {post.title || '(Untitled)'}
                        </p>
                        <p className="text-xs text-brand-400 mt-0.5">
                          {formatTimeAgo(post.date)}
                        </p>
                      </div>
                      <span className={`badge ${
                        post.status === 'publish' ? 'badge-published' : 'badge-draft'
                      }`}>
                        {post.status === 'publish' ? 'Published' : 'Draft'}
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Pin Activity */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-terracotta-100 to-mustard-100 flex items-center justify-center">
                  <span className="text-xl">📌</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-brand-800">Pin Activity</h2>
                  <p className="text-xs text-brand-400">Your Pinterest pins</p>
                </div>
              </div>
              <Link to="/pins" className="text-sm font-medium text-terracotta-500 hover:text-terracotta-600 transition-colors">
                Manage pins →
              </Link>
            </div>

            {data.allPins.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl block mb-4">🎨</span>
                <p className="text-brand-600 font-medium">No pins yet!</p>
                <p className="text-sm text-brand-400 mt-1">Generate your first article to create pins</p>
                <Link to="/generate" className="btn-primary inline-block mt-4">
                  Create Article
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.allPins.slice(0, 4).map((pin, index) => {
                  const imageUrl = pin.variations[0]?.imageUrl
                  return (
                    <Link
                      key={pin.id}
                      to={`/pins?id=${pin.id}`}
                      className="list-item"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-cream-100 border border-cream-200">
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
                          <div className="w-full h-full flex items-center justify-center text-xl text-brand-300">
                            📌
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-brand-800 truncate">{pin.articleTitle}</p>
                        <div className="flex items-center gap-2 text-xs text-brand-400 mt-1">
                          <span>{pin.variations.length} pins</span>
                          <span>•</span>
                          <span>{formatTimeAgo(pin.createdAt)}</span>
                        </div>
                      </div>
                      <span className={`badge ${
                        pin.status === 'draft' ? 'badge-draft' :
                        pin.status === 'approved' ? 'badge-approved' :
                        pin.status === 'published' ? 'badge-published' :
                        'badge-pending'
                      }`}>
                        {pin.status}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="card">
            <h2 className="text-xl font-bold text-brand-800 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                to="/generate"
                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-terracotta-100 to-mustard-100 border border-terracotta-200 hover:shadow-warm transition-all duration-300 hover:-translate-y-0.5"
              >
                <span className="text-3xl">✨</span>
                <div>
                  <p className="font-semibold text-brand-800">Create Article</p>
                  <p className="text-xs text-brand-500">AI-powered content</p>
                </div>
              </Link>
              <Link
                to="/pins"
                className="flex items-center gap-4 p-4 rounded-xl bg-cream-100 border border-cream-200 hover:border-cream-300 hover:shadow-warm transition-all duration-300 hover:-translate-y-0.5"
              >
                <span className="text-3xl">📌</span>
                <div>
                  <p className="font-semibold text-brand-800">Pin Studio</p>
                  <p className="text-xs text-brand-500">Manage Pinterest</p>
                </div>
              </Link>
              <Link
                to="/library"
                className="flex items-center gap-4 p-4 rounded-xl bg-cream-100 border border-cream-200 hover:border-cream-300 hover:shadow-warm transition-all duration-300 hover:-translate-y-0.5"
              >
                <span className="text-3xl">📚</span>
                <div>
                  <p className="font-semibold text-brand-800">Content Library</p>
                  <p className="text-xs text-brand-500">Browse all content</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Sync Status */}
          {!wpData?.synced && (
            <div className="card bg-gradient-to-br from-mustard-50 to-mustard-100 border-mustard-200">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔄</span>
                <div>
                  <p className="font-semibold text-mustard-700">WordPress Not Synced</p>
                  <p className="text-sm text-mustard-600 mt-1">
                    Run the sync command to see your posts here:
                  </p>
                  <code className="block mt-2 p-2 bg-white/50 rounded-lg text-xs text-mustard-800 font-mono">
                    npm run sync-wordpress
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Stats Overview */}
          {wpData?.synced && (
            <div className="card">
              <h2 className="text-xl font-bold text-brand-800 mb-4">Overview</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-brand-600">Published Posts</span>
                  <span className="font-bold text-sage-600">{wpData.published}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(wpData.published / wpData.count) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-600">Draft Posts</span>
                  <span className="font-bold text-mustard-600">{wpData.drafts}</span>
                </div>
                <div className="text-xs text-brand-400 pt-2 border-t border-cream-200">
                  Last synced: {formatTimeAgo(wpData.syncedAt)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
