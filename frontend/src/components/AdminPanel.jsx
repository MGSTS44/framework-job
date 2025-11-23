import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  isSuperAdmin,
  getWhitelistDomains,
  addWhitelistDomain,
  removeWhitelistDomain,
  getAllUsers,
  blockUser,
  unblockUser,
} from '../lib/firebase'

const AdminPanel = () => {
  const navigate = useNavigate()
  
  // States
  const [whitelistDomains, setWhitelistDomains] = useState([])
  const [users, setUsers] = useState([])
  const [newDomain, setNewDomain] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // 检查管理员权限
  useEffect(() => {
    if (!isSuperAdmin()) {
      alert('Unauthorized access. Admin only.')
      navigate('/')
      return
    }
    
    loadData()
  }, [navigate])

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      const [domains, allUsers] = await Promise.all([
        getWhitelistDomains(),
        getAllUsers()
      ])
      
      setWhitelistDomains(domains)
      setUsers(allUsers)
      setLoading(false)
    } catch (err) {
      console.error('Load data error:', err)
      setError('Failed to load data: ' + err.message)
      setLoading(false)
    }
  }

  // 添加域名
  const handleAddDomain = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    
    if (!newDomain.trim()) {
      setError('Please enter a domain')
      return
    }
    
    try {
      await addWhitelistDomain(newDomain)
      setSuccessMessage(`Domain @${newDomain} added successfully!`)
      setNewDomain('')
      // 重新加载数据
      const domains = await getWhitelistDomains()
      setWhitelistDomains(domains)
    } catch (err) {
      setError(err.message)
    }
  }

  // 移除域名
  const handleRemoveDomain = async (domain) => {
    if (!confirm(`Are you sure you want to remove @${domain} from the whitelist?`)) {
      return
    }
    
    setError('')
    setSuccessMessage('')
    
    try {
      await removeWhitelistDomain(domain)
      setSuccessMessage(`Domain @${domain} removed successfully!`)
      // 重新加载数据
      const domains = await getWhitelistDomains()
      setWhitelistDomains(domains)
    } catch (err) {
      setError(err.message)
    }
  }

  // Block用户
  const handleBlockUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to block ${userEmail}?`)) {
      return
    }
    
    setError('')
    setSuccessMessage('')
    
    try {
      await blockUser(userId)
      setSuccessMessage(`User ${userEmail} has been blocked.`)
      // 重新加载用户列表
      const allUsers = await getAllUsers()
      setUsers(allUsers)
    } catch (err) {
      setError(err.message)
    }
  }

  // Unblock用户
  const handleUnblockUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to unblock ${userEmail}?`)) {
      return
    }
    
    setError('')
    setSuccessMessage('')
    
    try {
      await unblockUser(userId)
      setSuccessMessage(`User ${userEmail} has been unblocked.`)
      // 重新加载用户列表
      const allUsers = await getAllUsers()
      setUsers(allUsers)
    } catch (err) {
      setError(err.message)
    }
  }

  // 过滤用户
  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      user.email?.toLowerCase().includes(search) ||
      user.username?.toLowerCase().includes(search) ||
      user.uid?.toLowerCase().includes(search)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔐 Admin Panel
          </h1>
          <p className="text-gray-600">
            Manage whitelist domains and user access
          </p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>✅ {successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="text-green-600 hover:text-green-800">
              ✕
            </button>
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>❌ {error}</span>
            <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Whitelist Domains Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Domain Whitelist
            </h2>
            
            <p className="text-sm text-gray-600 mb-4">
              Only users with these email domains can register
            </p>

            {/* Add Domain Form */}
            <form onSubmit={handleAddDomain} className="mb-6">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="ad.unsw.edu.au"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Add Domain
                </button>
              </div>
            </form>

            {/* Domains List */}
            <div className="space-y-2">
              {whitelistDomains.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No domains in whitelist</p>
              ) : (
                whitelistDomains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <span className="font-mono text-sm text-gray-800">@{domain}</span>
                    <button
                      onClick={() => handleRemoveDomain(domain)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* User Management Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              User Management
            </h2>

            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by email, username, or UID..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Stats */}
            <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
              <div className="bg-gray-50 p-2 rounded text-center">
                <div className="font-semibold text-gray-900">{users.length}</div>
                <div className="text-gray-600 text-xs">Total Users</div>
              </div>
              <div className="bg-green-50 p-2 rounded text-center">
                <div className="font-semibold text-green-700">
                  {users.filter(u => !u.isBlocked).length}
                </div>
                <div className="text-gray-600 text-xs">Active</div>
              </div>
              <div className="bg-red-50 p-2 rounded text-center">
                <div className="font-semibold text-red-700">
                  {users.filter(u => u.isBlocked).length}
                </div>
                <div className="text-gray-600 text-xs">Blocked</div>
              </div>
            </div>

            {/* Users List */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No users found</p>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.uid}
                    className={`p-3 border rounded-lg ${
                      user.isBlocked
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {user.username || user.email?.split('@')[0]}
                          </p>
                          {user.isBlocked && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">
                              BLOCKED
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{user.email}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">{user.uid}</p>
                      </div>
                      <div className="ml-2">
                        {user.isBlocked ? (
                          <button
                            onClick={() => handleUnblockUser(user.uid, user.email)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlockUser(user.uid, user.email)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                          >
                            Block
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel