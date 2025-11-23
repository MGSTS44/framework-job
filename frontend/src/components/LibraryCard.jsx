import { useState } from 'react'

/**
 * LibraryCard - Library 页面中的框架卡片组件
 *
 * Features:
 * - 显示框架的基本信息
 * - View Details 按钮：查看完整信息
 * - Export 按钮：导出为 JSON
 */
function LibraryCard({ framework }) {
  const [showDetails, setShowDetails] = useState(false)

  // 处理导出
  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(framework, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${framework.title || 'framework'}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      console.log('✅ Framework exported')
    } catch (error) {
      console.error('❌ Error exporting framework:', error)
      alert('Failed to export framework')
    }
  }

  // 获取分类颜色
  const getCategoryColor = category => {
    const colors = {
      Technology: 'bg-blue-100 text-blue-800',
      Healthcare: 'bg-green-100 text-green-800',
      Research: 'bg-purple-100 text-purple-800',
      Financial: 'bg-yellow-100 text-yellow-800',
      Other: 'bg-gray-100 text-gray-800',
    }
    return colors[category] || colors['Other']
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {framework.title || 'Untitled Framework'}
            </h3>
            <span className="text-sm text-gray-500">
              {framework.version || 'v1.0'}
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(framework.category)}`}
          >
            {framework.category || 'Other'}
          </span>
        </div>

        {/* Confidence Badge */}
        {framework.confidence && (
          <div className="mb-3">
            <span className="text-sm text-gray-600">
              {Math.round(framework.confidence)}% confidence
            </span>
          </div>
        )}

        {/* Key Artefacts Preview */}
        {framework.artefacts?.additional &&
          framework.artefacts.additional.length > 0 && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Key Artefacts:
              </p>
              <ul className="space-y-1">
                {framework.artefacts.additional.slice(0, 3).map((art, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-600 flex items-start"
                  >
                    <span className="mr-2">•</span>
                    <span>{typeof art === 'object' ? art.name : art}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* Tags */}
        {framework.tags && framework.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {framework.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
              >
                🏷️ {tag}
              </span>
            ))}
            {framework.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                +{framework.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-gray-500 mb-4 space-y-1">
          <div>
            Published:{' '}
            {framework.publishedAt?.toDate?.()?.toLocaleDateString() ||
              'Unknown'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(true)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Details
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
            title="Export as JSON"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {framework.title || 'Untitled Framework'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {framework.version || 'v1.0'} |{' '}
                    {framework.category || 'Other'}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Confidence */}
              {framework.confidence && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Confidence
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className="text-3xl font-bold text-green-600">
                      {Math.round(framework.confidence)}%
                    </div>
                  </div>
                </div>
              )}

              {/* POV */}
              {framework.pov && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Point of View
                  </h3>
                  <p className="text-gray-700">{framework.pov}</p>
                </div>
              )}

              {/* Artefacts */}
              {framework.artefacts?.additional &&
                framework.artefacts.additional.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Key Artefacts
                    </h3>
                    <ul className="space-y-2">
                      {framework.artefacts.additional.map((art, idx) => (
                        <li key={idx} className="text-gray-700">
                          •{' '}
                          {typeof art === 'object'
                            ? `${art.name}: ${art.description || ''}`
                            : art}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Tags */}
              {framework.tags && framework.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {framework.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Information
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>Family: {framework.family || 'N/A'}</div>
                  <div>Version: {framework.version || 'v1.0'}</div>
                  <div>
                    Published:{' '}
                    {framework.publishedAt?.toDate?.()?.toLocaleDateString() ||
                      'Unknown'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleExport}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Export Framework
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default LibraryCard
