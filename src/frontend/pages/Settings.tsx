import { useState } from 'react'

export default function Settings() {
  const [wpSettings, setWpSettings] = useState({
    blogUrl: 'https://parentvillage.blog',
    username: '',
    apiKey: '',
  })

  const [contentSettings, setContentSettings] = useState({
    publishingFrequency: 'weekly',
    minWordCount: 800,
    maxWordCount: 2000,
    generateFeaturedImage: true,
    autoUploadToWordPress: true,
    generatePinterestPins: true,
  })

  const [savedMessage, setSavedMessage] = useState('')

  const handleWpChange = (field: string, value: string) => {
    setWpSettings({ ...wpSettings, [field]: value })
  }

  const handleContentChange = (field: string, value: string | number | boolean) => {
    setContentSettings({ ...contentSettings, [field]: value })
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavedMessage('')

    setTimeout(() => {
      setSavedMessage('Settings saved successfully!')
      setTimeout(() => {
        setSavedMessage('')
      }, 3000)
    }, 1000)
  }

  return (
    <div>
      <h1 className="section-title">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* WordPress Configuration */}
          <div className="card">
            <h2 className="text-xl font-bold mb-6">WordPress Configuration</h2>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div>
                <label className="form-label">Blog URL</label>
                <input
                  type="url"
                  value={wpSettings.blogUrl}
                  onChange={(e) => handleWpChange('blogUrl', e.target.value)}
                  className="form-input"
                  placeholder="https://yourblog.wordpress.com"
                />
                <p className="text-xs text-gray-500 mt-1">Your WordPress.com blog URL</p>
              </div>

              <div>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  value={wpSettings.username}
                  onChange={(e) => handleWpChange('username', e.target.value)}
                  className="form-input"
                  placeholder="your_username"
                />
                <p className="text-xs text-gray-500 mt-1">Your WordPress.com username</p>
              </div>

              <div>
                <label className="form-label">Application Password</label>
                <input
                  type="password"
                  value={wpSettings.apiKey}
                  onChange={(e) => handleWpChange('apiKey', e.target.value)}
                  className="form-input"
                  placeholder="••••••••••••••••"
                />
                <p className="text-xs text-gray-500 mt-1">
                  <strong>Never share this.</strong> Generate in WordPress account settings
                </p>
              </div>
            </form>
          </div>

          {/* Content Configuration */}
          <div className="card">
            <h2 className="text-xl font-bold mb-6">Content Configuration</h2>
            <form className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Publishing Frequency</label>
                  <select
                    value={contentSettings.publishingFrequency}
                    onChange={(e) => handleContentChange('publishingFrequency', e.target.value)}
                    className="form-input"
                  >
                    <option value="daily">Daily</option>
                    <option value="three-times-weekly">3x Per Week</option>
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Min Word Count</label>
                  <input
                    type="number"
                    value={contentSettings.minWordCount}
                    onChange={(e) => handleContentChange('minWordCount', parseInt(e.target.value))}
                    className="form-input"
                    min="100"
                    max="5000"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Max Word Count</label>
                <input
                  type="number"
                  value={contentSettings.maxWordCount}
                  onChange={(e) => handleContentChange('maxWordCount', parseInt(e.target.value))}
                  className="form-input"
                  min="100"
                  max="10000"
                />
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Automation Options</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={contentSettings.generateFeaturedImage}
                      onChange={(e) => handleContentChange('generateFeaturedImage', e.target.checked)}
                      className="mr-3"
                    />
                    <span className="text-gray-700">Generate featured images with DALL-E</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={contentSettings.autoUploadToWordPress}
                      onChange={(e) => handleContentChange('autoUploadToWordPress', e.target.checked)}
                      className="mr-3"
                    />
                    <span className="text-gray-700">Auto-upload articles to WordPress</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={contentSettings.generatePinterestPins}
                      onChange={(e) => handleContentChange('generatePinterestPins', e.target.checked)}
                      className="mr-3"
                    />
                    <span className="text-gray-700">Generate Pinterest pins for each article</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                onClick={handleSaveSettings}
                className="btn-primary w-full"
              >
                💾 Save Settings
              </button>

              {savedMessage && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-green-700 font-medium">{savedMessage}</p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Help Sidebar */}
        <div className="card h-fit">
          <h3 className="font-bold mb-4">Configuration Help</h3>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">WordPress Credentials</h4>
              <p>Get your application password from WordPress.com Settings → Security</p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-1">Word Count</h4>
              <p>Set the ideal length for generated articles. Typically 800-2000 words for blog posts.</p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-1">Automation</h4>
              <p>Toggle on/off each automation feature based on your needs. All can be toggled anytime.</p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-1">Security</h4>
              <p>Never share your application password. Create and delete them anytime in WordPress settings.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
