import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * PrivateRoute - 保护需要认证的路由（路径模式 - 简化版）
 * 
 * 在路径模式下，不需要跨域等待逻辑，因为所有内容都在同一域名下
 */
function PrivateRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth()

  // 等待认证状态加载
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // 未认证，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 已认证，渲染子组件
  return children
}

export default PrivateRoute