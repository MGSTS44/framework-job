import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { 
  getMyTenant, 
  updateTenant, 
  regenerateEmbedKey,
  getTenantMembers,
  generateInviteLink,
  revokeInviteLink,
  removeMember,
  leaveOrganization,
} from '../lib/firebase'

function TenantSettings() {
  const { user, refreshUser } = useAuth()
  const [tenant, setTenant] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showEmbedCode, setShowEmbedCode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [joinedOrganization, setJoinedOrganization] = useState(null)
  const [organizationMembers, setOrganizationMembers] = useState([])
  const [inviteEmails, setInviteEmails] = useState(['']) // 改为数组
  
  // 邀请链接相关状态
  const [showInviteSection, setShowInviteSection] = useState(false)
  const [inviteMaxUses, setInviteMaxUses] = useState(1) // 1 或 -1
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(7)
  const [generatedInviteLink, setGeneratedInviteLink] = useState(null)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  
  const [formData, setFormData] = useState({
    displayName: '',
    subdomain: '',
    allowedOrigins: '',
  })

  // ✅ 修复：判断用户是否是owner
  const isOwner = tenant?.members?.some(m => m.userId === user?.uid && m.role === 'owner')

  useEffect(() => {
    loadTenant()
  }, [])

  // 当maxUses改变时，重置email数组
  useEffect(() => {
    if (inviteMaxUses === 1 && inviteEmails.length > 1) {
      // 从Unlimited切换到Single Use时，只保留第一个email
      setInviteEmails([inviteEmails[0] || ''])
    }
  }, [inviteMaxUses])

  const loadTenant = async () => {
    try {
      setLoading(true)
      const tenantData = await getMyTenant()
      
      if (tenantData) {
        setTenant(tenantData)
        setFormData({
          displayName: tenantData.displayName || '',
          subdomain: tenantData.subdomain || '',
          allowedOrigins: (tenantData.allowedOrigins || []).join(', '),
        })

        // 加载成员详细信息
        const membersData = await getTenantMembers(tenantData.id)
        setMembers(membersData)
      }

      // ✅ 修复：在useEffect中正确加载organization数据
      if (user?.joinedOrganization) {
        try {
          const orgRef = doc(db, 'tenants', user.joinedOrganization)
          const orgDoc = await getDoc(orgRef)
          
          if (orgDoc.exists()) {
            const orgData = { id: orgDoc.id, ...orgDoc.data() }
            setJoinedOrganization(orgData)
            
            // 加载organization的成员
            const orgMembers = await getTenantMembers(user.joinedOrganization)
            setOrganizationMembers(orgMembers)
            
            console.log('✅ Loaded organization:', orgData.displayName)
            console.log('✅ Organization members:', orgMembers.length)
          }
        } catch (error) {
          console.error('Load organization error:', error)
        }
      }
    } catch (error) {
      console.error('Load tenant error:', error)
      alert('Failed to load tenant settings: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // ✅ 修复：正确实现handleLeaveOrganization
  const handleLeaveOrganization = async () => {
    if (!user?.joinedOrganization) return

    const confirmed = confirm(
      'Are you sure you want to leave this organization?\n\n' +
      'Your frameworks will be unpublished from the organization.'
    )

    if (!confirmed) return

    try {
      setSaving(true)
      await leaveOrganization(user.joinedOrganization)
      await refreshUser() // 刷新AuthContext
      
      alert('✅ Successfully left the organization')
      // 清空organization相关状态
      setJoinedOrganization(null)
      setOrganizationMembers([])
      // 重新加载tenant数据
      await loadTenant()
    } catch (error) {
      console.error('Leave organization error:', error)
      alert('Failed to leave organization: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTenant = async (e) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      
      const allowedOriginsArray = formData.allowedOrigins
        .split(',')
        .map(o => o.trim())
        .filter(o => o)

      await updateTenant(tenant.id, {
        displayName: formData.displayName.trim(),
        allowedOrigins: allowedOriginsArray,
      })

      alert('✅ Tenant updated successfully!')
      setIsEditing(false)
      await loadTenant()
    } catch (error) {
      console.error('Update tenant error:', error)
      alert('Failed to update tenant: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateKey = async () => {
    if (!confirm('⚠️ Are you sure you want to regenerate the embed key?\n\nThis will break existing integrations!\n\nYou will need to update the embed code on all microsites.')) {
      return
    }

    try {
      setSaving(true)
      const result = await regenerateEmbedKey(tenant.id)
      
      if (result.success) {
        alert('✅ Embed key regenerated successfully!\n\nPlease update your microsite embed code.')
        await loadTenant()
      }
    } catch (error) {
      console.error('Regenerate key error:', error)
      alert('Failed to regenerate key: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // 生成邀请链接
    const handleGenerateInviteLink = async () => {
    // ✅ 验证email格式 - 改为验证所有emails
    const validEmails = inviteEmails.filter(email => email.trim())
    
    if (validEmails.length === 0) {
      alert('Please enter at least one email address')
      return
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = validEmails.filter(email => !emailRegex.test(email))
    
    if (invalidEmails.length > 0) {
      alert('Please enter valid email addresses')
      return
    }

    try {
      setGeneratingInvite(true)
      
      // 为每个email生成邀请链接
      const results = []
      for (const email of validEmails) {
        const result = await generateInviteLink({
          maxUses: inviteMaxUses,
          expiresInDays: inviteExpiresInDays,
          inviteEmail: email.trim().toLowerCase(),
        })
        results.push(result)
      }

      setGeneratedInviteLink(results[0]) // 显示第一个生成的链接
      await loadTenant()
      
      // ✅ 成功后重置email数组
      setInviteEmails([''])
      
      alert(`✅ Successfully generated ${results.length} invite link(s)!`)
    } catch (error) {
      console.error('Generate invite link error:', error)
      alert('Failed to generate invite link: ' + error.message)
    } finally {
      setGeneratingInvite(false)
    }
  }

  // 添加email输入框
  const handleAddEmail = () => {
    setInviteEmails([...inviteEmails, ''])
  }

  // 删除email输入框
  const handleRemoveEmail = (index) => {
    if (inviteEmails.length > 1) {
      const newEmails = inviteEmails.filter((_, i) => i !== index)
      setInviteEmails(newEmails)
    }
  }

  // 更新email值
  const handleEmailChange = (index, value) => {
    const newEmails = [...inviteEmails]
    newEmails[index] = value
    setInviteEmails(newEmails)
  }

  // 撤销邀请链接
  const handleRevokeInviteLink = async (token) => {
    if (!confirm('Are you sure you want to revoke this invite link?')) {
      return
    }

    try {
      await revokeInviteLink(token)
      alert('✅ Invite link revoked successfully!')
      await loadTenant()
      setGeneratedInviteLink(null)
    } catch (error) {
      console.error('Revoke invite link error:', error)
      alert('Failed to revoke invite link: ' + error.message)
    }
  }

  // 移除成员
  const handleRemoveMember = async (userId, username) => {
    if (!confirm(`Are you sure you want to remove ${username} from this organization?\n\nThis will:\n- Remove their access to the organization\n- Unpublish their frameworks from the organization\n- Keep their frameworks in their personal workspace`)) {
      return
    }

    try {
      setSaving(true)
      const result = await removeMember(tenant.id, userId)
      
      alert(`✅ Member removed successfully!\n\nUnpublished ${result.unpublishedCount} framework(s) from organization.`)
      await loadTenant()
    } catch (error) {
      console.error('Remove member error:', error)
      alert('Failed to remove member: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text) => {
    // 尝试使用现代 Clipboard API（需要HTTPS）
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          alert('✅ Copied to clipboard!')
        })
        .catch(() => {
          // 失败则使用fallback
          fallbackCopyToClipboard(text)
        })
    } else {
      // 直接使用fallback（HTTP环境）
      fallbackCopyToClipboard(text)
    }
  }

  // Fallback复制方法（适用于HTTP环境）
  const fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      const successful = document.execCommand('copy')
      if (successful) {
        alert('✅ Copied to clipboard!')
      } else {
        alert('❌ Copy failed. Please copy manually:\n\n' + text)
      }
    } catch (err) {
      console.error('Copy error:', err)
      alert('❌ Copy failed. Please copy manually:\n\n' + text)
    }
    
    document.body.removeChild(textArea)
  }

  const generateEmbedCode = () => {
    const baseUrl = window.location.origin
    return `<!-- AI Readiness Framework Selector -->
<button id="openFrameworkSelector" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
  Choose Your Framework
</button>

<script>
(function() {
  const button = document.getElementById('openFrameworkSelector');
  
  button.addEventListener('click', function() {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9998; display: flex; align-items: center; justify-content: center;';
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = 'background: white; width: 90%; max-width: 800px; height: 80vh; border-radius: 12px; overflow: hidden; position: relative;';
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position: absolute; top: 16px; right: 16px; z-index: 10; background: white; border: 2px solid #e5e7eb; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center;';
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = '${baseUrl}/${tenant.id}/embed?key=${tenant.embedKey}';
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    
    // Close modal function
    const closeModal = () => {
      backdrop.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closeModal();
    });
    
    // Listen for framework selection
    window.addEventListener('message', function(event) {
      if (event.data.type === 'frameworkSelected') {
        console.log('Selected framework:', event.data.framework);
        // TODO: Handle framework selection
        closeModal();
      }
    });
    
    modal.appendChild(closeBtn);
    modal.appendChild(iframe);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  });
})();
</script>`
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    if (date.toDate) date = date.toDate()
    return new Date(date).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Failed to load tenant</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Tenant Settings
          </h1>
          <p className="text-gray-600">
            Manage your organization settings and integrations
          </p>
        </div>

        {/* ========== My Tenant Section ========== */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              My Tenant
            </h3>
            {isOwner && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                Owner
              </span>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleUpdateTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subdomain (Read-only)
                </label>
                <input
                  type="text"
                  value={formData.subdomain}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allowed Origins (comma-separated)
                </label>
                <textarea
                  value={formData.allowedOrigins}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  rows={3}
                  placeholder="https://example.com, https://app.example.com"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Display Name</label>
                  <p className="text-gray-900 mt-1">{tenant.displayName}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Subdomain</label>
                  <p className="text-gray-900 font-mono mt-1">{tenant.subdomain || tenant.id}</p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Allowed Origins</label>
                  <p className="text-gray-900 mt-1">
                    {tenant.allowedOrigins?.length > 0 
                      ? tenant.allowedOrigins.join(', ') 
                      : 'None configured'}
                  </p>
                </div>
              </div>

              {isOwner && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit Settings
                </button>
              )}
            </div>
          )}

          {/* Members Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">
                Members ({members.length})
              </h4>
              {isOwner && (
                <button
                  onClick={() => setShowInviteSection(!showInviteSection)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Invite Member
                </button>
              )}
            </div>

            <div className="space-y-3 mb-6">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      member.role === 'owner' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      <span className={`text-sm font-medium ${
                        member.role === 'owner' ? 'text-blue-700' : 'text-green-700'
                      }`}>
                        {member.username?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>

                    {/* Member Info */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{member.username}</p>
                        {member.userId === user?.uid && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            You
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          member.role === 'owner' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {member.role}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      <p className="text-xs text-gray-500">Joined {formatDate(member.joinedAt)}</p>
                    </div>
                  </div>

                  {/* Remove button (only for owner, and not for themselves) */}
                  {isOwner && member.userId !== user?.uid && (
                    <button
                      onClick={() => handleRemoveMember(member.userId, member.username)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Invite Section */}
            {isOwner && showInviteSection && (
              <div className="border-t border-gray-200 pt-6">
                <h5 className="text-md font-semibold text-gray-900 mb-4">Generate Invite Link</h5>
                
                <div className="space-y-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Uses
                      </label>
                      <select
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      >
                        <option value={1}>Single Use</option>
                        <option value={-1}>Unlimited</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expires In
                      </label>
                      <select
                        value={inviteExpiresInDays}
                        onChange={(e) => setInviteExpiresInDays(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      >
                        <option value={1}>1 day</option>
                        <option value={7}>7 days</option>
                        <option value={30}>30 days</option>
                      </select>
                    </div>
                  </div>

                  {/* ✅ 新增：Email 输入框 - 根据maxUses显示单个或多个 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invitee Email{inviteMaxUses === -1 ? 's' : ''} <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="space-y-3">
                      {inviteMaxUses === -1 ? (
                        // Unlimited: 显示多个email输入框
                        <>
                          {inviteEmails.map((email, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="email"
                                value={email}
                                onChange={(e) => handleEmailChange(index, e.target.value)}
                                placeholder="user@example.com"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                required
                              />
                              {inviteEmails.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEmail(index)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove email"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                          
                          <button
                            type="button"
                            onClick={handleAddEmail}
                            className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Another Email
                          </button>
                          
                          <p className="text-xs text-gray-500">
                            Multiple invitations will be generated, one for each email address
                          </p>
                        </>
                      ) : (
                        // Single Use: 只显示一个email输入框
                        <>
                          <input
                            type="email"
                            value={inviteEmails[0]}
                            onChange={(e) => handleEmailChange(0, e.target.value)}
                            placeholder="user@example.com"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                            required
                          />
                          <p className="text-xs text-gray-500">
                            Only this email address will be able to accept the invitation
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateInviteLink}
                    disabled={generatingInvite}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {generatingInvite ? 'Generating...' : 'Generate Link'}
                  </button>
                </div>

                {generatedInviteLink && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-900 mb-2">✅ Invite Link Generated!</p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={generatedInviteLink.inviteLink}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-green-300 rounded text-sm font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(generatedInviteLink.inviteLink)}
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                      Expires: {formatDate(generatedInviteLink.expiresAt)} • 
                      Max uses: {generatedInviteLink.maxUses === -1 ? 'Unlimited' : generatedInviteLink.maxUses}
                    </p>
                  </div>
                )}

                {/* Active Invite Links */}
                {tenant.inviteLinks && tenant.inviteLinks.filter(link => link.isActive).length > 0 && (
                  <div className="mt-6">
                    <h5 className="text-md font-semibold text-gray-900 mb-3">Active Invite Links</h5>
                    <div className="space-y-2">
                      {tenant.inviteLinks
                        .filter(link => link.isActive)
                        .map((link) => (
                          <div key={link.token} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                            <div className="text-sm">
                              <p className="font-mono text-gray-600">...{link.token.slice(-8)}</p>
                              <p className="text-xs text-gray-500">
                                Used: {link.usedCount}/{link.maxUses === -1 ? '∞' : link.maxUses} • 
                                Expires: {formatDate(link.expiresAt)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRevokeInviteLink(link.token)}
                              className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========== My Organization Section ========== */}
        {user?.joinedOrganization && joinedOrganization && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-900">
                  My Organization
                </h3>
              </div>
              
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Member
              </span>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Organization Name</label>
                  <p className="text-gray-900 mt-1">{joinedOrganization.displayName}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">Organization ID</label>
                  <p className="text-gray-900 font-mono mt-1">{joinedOrganization.id}</p>
                </div>
              </div>
            </div>

            {/* Organization Members */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Organization Members ({organizationMembers.length})
              </h4>
              
              <div className="space-y-3">
                {organizationMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        member.role === 'owner' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        <span className={`text-sm font-medium ${
                          member.role === 'owner' ? 'text-green-700' : 'text-blue-700'
                        }`}>
                          {member.username?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>

                      {/* Member Info */}
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900">{member.username}</p>
                          {member.userId === user?.uid && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                              You
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            member.role === 'owner' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {member.role}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{member.email}</p>
                        <p className="text-xs text-gray-500">Joined {formatDate(member.joinedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Leave Organization Button */}
            <button
              onClick={handleLeaveOrganization}
              disabled={saving}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Leaving...' : 'Leave Organization'}
            </button>
          </div>
        )}

        {/* ========== Embed Key Section ========== */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Embed Integration
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                Embed Key
              </label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 px-4 py-2 bg-gray-100 rounded-lg font-mono text-sm overflow-x-auto">
                  {tenant.embedKey}
                </code>
                <button
                  onClick={() => copyToClipboard(tenant.embedKey)}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                {isOwner && (
                  <button
                    onClick={handleRegenerateKey}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowEmbedCode(!showEmbedCode)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                {showEmbedCode ? 'Hide' : 'Show'} Embed Code
              </button>
            </div>

            {showEmbedCode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Copy this code to your microsite:
                </label>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                    {generateEmbedCode()}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(generateEmbedCode())}
                    className="absolute top-2 right-2 px-3 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    Copy
                  </button>
                </div>
                
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Usage:</strong> Paste this code into your microsite HTML (e.g., valorie.ai/ai-readiness). 
                    The button will open a modal that shows only your published frameworks.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default TenantSettings