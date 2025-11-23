import { Navigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * TenantRoute - 租户路由保护组件（路径模式 - 简化版）
 * 
 * 在路径模式下，不需要跨域等待逻辑，因为所有内容都在同一域名下
 * - owner可以访问自己的tenant
 * - member可以访问joinedOrganization
 */
function TenantRoute({ children }) {
  const { user, loading } = useAuth()
  const { tenantId } = useParams()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
            aria-label="Loading"
          />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.tenantId) {
    console.warn('User has no tenantId, redirecting to root...')
    return <Navigate to="/" replace />
  }

  // 访问控制：用户可以访问自己的 tenant 或加入的 organization
  const isOwner = tenantId === user.tenantId
  const isMember = tenantId === user.joinedOrganization
  const hasAccess = isOwner || isMember

  if (!hasAccess) {
    console.error(
      `❌ Access denied:\n` +
      `  - URL tenantId: ${tenantId}\n` +
      `  - User tenantId: ${user.tenantId}\n` +
      `  - User joinedOrganization: ${user.joinedOrganization || 'none'}`
    )

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don&apos;t have access to this organization&apos;s content.
          </p>

          <Link
            to={`/${user.tenantId}/frameworks`}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            Go to Your Frameworks
          </Link>
        </div>
      </div>
    )
  }

  // 所有验证通过 - 渲染子组件
  return children
}

export default TenantRoute