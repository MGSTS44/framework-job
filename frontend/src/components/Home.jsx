import { useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  const handleNewFramework = () => {
    navigate('/create')
  }

  const handleLearnMore = e => {
    e.preventDefault()
    alert('Documentation coming soon!')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6 py-12">
        <div className="mb-6 flex justify-center">
          <svg
            className="w-24 h-24 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 8h3"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">
          No frameworks yet
        </h2>
        <p className="text-gray-600 mb-8">
          Start by creating a new framework from your documents or pasted text.
        </p>
        <div className="space-y-4">
          <button
            onClick={handleNewFramework}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
          >
            New Framework
          </button>
          <div>
            <a
              href="#"
              onClick={handleLearnMore}
              className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
            >
              Learn how it works
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
