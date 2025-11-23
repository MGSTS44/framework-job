import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { isSuperAdmin } from '../lib/firebase'

/**
 * Navbar - Global navigation bar component (路径模式)
 *
 * ✅ 保留所有原功能，只修改路径逻辑
 * 🆕 路径模式：所有内容在 expert.valorie.ai/{tenantId}/...
 */
function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tenantId: urlTenantId } = useParams()
  const { user, logout, isAuthenticated } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showFrameworksMenu, setShowFrameworksMenu] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)

  // 使用 URL 中的 tenantId 或 user 的 tenantId
  const tenantId = urlTenantId || user?.tenantId

  const hasOrganizationAccess = !!(user?.tenantId || user?.joinedOrganization)
  const organizationId = user?.joinedOrganization || user?.tenantId
  const isOwner = !user?.joinedOrganization
  
  useEffect(() => {
    const fetchMemberCount = async () => {
      if (!organizationId) return
      
      try {
        const tenantRef = doc(db, 'tenants', organizationId)
        const tenantDoc = await getDoc(tenantRef)
        
        if (tenantDoc.exists()) {
          const tenantData = tenantDoc.data()
          setMemberCount(tenantData.members?.length || 0)
        }
      } catch (error) {
        console.error('Error fetching member count:', error)
      }
    }
    
    fetchMemberCount()
  }, [organizationId])

  // 检查是否是超级管理员
  useEffect(() => {
    setIsAdmin(isSuperAdmin())
  }, [user])

  // 🆕 路径生成函数 - 路径模式：/{tenantId}{path}
  const getPath = (path) => {
    if (tenantId) {
      return `/${tenantId}${path}`
    }
    return path
  }

  const handleCreateClick = () => {
    if (tenantId) {
      navigate(getPath('/create'))
    }
  }

  const handleComingSoon = feature => {
    alert(`${feature} - Coming soon!`)
  }

  // 登出逻辑 - 路径模式
  const handleLogout = () => {
    logout()
    setShowUserMenu(false)
    navigate('/login')
  }

  // Library 跳转 - 路径模式（不再跨域）
  const handleLibraryClick = () => {
    navigate('/library')
  }

  const isActive = path => {
    return location.pathname === path || location.pathname.includes(path)
  }

  if (location.pathname === '/login' || location.pathname === '/signup') {
    return null
  }

  if (!isAuthenticated) {
    return null
  }

  const showNavigation = !!tenantId

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left section */}
        <div className="flex items-center space-x-6">
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

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-gray-800">
              Expert Framework Builder
            </span>
          </div>

          {showNavigation && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => navigate(getPath('/create'))}
                className={`px-3 py-2 rounded font-medium transition-colors ${
                  isActive('/create')
                    ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                New Framework
              </button>

              {/* Your Frameworks - 下拉菜单 */}
              <div className="relative">
                <button
                  onClick={() => setShowFrameworksMenu(!showFrameworksMenu)}
                  onBlur={() => setTimeout(() => setShowFrameworksMenu(false), 200)}
                  className={`px-3 py-2 rounded font-medium transition-colors flex items-center space-x-1 ${
                    isActive('/frameworks') || isActive('/organization')
                      ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>Me</span>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {showFrameworksMenu && (
                  <div className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <button
                      onClick={() => {
                        navigate(getPath('/frameworks'))
                        setShowFrameworksMenu(false)
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
                      <span>My Drafts</span>
                    </button>

                    <button
                      onClick={() => {
                        if (hasOrganizationAccess) {
                          navigate(getPath('/organization'))
                          setShowFrameworksMenu(false)
                        } else {
                          alert('No organization available.')
                          setShowFrameworksMenu(false)
                        }
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                        hasOrganizationAccess ? 'text-gray-700' : 'text-gray-400 cursor-not-allowed'
                      }`}
                      disabled={!hasOrganizationAccess}
                    >
                      <div className="flex items-center space-x-2">
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
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <span>My Organization</span>
                      </div>
                      {hasOrganizationAccess && memberCount > 0 && (
                        <span className="text-xs text-gray-500">
                          {memberCount} {isOwner ? 'members' : 'joined'}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Library 按钮 */}
              <button
                onClick={handleLibraryClick}
                className={`px-3 py-2 rounded font-medium transition-colors ${
                  isActive('/library')
                    ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Marketplace
              </button>

              <button
                onClick={() => handleComingSoon('Dashboards')}
                className="px-3 py-2 rounded font-medium text-gray-700 hover:bg-gray-100"
              >
                Dashboards
              </button>
            </div>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCreateClick}
            disabled={!tenantId}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              tenantId
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Create
          </button>

          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="w-64 pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onFocus={() => handleComingSoon('Search')}
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

          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => {
              if (tenantId) {
                navigate(getPath('/settings'))
              }
            }}
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

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center hover:ring-2 hover:ring-gray-300 focus:outline-none"
            >
              <span className="text-white font-medium text-sm">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.username}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                  {tenantId && (
                    <p className="text-xs text-blue-600 mt-1">
                      {tenantId}.valorie.ai
                    </p>
                  )}
                  {user?.joinedOrganization && (
                    <p className="text-xs text-green-600 mt-1">
                      Member of: {user.joinedOrganization}
                    </p>
                  )}
                </div>

                {showNavigation && (
                  <>
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        navigate(getPath('/frameworks'))
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
                      <span>My Drafts</span>
                    </button>

                    {/* Library 链接 */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        handleLibraryClick()
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
                      <span>Marketplace</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        navigate(getPath('/settings'))
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
                      <span>Tenant Settings</span>
                    </button>

                    <div className="border-t border-gray-100 my-1"></div>
                  </>
                )}

                {/* Admin 按钮 - 仅超级管理员可见 */}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => navigate('/admin')}
                      className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 flex items-center space-x-2"
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
                          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                        />
                      </svg>
                      <span>Admin Panel</span>
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                  </>
                )}

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