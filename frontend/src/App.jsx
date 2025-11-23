import { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import TenantRoute from './components/TenantRoute'
import Navbar from './components/Navbar'
import Login from './components/Login'
import Signup from './components/Signup'
import YourFrameworks from './components/YourFrameworks'
import CreateFramework from './components/CreateFramework'
import FrameworkEditor from './components/FrameworkEditor'
import Library from './components/Library'
import MigrationTool from './components/MigrationTool'
import TenantSettings from './components/TenantSettings'
import TenantCreationModal from './components/TenantCreationModal'
import InviteAccept from './components/InviteAccept'
import YourOrganization from './components/YourOrganization' 
import AdminPanel from './components/AdminPanel'
import LandingPage from './components/LandingPage'

/**
 * RootRedirect - 根路径重定向组件
 * 改用路径模式：expert.valorie.ai/{tenantId}/frameworks
 */
function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // 未登录 - 跳转到登录页
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // 已登录但没有 tenantId - 等待创建
  if (!user.tenantId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Setting up your workspace...</p>
        </div>
      </div>
    )
  }

  // 已登录且有 tenantId - 跳转到工作区（路径模式）
  return <Navigate to={`/${user.tenantId}/frameworks`} replace />
}

/**
 * AppContent - Router 内部的内容组件
 */
function AppContent() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [showTenantModal, setShowTenantModal] = useState(false)

  useEffect(() => {
    if (!loading && user && !user.tenantId) {
      setShowTenantModal(true)
    } else {
      setShowTenantModal(false)
    }
  }, [user, loading])

  // Tenant 创建成功后的回调 - 使用路径模式
  const handleTenantCreated = (tenantId) => {
    setShowTenantModal(false)
    console.log('✅ Tenant created, redirecting to frameworks...')
    navigate(`/${tenantId}/frameworks`)
  }

  return (
    <>
      <Navbar />

      {showTenantModal && (
        <TenantCreationModal onSuccess={handleTenantCreated} />
      )}

      <Routes>
        {/* ========== 公共路由 ========== */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/library" element={<PrivateRoute><Library /></PrivateRoute>} />
        <Route path="/migrate" element={<MigrationTool />} />
        <Route path="/invite/:token" element={<InviteAccept />} />
        

        {/* ========== 租户路由（路径模式：/{tenantId}/...) ========== */}
        <Route path="/:tenantId/frameworks" element={<TenantRoute><YourFrameworks /></TenantRoute>} />
        <Route path="/:tenantId/organization" element={<TenantRoute><YourOrganization /></TenantRoute>} />
        <Route path="/:tenantId/create" element={<TenantRoute><CreateFramework /></TenantRoute>} />
        <Route path="/:tenantId/editor/:id" element={<TenantRoute><FrameworkEditor /></TenantRoute>} />
        <Route path="/:tenantId/settings" element={<TenantRoute><TenantSettings /></TenantRoute>} />

        {/* ========== 根路径和 404 ========== */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Page Not Found
                </h2>
                <p className="text-gray-600 mb-6">
                  The page you're looking for doesn't exist.
                </p>
                <a
                  href="/"
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Go to Home
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </>
  )
}

/**
 * App - 主应用组件
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App