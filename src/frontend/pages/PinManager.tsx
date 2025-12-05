import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPins, approvePin, exportPinsAsCSV, getExportInfo, getErrorMessage, generatePinsFromUrl, exportSelectedPinsAsCSV, type ExportInfo, PINTEREST_MAX_ROWS } from '../services/api'

interface PinVariation {
  angle: string
  title: string
  description: string
  imageUrl?: string
  link: string
  altText: string
}

interface Pin {
  id: string
  articleTitle: string
  variations: PinVariation[]
  status: 'draft' | 'approved' | 'published'
  createdAt: string
}

export default function PinManager() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState<string | null>(null)
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportInfo, setExportInfo] = useState<ExportInfo | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null)

  // Generate pins modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [articleUrl, setArticleUrl] = useState('')
  const [pinCount, setPinCount] = useState(3)
  const [generating, setGenerating] = useState(false)
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null)

  // Multi-select state
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  useEffect(() => {
    loadPins()
  }, [])

  // Auto-select pin from URL parameter
  useEffect(() => {
    const pinId = searchParams.get('id')
    if (pinId && pins.length > 0 && !selectedPin) {
      const pin = pins.find(p => p.id === pinId)
      if (pin) {
        setSelectedPin(pin)
        // Clear the URL parameter
        setSearchParams({})
      }
    }
  }, [pins, searchParams, selectedPin, setSearchParams])

  const loadPins = async () => {
    try {
      setLoading(true)
      const data = await getPins()
      setPins(data.pins || [])
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (pinId: string) => {
    try {
      setApproving(pinId)
      await approvePin(pinId)
      await loadPins()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setApproving(null)
    }
  }

  const handleShowExportModal = async () => {
    try {
      setExporting('loading')
      const info = await getExportInfo('approved')
      setExportInfo(info)
      setShowExportModal(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setExporting(null)
    }
  }

  const handleExportPage = async (page: number) => {
    try {
      setExporting(`page-${page}`)
      const result = await exportPinsAsCSV('approved', page)

      // Create download link
      const url = window.URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pins-export-page${page}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setExporting(null)
    }
  }

  const handleExportAllPages = async () => {
    if (!exportInfo) return

    try {
      setExportProgress({ current: 0, total: exportInfo.totalPages })

      for (let page = 1; page <= exportInfo.totalPages; page++) {
        setExportProgress({ current: page, total: exportInfo.totalPages })
        const result = await exportPinsAsCSV('approved', page)

        // Create download link for each page
        const url = window.URL.createObjectURL(result.blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `pins-export-page${page}-of-${exportInfo.totalPages}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        // Small delay between downloads
        if (page < exportInfo.totalPages) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setExportProgress(null)
    }
  }

  // Export pins for a specific article
  const handleExportCSV = async (pinId: string) => {
    try {
      setExporting(pinId)
      // Export only this specific pin/article's variations
      const result = await exportPinsAsCSV(undefined, 1, pinId)

      // Find the pin to get its article title for the filename
      const pin = pins.find(p => p.id === pinId)
      const articleSlug = pin?.articleTitle
        ? pin.articleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
        : pinId

      // Create download link
      const url = window.URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pins-${articleSlug}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setExporting(null)
    }
  }

  // Generate pins from URL
  const handleGeneratePins = async () => {
    if (!articleUrl.trim()) {
      setError('Please enter an article URL')
      return
    }

    try {
      setGenerating(true)
      setError('')
      setGenerateSuccess(null)

      const result = await generatePinsFromUrl(articleUrl, pinCount)

      setGenerateSuccess(`Successfully generated ${result.pin.variations.length} pins for "${result.pin.articleTitle}"`)
      setArticleUrl('')
      await loadPins()

      // Close modal after short delay
      setTimeout(() => {
        setShowGenerateModal(false)
        setGenerateSuccess(null)
      }, 2000)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  // Multi-select handlers
  const togglePinSelection = (pinId: string) => {
    const newSelected = new Set(selectedPinIds)
    if (newSelected.has(pinId)) {
      newSelected.delete(pinId)
    } else {
      newSelected.add(pinId)
    }
    setSelectedPinIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedPinIds.size === pins.length) {
      setSelectedPinIds(new Set())
    } else {
      setSelectedPinIds(new Set(pins.map(p => p.id)))
    }
  }

  const handleExportSelected = async () => {
    if (selectedPinIds.size === 0) return

    try {
      setExporting('selected')
      const result = await exportSelectedPinsAsCSV(Array.from(selectedPinIds))

      // Create download link
      const url = window.URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pins-selected-${selectedPinIds.size}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // Clear selection after export
      setSelectedPinIds(new Set())
      setSelectMode(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setExporting(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-700'
      case 'approved': return 'bg-green-100 text-green-700'
      case 'published': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">...</div>
          <p className="text-gray-600">Loading pins...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="section-title">Pinterest Pin Manager</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError('')} className="text-red-500 text-sm mt-1 underline">Dismiss</button>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Pin Collections</h2>
          <div className="flex gap-3">
            {selectMode ? (
              <>
                <button
                  onClick={() => {
                    setSelectMode(false)
                    setSelectedPinIds(new Set())
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportSelected}
                  disabled={selectedPinIds.size === 0 || exporting === 'selected'}
                  className="btn-primary disabled:opacity-50"
                >
                  {exporting === 'selected' ? 'Exporting...' : `Export Selected (${selectedPinIds.size})`}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectMode(true)}
                  disabled={pins.length === 0}
                  className="btn-secondary disabled:opacity-50"
                >
                  Select Pins
                </button>
                <button
                  onClick={handleShowExportModal}
                  disabled={exporting === 'loading' || pins.filter(p => p.status === 'approved').length === 0}
                  className="btn-secondary disabled:opacity-50"
                >
                  {exporting === 'loading' ? '...' : 'Export All Approved'}
                </button>
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="btn-primary"
                >
                  + Generate New Pins
                </button>
              </>
            )}
          </div>
        </div>

        {pins.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No pins yet. Generate an article to create pins!</p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="btn-primary"
            >
              + Generate New Pins
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {selectMode && (
                    <th className="text-left py-3 px-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedPinIds.size === pins.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    </th>
                  )}
                  <th className="text-left py-3 px-4 font-semibold">Article</th>
                  <th className="text-left py-3 px-4 font-semibold">Variations</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Created</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pins.map((pin) => {
                  const createdDate = new Date(pin.createdAt).toLocaleDateString()
                  const isSelected = selectedPinIds.has(pin.id)

                  return (
                    <tr
                      key={pin.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-brand-50' : ''}`}
                    >
                      {selectMode && (
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePinSelection(pin.id)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 font-medium">{pin.articleTitle}</td>
                      <td className="py-3 px-4">{pin.variations.length}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pin.status)}`}>
                          {pin.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{createdDate}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedPin(pin)}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                          View Pins
                        </button>
                        {pin.status === 'draft' && (
                          <>
                            <span className="mx-2 text-gray-300">|</span>
                            <button
                              onClick={() => handleApprove(pin.id)}
                              disabled={approving === pin.id}
                              className="text-green-600 hover:text-green-700 font-medium text-sm disabled:opacity-50"
                            >
                              {approving === pin.id ? 'Approving...' : 'Approve'}
                            </button>
                          </>
                        )}
                        {pin.status === 'approved' && (
                          <>
                            <span className="mx-2 text-gray-300">|</span>
                            <button
                              onClick={() => handleExportCSV(pin.id)}
                              disabled={exporting === pin.id}
                              className="text-purple-600 hover:text-purple-700 font-medium text-sm disabled:opacity-50"
                            >
                              {exporting === pin.id ? 'Exporting...' : 'Export CSV'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pin Details Modal */}
      {selectedPin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">{selectedPin.articleTitle}</h2>
              <button
                onClick={() => setSelectedPin(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                x
              </button>
            </div>

            <div className="p-6 space-y-6">
              {selectedPin.variations.map((variation, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex gap-4">
                    {/* Image preview */}
                    {variation.imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={`/generated_images/${variation.imageUrl.split('/').pop()}`}
                          alt={variation.altText}
                          className="w-32 h-48 object-cover rounded-lg border"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">{variation.title}</h3>
                          <p className="text-sm text-brand-600 font-medium">{variation.angle}</p>
                        </div>
                      </div>

                      <p className="text-gray-700 mb-3">{variation.description}</p>

                      <div className="bg-gray-50 p-3 rounded mb-3">
                        <p className="text-xs text-gray-600 mb-1">
                          <strong>Alt Text:</strong> {variation.altText}
                        </p>
                        <p className="text-xs text-gray-600">
                          <strong>Link:</strong> {variation.link}
                        </p>
                      </div>

                      <a
                        href={variation.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-brand-700 text-white rounded hover:bg-brand-800 text-sm font-medium"
                      >
                        View Article
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generate Pins Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="border-b p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">Generate New Pins</h2>
              <button
                onClick={() => {
                  setShowGenerateModal(false)
                  setArticleUrl('')
                  setGenerateSuccess(null)
                  setError('')
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                x
              </button>
            </div>

            <div className="p-6">
              {generateSuccess ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-700 font-medium">{generateSuccess}</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WordPress Article URL
                    </label>
                    <input
                      type="url"
                      value={articleUrl}
                      onChange={(e) => setArticleUrl(e.target.value)}
                      placeholder="https://parentvillage.blog/your-article/"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      disabled={generating}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Paste the full URL of your WordPress article
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Pins
                    </label>
                    <select
                      value={pinCount}
                      onChange={(e) => setPinCount(parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      disabled={generating}
                    >
                      <option value={2}>2 pins (faster)</option>
                      <option value={3}>3 pins (recommended)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Each pin will have a unique image and description
                    </p>
                  </div>

                  <button
                    onClick={handleGeneratePins}
                    disabled={generating || !articleUrl.trim()}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {generating ? (
                      <span className="flex items-center justify-center">
                        <span className="animate-spin mr-2">...</span>
                        Generating pins... (this may take a minute)
                      </span>
                    ) : (
                      'Generate Pins'
                    )}
                  </button>

                  {generating && (
                    <p className="text-xs text-gray-500 mt-3 text-center">
                      Fetching article content and generating {pinCount} unique images...
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && exportInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="border-b p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">Export Pins to CSV</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                x
              </button>
            </div>

            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-amber-800 font-medium mb-2">Pinterest Limit: 200 rows per CSV</p>
                <p className="text-amber-700 text-sm">
                  You have <strong>{exportInfo.totalRows}</strong> total rows.
                  {exportInfo.totalPages > 1 && (
                    <> Split into <strong>{exportInfo.totalPages}</strong> separate files.</>
                  )}
                </p>
              </div>

              {exportInfo.totalPages === 1 ? (
                <button
                  onClick={() => handleExportPage(1)}
                  disabled={exporting === 'page-1'}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {exporting === 'page-1' ? 'Downloading...' : `Download CSV (${exportInfo.totalRows} rows)`}
                </button>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={handleExportAllPages}
                    disabled={exportProgress !== null}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {exportProgress
                      ? `Downloading ${exportProgress.current}/${exportProgress.total}...`
                      : `Download All ${exportInfo.totalPages} Files`}
                  </button>

                  <div className="text-center text-gray-500 text-sm">or download individually:</div>

                  <div className="grid grid-cols-2 gap-2">
                    {exportInfo.pages.map((page) => (
                      <button
                        key={page.page}
                        onClick={() => handleExportPage(page.page)}
                        disabled={exporting === `page-${page.page}`}
                        className="btn-secondary text-sm disabled:opacity-50"
                      >
                        {exporting === `page-${page.page}`
                          ? 'Downloading...'
                          : `Page ${page.page} (rows ${page.startRow}-${page.endRow})`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-gray-500 text-xs mt-4 text-center">
                Upload each CSV file separately to Pinterest's bulk upload tool.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
