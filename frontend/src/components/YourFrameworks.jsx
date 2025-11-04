import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import FrameworkCard from './FrameworkCard'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

function YourFrameworks() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [frameworks, setFrameworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedFamilies, setExpandedFamilies] = useState({})

  // 实时监听 Frameworks 变化
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    // 创建 Firestore 查询
    const q = query(
      collection(db, 'frameworks'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    // 实时监听
    const unsubscribe = onSnapshot(
      q,
      querySnapshot => {
        const frameworksList = querySnapshot.docs.map(doc => {
          const data = doc.data()

          // ✅ 处理 artefacts，生成 preview_artefacts
          const artefacts = data.artefacts || {}
          const additional = artefacts.additional || []

          // 取前 3 个 artefact 用于卡片显示
          const preview_artefacts = additional.slice(0, 3).map(art => {
            // ✅ 添加类型检查和防护
            if (typeof art === 'object' && art !== null) {
              return {
                name: String(art.name || ''), // ✅ 强制转换为字符串
                description: String(art.description || '').substring(0, 100),
              }
            } else if (typeof art === 'string') {
              // 如果是字符串,直接使用
              return {
                name: art,
                description: '',
              }
            } else {
              // 未知类型,返回空对象
              console.warn('Unknown artefact type:', art)
              return {
                name: 'Unknown Artefact',
                description: '',
              }
            }
          })
          // 如果 additional 为空,但有 default,也显示 default
          if (preview_artefacts.length === 0 && artefacts.default) {
            const defaultArt = artefacts.default
            preview_artefacts.push({
              name: String(defaultArt.type || 'Framework Document'), // 强制转换
              description: String(defaultArt.description || '').substring(
                0,
                100
              ), // 强制转换
            })
          }
          console.log('🔍 Framework artefacts debug:', {
            id: doc.id,
            title: data.title,
            additional_length: additional.length,
            preview_artefacts: preview_artefacts,
            first_preview: preview_artefacts[0],
          })
          return {
            id: doc.id,
            ...data,
            preview_artefacts, // ✅ 添加处理后的字段
          }
        })

        setFrameworks(frameworksList)
        setLoading(false)
        setError(null)
      },
      err => {
        console.error('Error fetching frameworks:', err)
        setError('Failed to load frameworks. Please try again.')
        setLoading(false)
      }
    )

    // 清理函数：组件卸载时取消监听
    return () => unsubscribe()
  }, [user])

  // 按 Family 分组
  const groupedFrameworks = frameworks.reduce((acc, framework) => {
    const family = framework.family || 'Other'
    if (!acc[family]) {
      acc[family] = []
    }
    acc[family].push(framework)
    return acc
  }, {})

  // 切换展开/收起
  const toggleFamily = family => {
    setExpandedFamilies(prev => ({
      ...prev,
      [family]: !prev[family],
    }))
  }

  // 默认展开所有分组（首次加载）
  useEffect(() => {
    if (frameworks.length > 0 && Object.keys(expandedFamilies).length === 0) {
      const initialExpanded = {}
      Object.keys(groupedFrameworks).forEach(family => {
        initialExpanded[family] = true
      })
      setExpandedFamilies(initialExpanded)
    }
  }, [frameworks, groupedFrameworks, expandedFamilies])

  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading your frameworks...</p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Frameworks
          </h1>
          <p className="text-gray-600">
            {frameworks.length === 0
              ? "You haven't created any frameworks yet."
              : `You have ${frameworks.length} framework${frameworks.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Empty State */}
        {frameworks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-24 w-24 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No frameworks yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first framework to get started
            </p>
            <button
              onClick={() => navigate('/create')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition shadow-lg"
            >
              Create Framework
            </button>
          </div>
        ) : (
          /* Frameworks List - Grouped by Family */
          <div className="space-y-6">
            {Object.entries(groupedFrameworks)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([family, familyFrameworks]) => (
                <div
                  key={family}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  {/* Family Header */}
                  <button
                    onClick={() => toggleFamily(family)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h2 className="text-xl font-semibold text-gray-900">
                          {family}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {familyFrameworks.length} framework
                          {familyFrameworks.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <svg
                      className={`w-6 h-6 text-gray-400 transition-transform ${
                        expandedFamilies[family] ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Frameworks in this Family */}
                  {expandedFamilies[family] && (
                    <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {familyFrameworks.map(framework => (
                        <FrameworkCard
                          key={framework.id}
                          framework={framework}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Floating Action Button - Create New Framework */}
        {frameworks.length > 0 && (
          <button
            onClick={() => navigate('/create')}
            className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-200 group"
            title="Create New Framework"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default YourFrameworks
