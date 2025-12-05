import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateArticle, getJobStatus, getErrorMessage } from '../services/api'
import type { JobStatus } from '../services/api'

type StepStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

interface Step {
  key: keyof JobStatus['steps']
  label: string
  icon: string
  description: string
}

const STEPS: Step[] = [
  { key: 'article', label: 'Write', icon: '📝', description: 'Generate article' },
  { key: 'image', label: 'Design', icon: '🎨', description: 'Create image' },
  { key: 'wordpress', label: 'Publish', icon: '📤', description: 'Upload to WordPress' },
  { key: 'pins', label: 'Share', icon: '📌', description: 'Create pins' },
]

// Workflow steps for the visual indicator
const WORKFLOW_STEPS = [
  { id: 'topic', label: 'Topic', icon: '💡' },
  { id: 'article', label: 'Article', icon: '📝' },
  { id: 'image', label: 'Image', icon: '🎨' },
  { id: 'wordpress', label: 'Publish', icon: '📤' },
  { id: 'pins', label: 'Pins', icon: '📌' },
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
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [articleContent, setArticleContent] = useState('')
  const [isEditingArticle, setIsEditingArticle] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const pollIntervalRef = useRef<number | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }
  }

  // Show desktop notification
  const showNotification = (title: string, body: string, success: boolean) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: success ? '✅' : '❌',
        badge: '🏡',
        tag: 'job-complete',
      })
    }
  }

  const pollJobStatus = async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId)
      setJob(status)

      if (status.status === 'completed' || status.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        setIsGenerating(false)

        // Show desktop notification
        if (status.status === 'completed') {
          showNotification(
            '✨ Article Created!',
            `"${status.result?.articleTitle || status.topic}" is ready for review.`,
            true
          )
        } else {
          showNotification(
            '❌ Generation Failed',
            status.error || 'An error occurred during generation.',
            false
          )
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
    setFeedback(null)
    setFeedbackComment('')
    setShowFeedbackForm(false)
    setArticleContent('')
    setIsEditingArticle(false)

    try {
      const response = await generateArticle(topic, {
        generateImage,
        uploadToWordPress,
        generatePins
      })

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

  const getProgressPercent = () => {
    if (!job) return 0
    const steps = Object.values(job.steps)
    const completed = steps.filter(s => s === 'completed' || s === 'skipped').length
    return Math.round((completed / steps.length) * 100)
  }

  const getCurrentWorkflowStep = () => {
    if (!job) return topic ? 1 : 0
    if (job.status === 'completed') return 5
    if (job.steps.pins === 'processing') return 4
    if (job.steps.wordpress === 'processing') return 3
    if (job.steps.image === 'processing') return 2
    if (job.steps.article === 'processing') return 1
    return 1
  }

  const handleViewResult = () => {
    if (job?.result?.postId) {
      navigate('/pins')
    }
  }

  // Feedback handlers
  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(type)
    if (type === 'down') {
      setShowFeedbackForm(true)
    } else {
      // Save positive feedback
      console.log('Positive feedback submitted for job:', job?.id)
      // TODO: Send to backend
    }
  }

  const submitFeedback = () => {
    console.log('Feedback submitted:', { jobId: job?.id, feedback, comment: feedbackComment })
    // TODO: Send to backend API
    setShowFeedbackForm(false)
  }

  // Topic suggestions
  const topicSuggestions = [
    'Morning routines for toddlers',
    'Healthy snacks kids will love',
    'Teaching kindness to children',
    'Managing screen time',
    'Bedtime tips for better sleep',
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="section-title mb-2">Create New Article ✨</h1>
        <p className="text-brand-500">AI-powered content creation for your parenting blog</p>
      </div>

      {/* Step-by-Step Workflow Indicator */}
      <div className="mb-8">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, index) => {
              const currentStep = getCurrentWorkflowStep()
              const isCompleted = index < currentStep
              const isCurrent = index === currentStep

              return (
                <div key={step.id} className="flex items-center flex-1">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all duration-500 ${
                        isCompleted
                          ? 'bg-sage-500 text-white shadow-warm'
                          : isCurrent
                          ? 'bg-gradient-to-br from-terracotta-400 to-mustard-400 text-white shadow-warm-lg scale-110 animate-pulse-slow'
                          : 'bg-cream-200 text-brand-400'
                      }`}
                    >
                      {isCompleted ? '✓' : step.icon}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${
                        isCompleted
                          ? 'text-sage-600'
                          : isCurrent
                          ? 'text-terracotta-600'
                          : 'text-brand-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <div className="flex-1 mx-2">
                      <div
                        className={`h-1 rounded-full transition-all duration-500 ${
                          isCompleted ? 'bg-sage-400' : 'bg-cream-200'
                        }`}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Notification Permission Banner */}
      {notificationPermission === 'default' && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <p className="font-medium text-blue-800">Enable Notifications</p>
                <p className="text-sm text-blue-600">Get notified when your content is ready</p>
              </div>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="btn-primary text-sm"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="card">
            {/* Error Alert */}
            {error && (
              <div className="alert-error mb-6 flex items-start gap-3">
                <span className="text-xl">😕</span>
                <div>
                  <p className="font-semibold">Something went wrong</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Topic Input */}
              <div>
                <label className="form-label flex items-center gap-2">
                  <span>💡</span>
                  What would you like to write about?
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Teaching kids to share"
                  className="form-input text-lg"
                  disabled={isGenerating}
                  autoFocus
                />

                {/* Topic Suggestions */}
                {!isGenerating && !job && (
                  <div className="mt-3">
                    <p className="text-xs text-brand-400 mb-2">Need inspiration? Try one of these:</p>
                    <div className="flex flex-wrap gap-2">
                      {topicSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setTopic(suggestion)}
                          className="px-3 py-1.5 text-sm bg-cream-100 text-brand-600 rounded-lg border border-cream-200 hover:bg-cream-200 hover:border-cream-300 transition-all duration-200"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div>
                <label className="form-label flex items-center gap-2">
                  <span>⚙️</span>
                  Generation Options
                </label>
                <div className="space-y-2">
                  <label className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={generateImage}
                      onChange={(e) => setGenerateImage(e.target.checked)}
                      disabled={isGenerating}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-brand-700">Generate featured image</span>
                      <p className="text-xs text-brand-400">AI creates an on-brand illustration</p>
                    </div>
                    <span className="text-xl">🎨</span>
                  </label>
                  <label className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={uploadToWordPress}
                      onChange={(e) => setUploadToWordPress(e.target.checked)}
                      disabled={isGenerating}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-brand-700">Upload to WordPress</span>
                      <p className="text-xs text-brand-400">Auto-publish as a draft post</p>
                    </div>
                    <span className="text-xl">📤</span>
                  </label>
                  <label className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={generatePins}
                      onChange={(e) => setGeneratePins(e.target.checked)}
                      disabled={isGenerating}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-brand-700">Create Pinterest pins</span>
                      <p className="text-xs text-brand-400">5 pin variations for maximum reach</p>
                    </div>
                    <span className="text-xl">📌</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating || !topic.trim()}
                className={`btn-primary w-full py-4 text-lg flex items-center justify-center gap-3 ${
                  isGenerating || !topic.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isGenerating ? (
                  <>
                    <span className="inline-block animate-spin">◐</span>
                    Creating Magic...
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    Generate Article
                  </>
                )}
              </button>
            </form>

            {/* Progress Display */}
            {job && (
              <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-cream-50 to-cream-100 border border-cream-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-xl text-brand-800">{job.topic}</h3>
                    <p className="text-sm text-brand-500 mt-1">
                      {job.status === 'completed' ? '🎉 Complete!' :
                       job.status === 'failed' ? '❌ Failed' : '⏳ Creating...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-terracotta-500">
                      {getProgressPercent()}%
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-bar mb-6">
                  <div
                    className={`progress-fill ${
                      job.status === 'failed' ? '!bg-coral-500' :
                      job.status === 'completed' ? '!bg-sage-500' : ''
                    }`}
                    style={{ width: `${getProgressPercent()}%` }}
                  />
                </div>

                {/* Steps */}
                <div className="grid grid-cols-2 gap-3">
                  {STEPS.map((step) => {
                    const status = job.steps[step.key]
                    return (
                      <div
                        key={step.key}
                        className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-300 ${
                          status === 'processing' ? 'bg-white border-2 border-terracotta-300 shadow-warm' :
                          status === 'completed' ? 'bg-sage-50 border border-sage-200' :
                          status === 'failed' ? 'bg-coral-50 border border-coral-200' :
                          status === 'skipped' ? 'bg-cream-100 border border-cream-200 opacity-50' :
                          'bg-white border border-cream-200'
                        }`}
                      >
                        <span className={`text-2xl ${status === 'processing' ? 'animate-bounce-slow' : ''}`}>
                          {step.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${
                            status === 'processing' ? 'text-terracotta-600' :
                            status === 'completed' ? 'text-sage-700' :
                            status === 'failed' ? 'text-coral-600' :
                            'text-brand-600'
                          }`}>
                            {step.label}
                          </p>
                          <p className="text-xs text-brand-400 truncate">{step.description}</p>
                        </div>
                        <span className={`text-xl font-bold ${
                          status === 'pending' ? 'text-brand-300' :
                          status === 'processing' ? 'text-terracotta-500' :
                          status === 'completed' ? 'text-sage-600' :
                          status === 'failed' ? 'text-coral-500' :
                          'text-brand-300'
                        }`}>
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

                {/* Success State */}
                {job.status === 'completed' && job.result && (
                  <div className="mt-6 space-y-4">
                    {/* Result Summary */}
                    <div className="p-5 rounded-xl bg-sage-50 border border-sage-200">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">🎉</span>
                        <div className="flex-1">
                          <h4 className="font-bold text-sage-800 text-lg">Article Created!</h4>
                          <ul className="text-sm text-sage-700 mt-2 space-y-1">
                            {job.result.articleTitle && (
                              <li>📝 {job.result.articleTitle}</li>
                            )}
                            {job.result.postId && (
                              <li>🆔 WordPress Post #{job.result.postId}</li>
                            )}
                            {job.result.pinsGenerated && (
                              <li>📌 {job.result.pinsGenerated} Pinterest pins ready</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Feedback Section */}
                    <div className="p-5 rounded-xl bg-white border border-cream-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-brand-700">How was this article?</p>
                          <p className="text-xs text-brand-400">Your feedback helps improve future generations</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFeedback('up')}
                            className={`p-3 rounded-xl transition-all duration-200 ${
                              feedback === 'up'
                                ? 'bg-sage-100 border-2 border-sage-400 scale-110'
                                : 'bg-cream-100 border border-cream-200 hover:bg-cream-200'
                            }`}
                          >
                            <span className="text-2xl">👍</span>
                          </button>
                          <button
                            onClick={() => handleFeedback('down')}
                            className={`p-3 rounded-xl transition-all duration-200 ${
                              feedback === 'down'
                                ? 'bg-coral-100 border-2 border-coral-400 scale-110'
                                : 'bg-cream-100 border border-cream-200 hover:bg-cream-200'
                            }`}
                          >
                            <span className="text-2xl">👎</span>
                          </button>
                        </div>
                      </div>

                      {/* Feedback Form */}
                      {showFeedbackForm && (
                        <div className="mt-4 pt-4 border-t border-cream-200">
                          <label className="text-sm font-medium text-brand-600 block mb-2">
                            What could be improved?
                          </label>
                          <textarea
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            placeholder="e.g., Article was too generic, Image didn't match topic..."
                            className="form-input text-sm h-24 resize-none"
                          />
                          <button
                            onClick={submitFeedback}
                            className="btn-secondary mt-3 text-sm"
                          >
                            Submit Feedback
                          </button>
                        </div>
                      )}

                      {feedback === 'up' && (
                        <p className="mt-3 text-sm text-sage-600 flex items-center gap-2">
                          <span>✨</span>
                          Thanks for the feedback! We're glad you liked it.
                        </p>
                      )}
                    </div>

                    {/* Rich Text Editor Preview */}
                    {job.result.postId && (
                      <div className="p-5 rounded-xl bg-white border border-cream-200">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-medium text-brand-700 flex items-center gap-2">
                            <span>📄</span>
                            Article Preview
                          </p>
                          <button
                            onClick={() => setIsEditingArticle(!isEditingArticle)}
                            className="text-sm text-terracotta-500 hover:text-terracotta-600 font-medium"
                          >
                            {isEditingArticle ? 'Done Editing' : 'Quick Edit'}
                          </button>
                        </div>

                        {isEditingArticle ? (
                          <div
                            ref={editorRef}
                            contentEditable
                            className="min-h-[200px] p-4 rounded-lg border-2 border-terracotta-200 bg-cream-50 focus:outline-none focus:border-terracotta-400 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: articleContent || `<h2>${job.result.articleTitle}</h2><p>Loading article content...</p>` }}
                            onBlur={(e) => setArticleContent(e.currentTarget.innerHTML)}
                          />
                        ) : (
                          <div className="p-4 rounded-lg bg-cream-50 border border-cream-200">
                            <h3 className="font-bold text-lg text-brand-800 mb-2">
                              {job.result.articleTitle}
                            </h3>
                            <p className="text-sm text-brand-500">
                              Click "Quick Edit" to preview and make changes to the article content.
                            </p>
                          </div>
                        )}

                        <p className="text-xs text-brand-400 mt-3">
                          💡 For full editing, visit WordPress directly
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleViewResult}
                        className="btn-success"
                      >
                        View Pins →
                      </button>
                      {job.result.postId && (
                        <a
                          href={`https://parentvillage.blog/wp-admin/post.php?post=${job.result.postId}&action=edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary inline-flex items-center gap-1"
                        >
                          Edit in WordPress ↗
                        </a>
                      )}
                      <button
                        onClick={() => { setJob(null); setTopic(''); setFeedback(null); }}
                        className="btn-secondary"
                      >
                        Create Another
                      </button>
                    </div>
                  </div>
                )}

                {/* Failed State */}
                {job.status === 'failed' && (
                  <div className="mt-6 p-5 rounded-xl bg-coral-50 border border-coral-200">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">😔</span>
                      <div>
                        <h4 className="font-bold text-coral-700">Generation Failed</h4>
                        <p className="text-sm text-coral-600 mt-1">{job.error || 'An error occurred'}</p>
                        <button
                          onClick={() => { setJob(null); setError(''); }}
                          className="btn-primary mt-4"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Initial Loading State */}
            {isGenerating && !job && (
              <div className="mt-8 p-8 rounded-2xl bg-gradient-to-br from-terracotta-50 to-mustard-50 border border-terracotta-200 text-center">
                <span className="text-5xl block mb-4 animate-bounce-slow">✨</span>
                <p className="text-lg font-semibold text-brand-700">Starting the magic...</p>
                <p className="text-sm text-brand-500 mt-1">This usually takes about a minute</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* How It Works */}
          <div className="card">
            <h3 className="font-bold text-brand-800 mb-4 flex items-center gap-2">
              <span>🚀</span>
              How It Works
            </h3>
            <ol className="space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.key} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-terracotta-100 to-mustard-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-brand-700 flex items-center gap-2">
                      <span>{step.icon}</span>
                      {step.label}
                    </p>
                    <p className="text-xs text-brand-400">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-cream-200">
              <p className="text-xs text-brand-400 flex items-center gap-2">
                <span>⏱️</span>
                Total time: ~1 minute
              </p>
            </div>
          </div>

          {/* Tips Card */}
          <div className="card bg-gradient-to-br from-sage-50 to-sage-100 border-sage-200">
            <h3 className="font-bold text-sage-800 mb-3 flex items-center gap-2">
              <span>💡</span>
              Pro Tips
            </h3>
            <ul className="space-y-2 text-sm text-sage-700">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Be specific with your topic for better results</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Include age groups when relevant</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Action-oriented titles perform best</span>
              </li>
            </ul>
          </div>

          {/* Notification Status */}
          <div className={`card ${
            notificationPermission === 'granted'
              ? 'bg-gradient-to-br from-sage-50 to-sage-100 border-sage-200'
              : 'bg-gradient-to-br from-cream-50 to-cream-100 border-cream-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {notificationPermission === 'granted' ? '🔔' : '🔕'}
              </span>
              <div>
                <p className="font-medium text-brand-700">
                  {notificationPermission === 'granted'
                    ? 'Notifications Enabled'
                    : 'Notifications Off'}
                </p>
                <p className="text-xs text-brand-400">
                  {notificationPermission === 'granted'
                    ? "You'll be notified when jobs complete"
                    : 'Enable to get notified when content is ready'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
