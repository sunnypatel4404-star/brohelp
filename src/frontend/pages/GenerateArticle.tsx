import { useState } from 'react'
import { generateArticle, getErrorMessage } from '../services/api'

export default function GenerateArticle() {
  const [topic, setTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [generateImage, setGenerateImage] = useState(true)
  const [uploadToWordPress, setUploadToWordPress] = useState(true)
  const [generatePins, setGeneratePins] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return

    setIsGenerating(true)
    setProgress('Starting article generation...')
    setError('')

    try {
      await generateArticle(topic, {
        generateImage,
        uploadToWordPress,
        generatePins
      })
      setProgress('Article generation started! This may take 1-2 minutes...')
      setTimeout(() => {
        setIsGenerating(false)
        setTopic('')
        setProgress('')
      }, 3000)
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      setIsGenerating(false)
      console.error('Generation error:', err)
    }
  }

  return (
    <div>
      <h1 className="section-title">Generate Article</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="card">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="form-label">Article Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Building independence in toddlers"
                  className="form-input"
                  disabled={isGenerating}
                />
              </div>

              <div>
                <label className="form-label">Generation Options</label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={generateImage}
                      onChange={(e) => setGenerateImage(e.target.checked)}
                      className="mr-2"
                      disabled={isGenerating}
                    />
                    <span>Generate featured image</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={uploadToWordPress}
                      onChange={(e) => setUploadToWordPress(e.target.checked)}
                      className="mr-2"
                      disabled={isGenerating}
                    />
                    <span>Auto-upload to WordPress</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={generatePins}
                      onChange={(e) => setGeneratePins(e.target.checked)}
                      className="mr-2"
                      disabled={isGenerating}
                    />
                    <span>Generate Pinterest pins</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !topic}
                className={`btn-primary w-full ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGenerating ? 'Generating...' : '✨ Generate Article'}
              </button>
            </form>

            {isGenerating && (
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center mb-3">
                  <div className="animate-spin mr-3">⏳</div>
                  <span className="text-blue-700 font-medium">{progress}</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full w-1/3 animate-pulse"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card h-fit">
          <h3 className="font-bold mb-4">How It Works</h3>
          <ol className="space-y-2 text-sm">
            <li><strong>1.</strong> Enter your topic</li>
            <li><strong>2.</strong> AI generates article content</li>
            <li><strong>3.</strong> DALL-E creates on-brand image</li>
            <li><strong>4.</strong> Article uploads to WordPress</li>
            <li><strong>5.</strong> 5 Pinterest pins auto-generated</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
