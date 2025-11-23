import React, { useState } from 'react'
import API_ENDPOINTS from '../lib/api'

export default function AIMergeMode({ frameworks, onExit, onSave }) {
  const [selectedFrameworks, setSelectedFrameworks] = useState([])
  const [isMerging, setIsMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState(null)
  const [error, setError] = useState(null)

  // 切换选择状态
  const toggleFramework = frameworkId => {
    setSelectedFrameworks(prev =>
      prev.includes(frameworkId)
        ? prev.filter(id => id !== frameworkId)
        : [...prev, frameworkId]
    )
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedFrameworks.length === frameworks.length) {
      setSelectedFrameworks([])
    } else {
      setSelectedFrameworks(frameworks.map(fw => fw.id))
    }
  }

  // 调用 AI 合并
  const handleAIMerge = async () => {
    if (selectedFrameworks.length < 2) {
      setError('Please select at least 2 frameworks to merge')
      return
    }

    setIsMerging(true)
    setError(null)

    try {
      // 获取选中的 frameworks 数据
      const selectedData = frameworks.filter(fw =>
        selectedFrameworks.includes(fw.id)
      )

      // ✅ 调用后端 API
      const response = await fetch(
        API_ENDPOINTS.AI_MERGE,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // ✅ 添加认证 token（如果需要）
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            frameworks: selectedData,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'AI merge failed')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'AI merge failed')
      }

      // ✅ 设置合并结果
      setMergeResult(result.merged_framework)
    } catch (err) {
      console.error('AI Merge Error:', err)
      setError(err.message || 'Failed to merge frameworks')
    } finally {
      setIsMerging(false)
    }
  }

  // 保存合并结果
  const handleSaveResult = () => {
    if (!mergeResult) return

    // 保留原有的 frameworks + 新增合并后的 framework
    const updatedFrameworks = [
      ...frameworks,
      {
        id: `ai-merged-${Date.now()}`,
        name: mergeResult.name || 'AI Merged Framework',
        type: 'framework',
        source: 'ai-merged',
        description: mergeResult.description || '',
        subSteps: mergeResult.subSteps || [],
        isNew: true,
      },
    ]

    onSave(updatedFrameworks)
    onExit()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              AI Smart Merge
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Select frameworks to intelligently combine using AI
            </p>
          </div>

          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Exit AI Merge
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        {!mergeResult ? (
          // 选择界面
          <div className="max-w-4xl mx-auto">
            {/* Selection Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Select Frameworks to Merge
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedFrameworks.length} of {frameworks.length} selected
                  </p>
                </div>

                <button
                  onClick={toggleSelectAll}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {selectedFrameworks.length === frameworks.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            {/* Framework List */}
            <div className="space-y-4">
              {frameworks.map((framework, index) => (
                <label
                  key={framework.id}
                  className={`block bg-white border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedFrameworks.includes(framework.id)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedFrameworks.includes(framework.id)}
                      onChange={() => toggleFramework(framework.id)}
                      className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          {framework.name || `Framework ${index + 1}`}
                        </h4>
                        <span className="text-sm text-gray-500">
                          Framework {index + 1}
                        </span>
                      </div>

                      {framework.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {framework.description}
                        </p>
                      )}

                      {framework.subSteps && framework.subSteps.length > 0 && (
                        <div className="text-sm text-gray-500">
                          {framework.subSteps.length} sub-steps
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          // 合并结果展示
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    AI Merge Complete!
                  </h3>
                  <p className="text-sm text-gray-600">
                    Review the merged framework below
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {mergeResult.name || 'Merged Framework'}
                </h4>

                {mergeResult.description && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Description:
                    </p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
                      {mergeResult.description}
                    </p>
                  </div>
                )}

                {mergeResult.subSteps && mergeResult.subSteps.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Sub-steps:
                    </p>
                    <ul className="space-y-2">
                      {mergeResult.subSteps.map((step, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-gray-600 flex items-start gap-2"
                        >
                          <span className="text-indigo-600 mt-1">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-4">
        {!mergeResult ? (
          <>
            <button
              onClick={onExit}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAIMerge}
              disabled={selectedFrameworks.length < 2 || isMerging}
              className={`px-6 py-2 rounded-lg transition-all duration-200 shadow-md flex items-center gap-2 ${
                selectedFrameworks.length < 2 || isMerging
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
              }`}
            >
              {isMerging ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Merging with AI...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  Merge with AI
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setMergeResult(null)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Selection
            </button>
            <button
              onClick={handleSaveResult}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-md"
            >
              Save Merged Framework
            </button>
          </>
        )}
      </div>
    </div>
  )
}