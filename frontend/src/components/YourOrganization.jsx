import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { collection, doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  getOrganizationFrameworks,
  getMyTenant,
  getTenantMembers,
  leaveOrganization,
  unpublishFrameworkFromOrganization,
} from '../lib/firebase'

/**
 * YourOrganization - 组织页面（修复版）
 * 
 * ✅ 核心修复：
 * - 用户访问 /:tenantId/organization 时，显示的是 joinedOrganization 的内容
 * - 例如：用户C访问 /ai-readiness4/organization，但显示 ai-readiness2 的数据
 */
function YourOrganization() {
  const navigate = useNavigate()
  const { tenantId } = useParams()  // URL中的tenantId（用户自己的）
  const { user, refreshUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState(null)
  const [members, setMembers] = useState([])
  const [frameworks, setFrameworks] = useState([])
  const [selectedMember, setSelectedMember] = useState('all')

  // ✅ 修复：确定要查询的组织ID
  // - 如果用户加入了组织，显示该组织的内容
  // - 如果用户是owner（没有加入其他组织），显示自己的组织内容
  const organizationToQuery = user?.joinedOrganization || user?.tenantId

  // 分类框架
  const myFrameworks = frameworks.filter(f => f.creatorId === user?.uid)
  const teamFrameworks = frameworks.filter(f => f.creatorId !== user?.uid)

  // 根据 filter 筛选
  const filteredMyFrameworks =
    selectedMember === 'all' || selectedMember === user?.uid
      ? myFrameworks
      : []

  const filteredTeamFrameworks =
    selectedMember === 'all'
      ? teamFrameworks
      : teamFrameworks.filter(f => f.creatorId === selectedMember)

  useEffect(() => {
    if (!user) return

    // ✅ 修复：只检查URL中的tenantId是否是用户自己的
    if (tenantId !== user.tenantId) {
      alert('You can only access your own organization page')
      navigate(`/${user.tenantId}/frameworks`)
      return
    }

    loadOrganizationData()
  }, [tenantId, user])

  const loadOrganizationData = async () => {
    try {
      setLoading(true)

      // ✅ 修复：如果用户没有加入任何组织，显示空状态
      if (!organizationToQuery) {
        console.log('ℹ️ User has not joined any organization')
        setLoading(false)
        return
      }

      // ✅ 修复：查询正确的组织数据
      console.log(`🔍 Querying organization: ${organizationToQuery}`)
      
      let orgData = null
      
      // 如果是自己的组织
      if (organizationToQuery === user.tenantId) {
        orgData = await getMyTenant()
      } else {
        // 如果是加入的组织
        const tenantRef = doc(db, 'tenants', organizationToQuery)
        const tenantDoc = await getDoc(tenantRef)
        if (tenantDoc.exists()) {
          orgData = { id: tenantDoc.id, ...tenantDoc.data() }
        }
      }
      
      if (orgData) {
        setOrganization(orgData)
        console.log('✅ Organization loaded:', orgData.id)
      } else {
        throw new Error('Organization not found')
      }

      // ✅ 修复：加载正确组织的成员列表
      const membersData = await getTenantMembers(organizationToQuery)
      console.log('✅ Loaded members:', membersData.length)
      setMembers(membersData)

      // ✅ 修复：加载正确组织的共享框架
      const frameworksData = await getOrganizationFrameworks(organizationToQuery)
      console.log('✅ Loaded frameworks:', frameworksData.length)
      setFrameworks(frameworksData)
    } catch (error) {
      console.error('❌ Load organization error:', error)
      console.log('🔍 YourOrganization Debug:', {
      urlTenantId: tenantId,
      userTenantId: user?.tenantId,
      userJoinedOrg: user?.joinedOrganization,
      organizationToQuery: organizationToQuery,
    })
      alert('Failed to load organization data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveOrganization = async () => {
    // ✅ 修复：只有member才能离开组织
    if (organizationToQuery === user.tenantId) {
      alert('You cannot leave your own organization.')
      return
    }

    const confirmed = confirm(
      '⚠️ Are you sure you want to leave this organization?\n\n' +
      'All your frameworks will be unpublished from this organization.'
    )

    if (!confirmed) return

    try {
      setLoading(true)
      await leaveOrganization(organizationToQuery)
      
      // 刷新用户数据
      await refreshUser()

      alert('✅ You have successfully left the organization.')
      
      // 刷新页面以显示空状态
      window.location.reload()
    } catch (error) {
      console.error('❌ Leave organization error:', error)
      alert('Failed to leave organization: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading organization data...</p>
        </div>
      </div>
    )
  }

  // ✅ 修复：如果用户没有加入任何组织，显示提示
  if (!organizationToQuery) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg
            className="mx-auto h-16 w-16 text-gray-400 mb-4"
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Organization
          </h2>
          <p className="text-gray-600 mb-6">
            You haven't joined any organization yet. Ask a team leader for an invitation link.
          </p>
          <button
            onClick={() => navigate(`/${user.tenantId}/frameworks`)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Me
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Organization Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {organization?.displayName || organizationToQuery}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {members.length} {members.length === 1 ? 'member' : 'members'}
                {organizationToQuery === user.tenantId && ' • You are the owner'}
                {organizationToQuery !== user.tenantId && ' • You are a member'}
              </p>
              {/* ✅ 新增：显示组织ID信息 */}
              <p className="text-xs text-gray-400 mt-1">
                Organization ID: {organizationToQuery}
              </p>
            </div>

            {/* Leave Organization Button (只有 member 可以看到) */}
            {organizationToQuery !== user.tenantId && (
              <button
                onClick={handleLeaveOrganization}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Leave Organization
              </button>
            )}
          </div>

          {/* Members Preview */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Members:</span>
              <div className="flex -space-x-2">
                {members.slice(0, 5).map((member, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white"
                    title={member.username || member.email}
                  >
                    <span className="text-white text-xs font-medium">
                      {(member.username || member.email)[0].toUpperCase()}
                    </span>
                  </div>
                ))}
                {members.length > 5 && (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center border-2 border-white">
                    <span className="text-gray-600 text-xs font-medium">
                      +{members.length - 5}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* ✅ 添加 "+" 邀请按钮 - 只有 owner 可以看到 */}
            {organizationToQuery === user.tenantId && (
              <button
                onClick={() => navigate(`/${user.tenantId}/settings`)}
                className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                title="Invite members to organization"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite
              </button>
            )}
          </div>
        </div>

        {/* Filter and Count */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <label htmlFor="member-filter" className="text-sm font-medium text-gray-700">
              Filter by:
            </label>
            <select
              id="member-filter"
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            >
              <option value="all">All Members</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.username || member.email}
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-500">
            {filteredMyFrameworks.length + filteredTeamFrameworks.length} frameworks
          </span>
        </div>

        {/* My Shared Frameworks */}
        {filteredMyFrameworks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              My Shared Frameworks ({filteredMyFrameworks.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMyFrameworks.map((framework) => (
                <FrameworkCard
                  key={framework.id}
                  framework={framework}
                  isOwner={true}
                  onRefresh={loadOrganizationData}
                />
              ))}
            </div>
          </div>
        )}

        {/* Team Shared Frameworks */}
        {filteredTeamFrameworks.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Team Shared Frameworks ({filteredTeamFrameworks.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeamFrameworks.map((framework) => (
                <FrameworkCard
                  key={framework.id}
                  framework={framework}
                  isOwner={false}
                  members={members}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredMyFrameworks.length === 0 && filteredTeamFrameworks.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
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
            <p className="text-gray-600">
              No shared frameworks yet. Publish your frameworks to share with the team!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * FrameworkCard - 框架卡片组件
 */
function FrameworkCard({ framework, isOwner, onRefresh, members = [] }) {
  const navigate = useNavigate()
  const [showDetails, setShowDetails] = useState(false)

  // 获取创建者信息
  const creator = members.find(m => m.userId === framework.creatorId)
  const creatorName = creator?.username || creator?.email || 'Unknown'

  const handleView = () => {
    setShowDetails(true)
  }

  const handleEdit = () => {
    navigate(`/${framework.tenantId}/editor/${framework.id}`)
  }

  const handleUnpublish = async () => {
    if (!isOwner) return

    const confirmed = confirm('Are you sure you want to unpublish this framework?')
    if (!confirmed) return

    try {
      await unpublishFrameworkFromOrganization(framework.id)
      alert('✅ Framework unpublished')
      if (onRefresh) onRefresh()
    } catch (error) {
      console.error('Unpublish error:', error)
      alert('Failed to unpublish framework: ' + error.message)
    }
  }

  // Get category color
  const getCategoryColor = category => {
    const colors = {
      Technology: 'bg-blue-100 text-blue-800',
      Healthcare: 'bg-green-100 text-green-800',
      Research: 'bg-purple-100 text-purple-800',
      Financial: 'bg-yellow-100 text-yellow-800',
      Compliance: 'bg-indigo-100 text-indigo-800',
      Other: 'bg-gray-100 text-gray-800',
    }
    return colors[category] || colors['Other']
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {framework.title || 'Untitled Framework'}
            </h3>
            <span className="text-sm text-gray-500">
              by {isOwner ? 'You' : creatorName}
            </span>
          </div>
        </div>

        {/* Category */}
        {framework.category && (
          <span className={`inline-block px-3 py-1 text-xs rounded-full mb-3 font-medium ${getCategoryColor(framework.category)}`}>
            {framework.category}
          </span>
        )}

        {/* Confidence Badge */}
        {framework.confidence && (
          <div className="mb-3">
            <span className="text-sm text-gray-600">
              {Math.round(framework.confidence)}% confidence
            </span>
          </div>
        )}

        {/* Key Artefacts Preview */}
        {framework.artefacts?.additional && framework.artefacts.additional.length > 0 && (
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Key Artefacts:</p>
            <ul className="space-y-1">
              {framework.artefacts.additional.slice(0, 3).map((art, idx) => (
                <li key={idx} className="text-sm text-gray-600 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{typeof art === 'object' ? art.name : art}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-gray-500 mb-4">
          Updated: {framework.updatedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleView}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            View
          </button>
          {isOwner && (
            <>
              <button
                onClick={handleEdit}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={handleUnpublish}
                className="px-3 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors"
                title="Unpublish"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Details Modal - Marketplace Style */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {framework.title || 'Untitled Framework'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {framework.version || '1.0'} | {framework.category || 'Other'}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Confidence */}
              {framework.confidence && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Confidence
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className="text-3xl font-bold text-green-600">
                      {Math.round(framework.confidence)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Key Artefacts */}
              {framework.artefacts?.additional && framework.artefacts.additional.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Key Artefacts
                  </h3>
                  <ul className="space-y-2">
                    {framework.artefacts.additional.map((art, idx) => (
                      <li key={idx} className="text-gray-700">
                        • {typeof art === 'object' 
                            ? `${art.name}${art.description ? ': ' + art.description : ''}`
                            : art}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* POV */}
              {framework.pov && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Point of View
                  </h3>
                  <p className="text-gray-700">{framework.pov}</p>
                </div>
              )}

              {/* Tags */}
              {framework.tags && framework.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {framework.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Information
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>Created by: {creatorName}</div>
                  <div>Family: {framework.family || framework.category || 'N/A'}</div>
                  <div>Version: {framework.version || '1.0'}</div>
                  <div>
                    Published: {framework.publishedAt?.toDate?.()?.toLocaleDateString() || 
                               framework.updatedAt?.toDate?.()?.toLocaleDateString() || 
                               'Unknown'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
                {isOwner && (
                  <button
                    onClick={() => {
                      setShowDetails(false)
                      handleEdit()
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit Framework
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default YourOrganization