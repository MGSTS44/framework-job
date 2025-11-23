import { useState } from 'react'
import { cleanupData, verifyCleanup } from './cleanupData'

/**
 * TEMPORARY COMPONENT - Remove after cleanup is done!
 * 
 * This component provides a UI to run the data cleanup script.
 * 
 * HOW TO USE:
 * 1. Add this component to TenantSettings.jsx or any admin page
 * 2. Click "Run Cleanup" button ONCE
 * 3. Wait for completion
 * 4. Click "Verify Cleanup" to check results
 * 5. Remove this component from your app
 */
function DataCleanupButton() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)

  const handleCleanup = async () => {
    if (!window.confirm('⚠️ This will modify all frameworks in Firestore. Continue?')) {
      return
    }

    setIsRunning(true)
    setResult(null)

    try {
      const cleanupResult = await cleanupData()
      setResult(cleanupResult)
    } catch (error) {
      console.error('Error during cleanup:', error)
      setResult({ success: false, error: error.message })
    } finally {
      setIsRunning(false)
    }
  }

  const handleVerify = async () => {
    setIsVerifying(true)
    setVerifyResult(null)

    try {
      const verifyRes = await verifyCleanup()
      setVerifyResult(verifyRes)
    } catch (error) {
      console.error('Error during verification:', error)
      setVerifyResult({ error: error.message })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-6">
      <div className="flex items-start space-x-3 mb-4">
        <svg
          className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <h3 className="text-lg font-bold text-yellow-900 mb-1">
            Data Cleanup Tool (TEMPORARY)
          </h3>
          <p className="text-sm text-yellow-800 mb-3">
            This tool will clean up old data in Firestore:
          </p>
          <ul className="text-sm text-yellow-800 space-y-1 mb-4">
            <li>• Remove <code className="bg-yellow-200 px-1 rounded">expertId</code> field from frameworks</li>
            <li>• Fix <code className="bg-yellow-200 px-1 rounded">tenantId: "legacy"</code> to null</li>
            <li>• Add <code className="bg-yellow-200 px-1 rounded">publishedToOrganization</code> field</li>
          </ul>
          <p className="text-xs text-yellow-700 font-medium">
            ⚠️ Run this ONCE, then remove this component from your app!
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={handleCleanup}
          disabled={isRunning}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isRunning
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-yellow-600 text-white hover:bg-yellow-700'
          }`}
        >
          {isRunning ? (
            <span className="flex items-center">
              <svg
                className="animate-spin h-4 w-4 mr-2"
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Running Cleanup...
            </span>
          ) : (
            'Run Cleanup'
          )}
        </button>

        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isVerifying
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isVerifying ? 'Verifying...' : 'Verify Cleanup'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <h4
            className={`font-semibold mb-2 ${
              result.success ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {result.success ? '✅ Cleanup Completed' : '❌ Cleanup Failed'}
          </h4>
          {result.success ? (
            <div className="text-sm text-green-800 space-y-1">
              <p>Total frameworks: {result.total}</p>
              <p>Updated: {result.updated}</p>
              <p>Errors: {result.errors}</p>
              <p className="font-medium mt-2">
                Check browser console for detailed logs.
              </p>
            </div>
          ) : (
            <p className="text-sm text-red-800">Error: {result.error}</p>
          )}
        </div>
      )}

      {/* Verification Results */}
      {verifyResult && (
        <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">
            🔍 Verification Results
          </h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>Total frameworks: {verifyResult.total}</p>
            <p>Still have expertId: {verifyResult.hasExpertId || 0}</p>
            <p>Still have legacy tenantId: {verifyResult.hasLegacyTenant || 0}</p>
            <p>Missing publishedToOrganization: {verifyResult.missingPublishedToOrg || 0}</p>
            {verifyResult.hasExpertId === 0 &&
              verifyResult.hasLegacyTenant === 0 &&
              verifyResult.missingPublishedToOrg === 0 && (
                <p className="font-semibold text-green-700 mt-2">
                  ✅ All data is clean!
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DataCleanupButton