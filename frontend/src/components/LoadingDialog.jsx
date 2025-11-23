function LoadingDialog({
  isOpen,
  message = 'Processing...',
  subMessage = 'This may take a moment',
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-8">
        {/* Loading Spinner */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Outer spinning ring */}
            <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
            <div
              className="w-20 h-20 border-4 border-blue-600 rounded-full absolute top-0 left-0 animate-spin"
              style={{
                borderTopColor: 'transparent',
                borderRightColor: 'transparent',
                animationDuration: '1s',
              }}
            ></div>

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {message}
          </h3>
          <p className="text-gray-600 text-sm">{subMessage}</p>
        </div>

        {/* Progress dots animation */}
        <div className="flex justify-center space-x-2 mt-6">
          <div
            className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '1s' }}
          ></div>
          <div
            className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
            style={{ animationDelay: '150ms', animationDuration: '1s' }}
          ></div>
          <div
            className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
            style={{ animationDelay: '300ms', animationDuration: '1s' }}
          ></div>
        </div>

        {/* Info text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800 text-center">
            Please do not close this window. Your framework is being enhanced
            with AI.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoadingDialog
