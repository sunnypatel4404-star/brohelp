import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateArticle, getJobStatus, getErrorMessage } from '../services/api'
import type { JobStatus } from '../services/api'

type StepStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

interface Step {
  key: keyof JobStatus['steps']
  label: string
  icon: string
}

const STEPS: Step[] = [
  { key: 'article', label: 'Generating article content', icon: '📝' },
  { key: 'image', label: 'Creating featured image', icon: '🎨' },
  { key: 'wordpress', label: 'Uploading to WordPress', icon: '📤' },
  { key: 'pins', label: 'Generating Pinterest pins', icon: '📌' },
]

export default function GenerateArticle() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [generateImage, setGenerateImage] = useState(true)
  const [uploadToWordPress, setUploadToWordPress] = useState(true)
  const [generatePins, setGeneratePins] = useState(true)
  const [job, setJob] = useState<JobStatus | null>(null)
  const pollIntervalRef = useRef<number | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const pollJobStatus = async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId)
      setJob(status)

      if (status.status === 'completed' || status.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }

        // Stop generating state but keep job result visible
        setIsGenerating(false)

        if (status.status === 'failed') {
          setError(status.error || 'Generation failed')
        }
      }
    } catch (err) {
      console.error('Failed to poll job status:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return

    setIsGenerating(true)
    setError('')
    setJob(null)

    try {
      const response = await generateArticle(topic, {
        generateImage,
        uploadToWordPress,
        generatePins
      })

      // Start polling for job status
      const jobId = response.jobId
      pollJobStatus(jobId)
      pollIntervalRef.current = window.setInterval(() => pollJobStatus(jobId), 1500)
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)
      setIsGenerating(false)
      console.error('Generation error:', err)
    }
  }

  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'pending': return '○'
      case 'processing': return '◐'
      case 'completed': return '✓'
      case 'failed': return '✗'
      case 'skipped': return '−'
      default: return '○'
    }
  }

  const getStepColor = (status: StepStatus) => {
    switch (status) {
      case 'pending': return 'text-gray-400'
      case 'processing': return 'text-blue-600'
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'skipped': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  const getProgressPercent = () => {
    if (!job) return 0
    const steps = Object.values(job.steps)
    const completed = steps.filter(s => s === 'completed' || s === 'skipped').length
    return Math.round((completed / steps.length) * 100)
  }

  const handleViewResult = () => {
    if (job?.result?.postId) {
      // Navigate to pins page
      navigate('/pins')
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
                {isGenerating ? 'Generating...' : 'Generate Article'}
              </button>
            </form>

            {/* Progress Display */}
            {job && (
              <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">Generating: {job.topic}</h3>
                    <p className="text-sm text-gray-500">
                      {job.status === 'completed' ? 'Complete!' :
                       job.status === 'failed' ? 'Failed' : 'In progress...'}
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {getProgressPercent()}%
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      job.status === 'failed' ? 'bg-red-500' :
                      job.status === 'completed' ? 'bg-green-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${getProgressPercent()}%` }}
                  />
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  {STEPS.map((step) => {
                    const status = job.steps[step.key]
                    return (
                      <div
                        key={step.key}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          status === 'processing' ? 'bg-blue-50 border border-blue-200' :
                          status === 'completed' ? 'bg-green-50' :
                          status === 'failed' ? 'bg-red-50' :
                          'bg-white'
                        }`}
                      >
                        <span className="text-xl">{step.icon}</span>
                        <span className="flex-1">{step.label}</span>
                        <span className={`text-xl font-bold ${getStepColor(status)}`}>
                          {status === 'processing' ? (
                            <span className="inline-block animate-spin">◐</span>
                          ) : (
                            getStepIcon(status)
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Result Summary */}
                {job.status === 'completed' && job.result && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-bold text-green-800 mb-2">Generation Complete!</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      {job.result.articleTitle && (
                        <li>Article: {job.result.articleTitle}</li>
                      )}
                      {job.result.postId && (
                        <li>WordPress Post ID: {job.result.postId}</li>
                      )}
                      {job.result.pinsGenerated && (
                        <li>{job.result.pinsGenerated} Pinterest pins created</li>
                      )}
                    </ul>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <button
                        onClick={handleViewResult}
                        className="btn-primary"
                      >
                        View Pins →
                      </button>
                      {job.result.postId && (
                        <a
                          href={`https://parentvillage.blog/?p=${job.result.postId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary inline-flex items-center gap-1"
                        >
                          View on WordPress ↗
                        </a>
                      )}
                      <button
                        onClick={() => { setJob(null); setTopic(''); }}
                        className="btn-secondary"
                      >
                        Generate Another
                      </button>
                    </div>
                  </div>
                )}

                {/* Failed State */}
                {job.status === 'failed' && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-bold text-red-800 mb-2">Generation Failed</h4>
                    <p className="text-sm text-red-700 mb-4">{job.error || 'An error occurred'}</p>
                    <button
                      onClick={() => { setJob(null); setError(''); }}
                      className="btn-secondary"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Initial Loading State */}
            {isGenerating && !job && (
              <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="animate-spin text-2xl">◐</div>
                  <span className="text-blue-700 font-medium">Starting generation...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card h-fit">
          <h3 className="font-bold mb-4">How It Works</h3>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-lg">📝</span>
              <span>AI generates article content (~30s)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-lg">🎨</span>
              <span>DALL-E creates on-brand image (~15s)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-lg">📤</span>
              <span>Article uploads to WordPress (~5s)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-lg">📌</span>
              <span>5 Pinterest pins auto-generated (~2s)</span>
            </li>
          </ol>
          <p className="mt-4 text-xs text-gray-500">
            Total time: ~1 minute
          </p>
        </div>
      </div>
    </div>
  )
}
