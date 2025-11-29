import { useState, useEffect } from 'react'
import { getErrorMessage } from '../services/api'

interface WordPressPost {
  id: number
  title: string
  status: string
  slug: string
  date: string
}

interface SyncData {
  posts: WordPressPost[]
  count: number
  published: number
  drafts: number
  syncedAt: string
  synced: boolean
  message?: string
}

export default function ContentLibrary() {
  const [syncData, setSyncData] = useState<SyncData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'publish' | 'draft'>('all')

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:5000/api/wordpress/posts')
      const data = await response.json()
      setSyncData(data)
      setError('')
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      console.error('Error loading posts:', errorMsg)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-gray-600">Loading articles...</p>
        </div>
      </div>
    )
  }

  const posts = syncData?.posts || []
  const filteredPosts = filter === 'all'
    ? posts
    : posts.filter(p => p.status === filter)

  const wordpressUrl = 'https://parentvillage.blog'

  return (
    <div>
      <h1 className="section-title">Content Library</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {!syncData?.synced && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-700">
            No synced posts found. Run <code className="bg-yellow-100 px-2 py-1 rounded">npm run sync-wordpress</code> to pull posts from WordPress.
          </p>
        </div>
      )}

      {syncData?.synced && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="text-3xl font-bold text-blue-700 mb-2">{syncData.count}</div>
              <p className="text-gray-600">Total Posts</p>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-green-700 mb-2">{syncData.published}</div>
              <p className="text-gray-600">Published</p>
            </div>
            <div className="card">
              <div className="text-3xl font-bold text-yellow-700 mb-2">{syncData.drafts}</div>
              <p className="text-gray-600">Drafts</p>
            </div>
            <div className="card">
              <div className="text-sm text-gray-500">Last Synced</div>
              <div className="text-lg font-semibold text-gray-700">
                {new Date(syncData.syncedAt).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">All Posts</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({syncData.count})
                </button>
                <button
                  onClick={() => setFilter('publish')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === 'publish'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Published ({syncData.published})
                </button>
                <button
                  onClick={() => setFilter('draft')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === 'draft'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Drafts ({syncData.drafts})
                </button>
              </div>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No posts match the current filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post) => {
                  const linkUrl = post.status === 'draft'
                    ? `${wordpressUrl}/wp-admin/post.php?post=${post.id}&action=edit`
                    : `${wordpressUrl}/?p=${post.id}`

                  return (
                    <a
                      key={post.id}
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-brand-300 cursor-pointer transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 hover:text-brand-700">
                            {post.title || '(Untitled)'}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            ID: {post.id} {post.date && `• ${post.date}`}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              post.status === 'publish'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {post.status}
                          </span>
                          <p className="text-xs text-blue-600 mt-2 font-medium">Click to open →</p>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
