import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPins, approvePin, exportPinsAsCSV, getErrorMessage } from '../services/api'

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

  const handleExportCSV = async (pinId: string) => {
    try {
      setExporting(pinId)
      const csvBlob = await exportPinsAsCSV()

      // Create download link
      const url = window.URL.createObjectURL(csvBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pins-export-${new Date().toISOString().split('T')[0]}.csv`
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
          <div className="text-4xl mb-4">⏳</div>
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
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Pin Collections</h2>
          <button className="btn-primary disabled:opacity-50" disabled>
            ➕ Generate New Pins
          </button>
        </div>

        {pins.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No pins yet. Generate an article to create pins!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
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

                  return (
                    <tr key={pin.id} className="border-b border-gray-100 hover:bg-gray-50">
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
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">{selectedPin.articleTitle}</h2>
              <button
                onClick={() => setSelectedPin(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {selectedPin.variations.map((variation, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{variation.title}</h3>
                      <p className="text-sm text-gray-600 text-brand-600 font-medium">{variation.angle}</p>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-3">{variation.description}</p>

                  <div className="bg-gray-50 p-3 rounded mb-3">
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Alt Text:</strong> {variation.altText}
                    </p>
                  </div>

                  <a
                    href={variation.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-brand-700 text-white rounded hover:bg-brand-800 text-sm font-medium"
                  >
                    View on Pinterest →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
