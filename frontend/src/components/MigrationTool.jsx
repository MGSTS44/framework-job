import { useState } from 'react'
import { 
  checkMigrationStatus, 
  runFullMigration 
} from '../migrate-data'

function MigrationTool() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState([])
  const [migrationComplete, setMigrationComplete] = useState(false)

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLog(prev => [...prev, { message, type, timestamp }])
    console.log(`[${timestamp}] ${message}`)
  }

  const handleCheckStatus = async () => {
    setLoading(true)
    setLog([])
    addLog('🔍 检查数据状态...', 'info')

    try {
      const result = await checkMigrationStatus()
      setStatus(result)
      addLog('✅ 状态检查完成', 'success')
      
      // 检查是否已经迁移完成
      if (result.users.needMigration === 0 && result.frameworks.needMigration === 0) {
        setMigrationComplete(true)
        addLog('🎉 所有数据已迁移完成！', 'success')
      } else {
        setMigrationComplete(false)
      }
    } catch (error) {
      addLog(`❌ 检查失败: ${error.message}`, 'error')
      console.error('Status check error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRunMigration = async () => {
    const confirmed = window.confirm(
      '⚠️ 确认要开始迁移吗？\n\n这个操作会修改数据库中的数据。\n' +
      '建议先备份 Firebase 数据。\n\n' +
      '点击"确定"继续。'
    )
    
    if (!confirmed) {
      return
    }

    setLoading(true)
    setLog([])
    addLog('🚀 开始完整迁移...', 'info')

    try {
      addLog('步骤 1/2: 迁移用户数据...', 'info')
      await new Promise(resolve => setTimeout(resolve, 500)) // 短暂延迟以便看到日志
      
      const result = await runFullMigration()
      
      if (result.success) {
        addLog(`✅ 用户迁移完成: ${result.users.updated} 个已更新, ${result.users.skipped} 个已跳过`, 'success')
        addLog(`✅ 框架迁移完成: ${result.frameworks.updated} 个已更新, ${result.frameworks.skipped} 个已跳过`, 'success')
        addLog('🎉 迁移成功！', 'success')
        
        if (result.users.errors?.length > 0 || result.frameworks.errors?.length > 0) {
          addLog('⚠️ 有一些项目迁移失败，请检查控制台', 'warning')
        }
        
        // 重新检查状态
        await handleCheckStatus()
      }
    } catch (error) {
      addLog(`❌ 迁移失败: ${error.message}`, 'error')
      console.error('Migration error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                数据迁移工具
              </h1>
              <p className="text-gray-600 mt-1">
                为现有用户和框架添加必要的新字段
              </p>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                重要提示
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>此工具会修改 Firestore 数据库中的数据</li>
                  <li>建议先在 Firebase Console 中备份数据</li>
                  <li>迁移过程中请勿关闭此页面</li>
                  <li>所有旧框架将归属到 "legacy" 租户下</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            操作步骤
          </h2>
          
          <div className="space-y-4">
            <button
              onClick={handleCheckStatus}
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading && !status ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  检查中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  步骤 1: 检查迁移状态
                </>
              )}
            </button>

            {status && !migrationComplete && (
              <button
                onClick={handleRunMigration}
                disabled={loading}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {loading && status ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    迁移中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    步骤 2: 开始迁移
                  </>
                )}
              </button>
            )}

            {migrationComplete && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-green-800 font-medium">
                    🎉 所有数据已迁移完成！
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Display */}
        {status && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              迁移状态报告
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Users */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <svg className="w-8 h-8 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h3 className="font-semibold text-gray-900 text-lg">用户数据</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">总数:</span>
                    <span className="font-semibold text-gray-900">{status.users.total}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">已迁移:</span>
                    <span className="font-semibold text-green-600">{status.users.migrated}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">需迁移:</span>
                    <span className={`font-semibold ${status.users.needMigration > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {status.users.needMigration}
                    </span>
                  </div>
                </div>
              </div>

              {/* Frameworks */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <svg className="w-8 h-8 text-purple-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="font-semibold text-gray-900 text-lg">框架数据</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">总数:</span>
                    <span className="font-semibold text-gray-900">{status.frameworks.total}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">已迁移:</span>
                    <span className="font-semibold text-green-600">{status.frameworks.migrated}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">需迁移:</span>
                    <span className={`font-semibold ${status.frameworks.needMigration > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {status.frameworks.needMigration}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Log Display */}
        {log.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              操作日志
            </h2>
            
            <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
              {log.map((entry, index) => (
                <div
                  key={index}
                  className={`mb-1 ${
                    entry.type === 'error' ? 'text-red-400' :
                    entry.type === 'success' ? 'text-green-400' :
                    entry.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500">[{entry.timestamp}]</span> {entry.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            使用说明
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
            <li>点击"检查迁移状态"查看需要迁移的数据</li>
            <li>确认无误后，点击"开始迁移"执行迁移操作</li>
            <li>迁移完成后，所有旧框架会归属到 "legacy" 租户下</li>
            <li>你可以稍后在租户设置中创建正式的租户</li>
            <li>迁移完成后可以关闭此页面</li>
          </ol>
        </div>

      </div>
    </div>
  )
}

export default MigrationTool