import React, { useState } from 'react'

export default function MergeModeDialog({ isOpen, onClose, onProceed }) {
  const [selectedMode, setSelectedMode] = useState('manual') // 'manual' | 'ai'

  if (!isOpen) return null

  const handleProceed = () => {
    onProceed(selectedMode)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <h3 className="text-xl font-bold text-white">Choose Merge Method</h3>
          <p className="text-purple-100 text-sm mt-1">
            Select how you want to merge your frameworks
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Manual Merge Option */}
          <label
            className={`block p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
              selectedMode === 'manual'
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="mergeMode"
                value="manual"
                checked={selectedMode === 'manual'}
                onChange={e => setSelectedMode(e.target.value)}
                className="mt-1 w-4 h-4 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                    />
                  </svg>
                  <span className="font-semibold text-gray-900">
                    Manual Merge
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Drag and drop content between frameworks yourself
                </p>
              </div>
            </div>
          </label>

          {/* AI Smart Merge Option */}
          <label
            className={`block p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
              selectedMode === 'ai'
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="mergeMode"
                value="ai"
                checked={selectedMode === 'ai'}
                onChange={e => setSelectedMode(e.target.value)}
                className="mt-1 w-4 h-4 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <svg
                    className="w-5 h-5 text-purple-600"
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
                  <span className="font-semibold text-gray-900">
                    AI Smart Merge
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Let AI intelligently combine selected frameworks
                </p>
              </div>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-md"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  )
}
