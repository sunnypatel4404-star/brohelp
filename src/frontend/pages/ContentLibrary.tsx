import { useState, useEffect } from 'react'
import { getPins, getErrorMessage } from '../services/api'

interface Article {
  id: string
  articleTitle: string
  status: 'draft' | 'approved' | 'published'
  createdAt: string
}

export default function ContentLibrary() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadArticles()
  }, [])

  const loadArticles = async () => {
    try {
      setLoading(true)
      console.log('Fetching pins...')
      const data = await getPins()
      console.log('Pins data:', data)
      if (data.pins && Array.isArray(data.pins)) {
        const articles = data.pins.map((pin: any) => {
          // Extract WordPress post ID from articleId field
          let postId = pin.id
          if (pin.articleId) {
            if (typeof pin.articleId === 'object' && pin.articleId.id) {
              postId = pin.articleId.id
            } else if (typeof pin.articleId === 'string') {
              postId = pin.articleId
            }
          }
          return {
            id: postId,
            articleTitle: pin.articleTitle,
            status: pin.status || 'draft',
            createdAt: pin.createdAt
          }
        })
        console.log('Mapped articles:', articles)
        setArticles(articles)
      } else {
        console.log('No pins in response')
      }
      setError('')
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      console.error('Error loading articles:', errorMsg, err)
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

  const publishedCount = articles.filter(a => a.status === 'published').length
  const draftCount = articles.filter(a => a.status === 'draft').length

  return (
    <div>
      <h1 className="section-title">Content Library</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-3xl font-bold text-blue-700 mb-2">{articles.length}</div>
          <p className="text-gray-600">Total Articles</p>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-green-700 mb-2">{publishedCount}</div>
          <p className="text-gray-600">Published</p>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-yellow-700 mb-2">{draftCount}</div>
          <p className="text-gray-600">Drafts</p>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-purple-700 mb-2">{articles.length}</div>
          <p className="text-gray-600">Total Articles</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-6">All Articles</h2>
        {articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No articles yet. Generate your first article to see it here!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => {
              const createdDate = new Date(article.createdAt).toLocaleDateString()
              const wordpressUrl = import.meta.env.VITE_WORDPRESS_URL || 'https://parentvillage.blog'
              const draftEditUrl = `${wordpressUrl}/wp-admin/post.php?post=${article.id}&action=edit`
              const liveUrl = `${wordpressUrl}/?p=${article.id}`
              const linkUrl = article.status === 'draft' ? draftEditUrl : liveUrl

              return (
                <a
                  key={article.id}
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-brand-300 cursor-pointer transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 hover:text-brand-700">{article.articleTitle}</h3>
                      <p className="text-sm text-gray-500 mt-1">{createdDate}</p>
                    </div>
                    <div className="text-right ml-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          article.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {article.status}
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
    </div>
  )
}
