import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getInviteLink, acceptInvite } from '../lib/firebase'

/**
 * InviteAccept - 处理邀请链接接受页面（修复版）
 * 
 * ✅ 核心修复：
 * - 接受邀请后调用 refreshUser() 更新 AuthContext
 * - 确保前端 user.joinedOrganization 立即同步
 * 
 * URL: /invite/:token
 */
function InviteAccept() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading, refreshUser } = useAuth()  // ✅ 新增 refreshUser

  const [inviteInfo, setInviteInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState(null)

  // 加载邀请链接信息
  useEffect(() => {
    loadInviteInfo()
  }, [token])

  const loadInviteInfo = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const info = await getInviteLink(token)
      setInviteInfo(info)

      // 检查邀请链接是否有效
      if (!info.isActive) {
        setError('This invite link has been revoked.')
      } else if (info.isExpired) {
        setError('This invite link has expired.')
      } else if (info.isMaxUsesReached) {
        setError('This invite link has reached its maximum number of uses.')
      }
    } catch (err) {
      console.error('Load invite error:', err)
      setError(err.message || 'Invalid invite link')
    } finally {
      setLoading(false)
    }
  }

  // 接受邀请
  const handleAcceptInvite = async () => {
    if (!user) {
      // 未登录 - 跳转到登录页，并在登录后返回
      navigate(`/login?redirect=/invite/${token}`)
      return
    }

    try {
      setAccepting(true)
      setError(null)

      console.log('🔄 Accepting invite...')
      const result = await acceptInvite(token)

      if (result.success) {
        console.log('✅ Invite accepted successfully')
        console.log(`📦 Updated ${result.frameworksUpdated || 0} frameworks`)

        // ✅ 核心修复：立即刷新用户数据
        console.log('🔄 Refreshing user data...')
        await refreshUser()
        console.log('✅ User data refreshed')

        // 成功提示
        alert(
          `✅ Welcome to ${inviteInfo.tenantName}!\n\n` +
          `You can now access shared frameworks and collaborate with your team.\n\n` +
          `Your frameworks will be updated to the organization.`
        )

        // ✅ 修复：跳转到用户自己的 organization 页面
        // 用户C加入了A的组织后，应该访问 /ai-readiness4/organization
        console.log(`🔀 Redirecting to /${user.tenantId}/organization`)
        navigate(`/${user.tenantId}/organization`)
      }
    } catch (err) {
      console.error('❌ Accept invite error:', err)
      setError(err.message || 'Failed to accept invite')
      setAccepting(false)
    }
  }

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-gray-600">Loading invite...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !inviteInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <svg className="mx-auto h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-block"
          >
            Go to Home
          </a>
        </div>
      </div>
    )
  }

  // Valid invite - show accept page
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            You're Invited!
          </h1>
          <p className="text-gray-600">
            Join the organization and start collaborating
          </p>
        </div>

        {/* Invite Details */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {inviteInfo.tenantName}
          </h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Organization ID:</span>
              <span className="text-gray-900 font-mono text-xs">{inviteInfo.tenantId}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                error 
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {error || 'Valid'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Expires:</span>
              <span className="text-gray-900">{formatDate(inviteInfo.expiresAt)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Usage:</span>
              <span className="text-gray-900">
                {inviteInfo.usedCount} / {inviteInfo.maxUses === -1 ? '∞' : inviteInfo.maxUses}
              </span>
            </div>
          </div>
        </div>

        {/* What you'll get */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            As a member, you'll be able to:
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700 text-sm">Share your frameworks with the team</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700 text-sm">View shared frameworks from other members</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700 text-sm">Collaborate with your organization</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-700 text-sm">Your own workspace remains independent</span>
            </li>
          </ul>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {!error ? (
            <>
              <button
                onClick={handleAcceptInvite}
                disabled={accepting}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center"
              >
                {accepting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Accepting...
                  </>
                ) : (
                  <>
                    {user ? 'Accept Invitation' : 'Login to Accept'}
                  </>
                )}
              </button>

              {!user && (
                <p className="text-center text-sm text-gray-600">
                  You need to be logged in to accept this invitation
                </p>
              )}
            </>
          ) : (
            <a
              href="/"
              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium inline-block text-center"
            >
              Go to Home
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            By accepting this invitation, you agree to join the organization and follow its guidelines.
          </p>
        </div>
      </div>
    </div>
  )
}

export default InviteAccept
