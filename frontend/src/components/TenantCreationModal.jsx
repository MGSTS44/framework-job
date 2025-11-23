import { useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

/**
 * TenantCreationModal - 强制创建 Tenant 的 Modal
 * 
 * Features:
 * - 用户首次登录时必须创建 tenant
 * - 不能关闭（强制创建）
 * - 预填充默认值
 * - 验证 tenantId 唯一性
 */
function TenantCreationModal({ onSuccess }) {
  const { user, updateUserTenant } = useAuth()

  const [formData, setFormData] = useState({
    displayName: 'AI Readiness Expert',  // 默认值
    subdomain: 'ai-readiness',           // 默认值
    allowedOrigins: 'https://valorie.ai', // 默认值
  })

  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)
  const [validating, setValidating] = useState(false)
  const [subdomainError, setSubdomainError] = useState(null)

  // 生成随机 embedKey
  const generateEmbedKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = 'embed_'
    for (let i = 0; i < 32; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }

  // 验证 subdomain 格式
  const validateSubdomain = (subdomain) => {
    // 只允许小写字母、数字、连字符
    const regex = /^[a-z0-9-]+$/
    return regex.test(subdomain)
  }

  // 检查 subdomain 是否已存在
  const checkSubdomainAvailability = async (subdomain) => {
    if (!subdomain) return

    setValidating(true)
    setSubdomainError(null)

    try {
      // 验证格式
      if (!validateSubdomain(subdomain)) {
        setSubdomainError('Only lowercase letters, numbers, and hyphens allowed')
        setValidating(false)
        return
      }

      // 检查是否已存在
      const tenantDoc = await getDoc(doc(db, 'tenants', subdomain))
      if (tenantDoc.exists()) {
        setSubdomainError('This subdomain is already taken')
      } else {
        setSubdomainError(null)
      }
    } catch (err) {
      console.error('Error checking subdomain:', err)
      setSubdomainError('Failed to check availability')
    } finally {
      setValidating(false)
    }
  }

  // 处理 subdomain 输入变化
  const handleSubdomainChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setFormData({ ...formData, subdomain: value })
    
    // 延迟检查可用性
    if (value.length >= 3) {
      setTimeout(() => checkSubdomainAvailability(value), 500)
    }
  }

  // 创建 Tenant
  const handleCreateTenant = async (e) => {
    e.preventDefault()
    setError(null)

    // 验证
    if (!formData.displayName.trim()) {
      setError('Display name is required')
      return
    }

    if (!formData.subdomain.trim() || formData.subdomain.length < 3) {
      setError('Subdomain must be at least 3 characters')
      return
    }

    if (subdomainError) {
      setError('Please fix the subdomain error')
      return
    }

    setIsCreating(true)

    try {
      const tenantId = formData.subdomain.toLowerCase()

      // 再次检查 subdomain 是否存在（防止并发创建）
      const tenantDoc = await getDoc(doc(db, 'tenants', tenantId))
      if (tenantDoc.exists()) {
        throw new Error('This subdomain is already taken')
      }

      // 1. 创建 Tenant document
      const embedKey = generateEmbedKey()
      const allowedOriginsArray = formData.allowedOrigins
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      const tenantData = {
        id: tenantId,
        displayName: formData.displayName.trim(),
        subdomain: `${tenantId}.valorie.ai`,
        ownerId: user.uid,
        members: [
          {
            userId: user.uid,
            role: 'owner',
            joinedAt: new Date().toISOString(),  // ✅ 使用 ISO 字符串而非 serverTimestamp
          },
        ],
        embedKey: embedKey,
        allowedOrigins: allowedOriginsArray,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await setDoc(doc(db, 'tenants', tenantId), tenantData)

      // 2. 更新 User document
      await updateUserTenant(tenantId)

      console.log('✅ Tenant created successfully:', tenantId)

      // 3. 成功回调
      onSuccess(tenantId)
    } catch (err) {
      console.error('Failed to create tenant:', err)
      setError(err.message || 'Failed to create tenant. Please try again.')
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Create Your Expert Studio
              </h2>
              <p className="text-gray-600 text-sm">
                Set up your tenant to start publishing frameworks
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="px-8 py-4 bg-blue-50 border-l-4 border-blue-500">
          <p className="text-sm text-blue-800">
            <strong>What is a tenant?</strong> Your tenant is your expert workspace. It allows you to:
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4">
            <li>• Publish frameworks to your microsite</li>
            <li>• Generate embed codes for integration</li>
            <li>• Manage your expert brand and settings</li>
          </ul>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateTenant} className="px-8 py-6 space-y-6">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="AI Readiness Expert"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be shown as your expert studio name
            </p>
          </div>

          {/* Subdomain (Tenant ID) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subdomain (Tenant ID) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={formData.subdomain}
                onChange={handleSubdomainChange}
                className={`flex-1 px-4 py-3 border rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  subdomainError ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="ai-readiness"
                required
                minLength={3}
              />
              <span className="px-4 py-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600 whitespace-nowrap">
                .valorie.ai
              </span>
            </div>
            
            {validating && (
              <p className="text-xs text-gray-500 mt-1">Checking availability...</p>
            )}
            
            {subdomainError && (
              <p className="text-xs text-red-600 mt-1">{subdomainError}</p>
            )}
            
            {!subdomainError && formData.subdomain.length >= 3 && !validating && (
              <p className="text-xs text-green-600 mt-1">
                ✓ This subdomain is available
              </p>
            )}
            
            <p className="text-xs text-gray-500 mt-1">
              Use lowercase letters, numbers, and hyphens only (e.g., ai-readiness, healthcare-pro)
            </p>
          </div>

          {/* Allowed Origins */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed Origins
            </label>
            <input
              type="text"
              value={formData.allowedOrigins}
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              placeholder="https://valorie.ai"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list of domains where the embed code can be used
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isCreating || validating || !!subdomainError}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                isCreating || validating || subdomainError
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isCreating ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
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
                  <span>Creating Tenant...</span>
                </>
              ) : (
                <span>Create Tenant</span>
              )}
            </button>
          </div>
        </form>

        {/* Footer Note */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <p className="text-xs text-gray-600">
            <strong>Note:</strong> You can change these settings later in Tenant Settings.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TenantCreationModal