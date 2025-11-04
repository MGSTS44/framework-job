import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Navbar - Global navigation bar component
 *
 * Features:
 * - Displays logo and application name
 * - Navigation menu with Library link
 * - "Create" button navigates to the creation page
 * - Search bar
 * - User authentication and avatar menu
 */
function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isAuthenticated } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleCreateClick = () => {
    navigate('/create')
  }

  const handleComingSoon = feature => {
    alert(`${feature} - Coming soon!`)
  }

  const handleLogout = () => {
    logout()
    setShowUserMenu(false)
    navigate('/login')
  }

  const isActive = path => {
    return location.pathname === path || location.pathname.startsWith(path)
  }

  // Don't show navbar on login/signup pages
  if (location.pathname === '/login' || location.pathname === '/signup') {
    return null
  }

  // Show simple navbar if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    // Navbar container - fixed at top, white background, shadowed
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left section: Logo + App name + Main navigation */}
        <div className="flex items-center space-x-6">
          {/* Menu icon (3x3 grid) */}
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => handleComingSoon('Menu')}
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <rect x="3" y="3" width="4" height="4" />
              <rect x="8" y="3" width="4" height="4" />
              <rect x="13" y="3" width="4" height="4" />
              <rect x="3" y="8" width="4" height="4" />
              <rect x="8" y="8" width="4" height="4" />
              <rect x="13" y="8" width="4" height="4" />
              <rect x="3" y="13" width="4" height="4" />
              <rect x="8" y="13" width="4" height="4" />
              <rect x="13" y="13" width="4" height="4" />
            </svg>
          </button>

          {/* Logo + App name */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-gray-800">
              Valorie Framework Builder
            </span>
          </div>

          {/* Main navigation menu */}
          <div className="flex items-center space-x-1">
            {/* New Framework - 跳转到创建页 */}
            <button
              onClick={() => navigate('/create')}
              className={`px-3 py-2 rounded font-medium transition-colors ${
                isActive('/create')
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              New Framework
            </button>

            {/* Your Frameworks - 主页，显示所有框架 */}
            <button
              onClick={() => navigate('/frameworks')}
              className={`px-3 py-2 rounded font-medium transition-colors ${
                isActive('/frameworks')
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Your Frameworks
            </button>

            {/* Library - 框架库 */}
            <button
              onClick={() => navigate('/library')}
              className={`px-3 py-2 rounded font-medium transition-colors ${
                isActive('/library')
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Library
            </button>

            {/* Dashboards - shows Coming soon */}
            <button
              onClick={() => handleComingSoon('Dashboards')}
              className="px-3 py-2 rounded text-gray-700 hover:bg-gray-100 font-medium flex items-center space-x-1"
            >
              <span>Dashboards</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreateClick}
            className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors"
          >
            Create
          </button>
        </div>

        {/* Right section: Search bar + Tool icons */}
        <div className="flex items-center space-x-3">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="w-64 px-3 py-1.5 pl-9 border border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Help icon */}
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => handleComingSoon('Help')}
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Settings icon */}
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => handleComingSoon('Settings')}
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* User avatar with dropdown menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center hover:ring-2 hover:ring-gray-300 focus:outline-none"
            >
              <span className="text-white font-medium text-sm">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.username}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>

                {/* Menu Items */}
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    navigate('/frameworks')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Your Frameworks</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    navigate('/library')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
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
                      d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                    />
                  </svg>
                  <span>Library</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    handleComingSoon('Settings')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
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
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>Settings</span>
                </button>

                <div className="border-t border-gray-100 my-1"></div>

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
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
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
