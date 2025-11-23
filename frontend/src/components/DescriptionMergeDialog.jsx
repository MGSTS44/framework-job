import React from 'react'

export default function DescriptionMergeDialog({
  isOpen,
  onClose,
  onConfirm,
  currentDescription,
  newDescription,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Description Already Exists
          </h3>
          <p className="text-amber-100 text-sm mt-1">
            This framework already has a description. Choose how to proceed:
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Current Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Current Description:
            </label>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-700">{currentDescription}</p>
            </div>
          </div>

          {/* New Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Description (being dropped):
            </label>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">{newDescription}</p>
            </div>
          </div>

          {/* Preview: Replace */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Preview: If you REPLACE
            </label>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-gray-700 line-through opacity-50">
                {currentDescription}
              </p>
              <p className="text-sm text-blue-700 font-medium mt-2">
                {newDescription}
              </p>
            </div>
          </div>

          {/* Preview: Append */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Preview: If you APPEND
            </label>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-700">{currentDescription}</p>
              <p className="text-sm text-blue-700 font-medium mt-2">
                {newDescription}
              </p>
            </div>
          </div>
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
            onClick={() => onConfirm('replace')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Replace
          </button>
          <button
            onClick={() => onConfirm('append')}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Append
          </button>
        </div>
      </div>
    </div>
  )
}
