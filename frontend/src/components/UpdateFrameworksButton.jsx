import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * ⚠️ TEMPORARY COMPONENT - 修复已发布框架的 organization 字段
 * 
 * 问题：旧代码在发布框架时没有设置 organization 字段
 * 解决：为所有 publishedToOrganization=true 的框架添加 organization 字段
 * 
 * ✅ 运行一次后删除此组件
 */
function FixOrganizationFieldButton() {
  const { user } = useAuth()
  const [isFixing, setIsFixing] = useState(false)
  const [result, setResult] = useState(null)

  const handleFix = async () => {
    if (!user) {
      alert('Error: Please login first')
      return
    }

    // 检查用户是否加入了组织
    if (!user.joinedOrganization) {
      alert('⚠️ You are not a member of any organization.\n\nOnly members who have joined an organization need to run this fix.')
      return
    }

    const organizationId = user.joinedOrganization

    const confirmed = window.confirm(
      `🔧 Organization Field Fix\n\n` +
      `This will add the "organization" field to all your published frameworks.\n\n` +
      `Organization: ${organizationId}\n\n` +
      `Continue?`
    )

    if (!confirmed) return

    setIsFixing(true)
    setResult(null)

    try {
      console.log('🔍 Starting fix for user:', user.uid)
      console.log('📍 Target organization:', organizationId)

      // 查询所有已发布但缺少 organization 字段的框架
      const q = query(
        collection(db, 'frameworks'),
        where('creatorId', '==', user.uid),
        where('publishedToOrganization', '==', true)
      )

      const snapshot = await getDocs(q)
      
      console.log(`📊 Found ${snapshot.size} published frameworks`)

      let fixed = 0
      let skipped = 0
      let errors = 0

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data()
        
        try {
          // 如果已经有 organization 字段，跳过
          if (data.organization) {
            console.log(`⏭️  Skip: "${data.title}" (already has organization field)`)
            skipped++
            continue
          }

          // 添加 organization 字段
          await updateDoc(doc(db, 'frameworks', docSnapshot.id), {
            organization: organizationId,
            updatedAt: serverTimestamp(),
          })
          
          console.log(`✅ Fixed: "${data.title}" → organization: ${organizationId}`)
          fixed++
        } catch (err) {
          console.error(`❌ Error fixing "${data.title}":`, err)
          errors++
        }
      }

      const resultData = {
        success: true,
        total: snapshot.size,
        fixed,
        skipped,
        errors,
        organizationId,
      }

      setResult(resultData)

      console.log('🎉 Fix completed:', resultData)

      // 显示成功消息
      if (fixed > 0) {
        alert(
          `✅ Fix Completed!\n\n` +
          `Fixed: ${fixed} frameworks\n` +
          `Skipped: ${skipped} frameworks (already fixed)\n` +
          `Errors: ${errors}\n\n` +
          `Please refresh the page to see the changes.`
        )
      } else {
        alert(
          `✅ All Done!\n\n` +
          `No frameworks needed fixing.\n` +
          `All ${skipped} published frameworks already have the organization field.`
        )
      }
    } catch (error) {
      console.error('❌ Fix failed:', error)
      setResult({ 
        success: false, 
        error: error.message 
      })
      alert(`❌ Fix Failed\n\n${error.message}`)
    } finally {
      setIsFixing(false)
    }
  }

  // 如果用户没有加入组织，不显示按钮
  if (!user?.joinedOrganization) {
    return null
  }

  return (
    <div className="bg-purple-50 border-2 border-purple-400 rounded-lg p-6 mb-6">
      <div className="flex items-start space-x-3 mb-4">
        <svg
          className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <h3 className="text-lg font-bold text-purple-900 mb-1">
            🔧 Fix Organization Field (TEMPORARY)
          </h3>
          <p className="text-sm text-purple-800 mb-3">
            Your published frameworks are missing the <code className="bg-purple-200 px-1 rounded">organization</code> field.
            This prevents them from appearing in the <strong>Your Organization</strong> page.
          </p>
          <p className="text-sm text-purple-800 mb-2">
            Click the button below to fix all your published frameworks:
          </p>
          <ul className="text-sm text-purple-700 space-y-1 ml-4 mb-3">
            <li>• Your organization: <strong>{user.joinedOrganization}</strong></li>
            <li>• This will add the <code className="bg-purple-200 px-1">organization</code> field</li>
            <li>• Only affects frameworks where <code className="bg-purple-200 px-1">publishedToOrganization = true</code></li>
          </ul>
          <p className="text-xs text-purple-700 font-medium">
            ⚠️ Run this ONCE, then remove this component!
          </p>
        </div>
      </div>

      {/* Fix Button */}
      <button
        onClick={handleFix}
        disabled={isFixing}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isFixing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-purple-600 text-white hover:bg-purple-700'
        }`}
      >
        {isFixing ? (
          <span className="flex items-center">
            <svg
              className="animate-spin h-4 w-4 mr-2"
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
            Fixing Frameworks...
          </span>
        ) : (
          '🔧 Fix Organization Field'
        )}
      </button>

      {/* Results */}
      {result && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <h4
            className={`font-semibold mb-2 ${
              result.success ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {result.success ? '✅ Fix Completed' : '❌ Fix Failed'}
          </h4>
          {result.success ? (
            <div className="text-sm text-green-800 space-y-1">
              <p>Total published frameworks: {result.total}</p>
              <p>Fixed: {result.fixed}</p>
              <p>Skipped: {result.skipped} (already fixed)</p>
              {result.errors > 0 && <p className="text-red-600">Errors: {result.errors}</p>}
              <p className="text-xs text-gray-600 mt-2">
                Organization: {result.organizationId}
              </p>
              {result.fixed > 0 && (
                <p className="font-semibold text-green-700 mt-3">
                  🎉 All done! Please refresh the page, then remove this component.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-800">Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default FixOrganizationFieldButton