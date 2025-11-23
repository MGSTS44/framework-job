import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import LibraryCard from './LibraryCard'

/**
 * Library - 公共框架库页面
 *
 * Features:
 * - 显示所有 isPublic: true 的框架
 * - 按 category 分组
 * - 搜索和筛选功能
 * - 支持导出框架
 */
function Library() {
  const [frameworks, setFrameworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // 实时监听所有 public frameworks
  useEffect(() => {
    // 简化查询：只查询 isPublic，不排序
    // 排序在客户端进行，避免索引问题
    const q = query(collection(db, 'frameworks'), where('isPublic', '==', true))

    const unsubscribe = onSnapshot(
      q,
      querySnapshot => {
        const frameworksList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // 客户端排序：按 publishedAt 降序
        frameworksList.sort((a, b) => {
          const aTime = a.publishedAt?.toMillis?.() || 0
          const bTime = b.publishedAt?.toMillis?.() || 0
          return bTime - aTime
        })

        setFrameworks(frameworksList)
        setLoading(false)
        setError(null)
      },
      err => {
        console.error('Error fetching library frameworks:', err)
        setError('Failed to load library. Please try again.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // 筛选框架
  const filteredFrameworks = frameworks.filter(framework => {
    // Category 筛选
    if (selectedCategory !== 'All' && framework.category !== selectedCategory) {
      return false
    }

    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const titleMatch = framework.title?.toLowerCase().includes(query)
      const categoryMatch = framework.category?.toLowerCase().includes(query)
      const tagsMatch = framework.tags?.some(tag =>
        tag.toLowerCase().includes(query)
      )

      return titleMatch || categoryMatch || tagsMatch
    }

    return true
  })

  // 按 category 分组
  const groupedFrameworks = filteredFrameworks.reduce((acc, framework) => {
    const category = framework.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(framework)
    return acc
  }, {})

  // 计算每个分类的数量
  const categoryCounts = frameworks.reduce((acc, framework) => {
    const category = framework.category || 'Other'
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {})

  // 可用的分类
  const categories = [
    'All',
    'Technology',
    'Healthcare',
    'Research',
    'Financial',
    'Other',
  ]

  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading Framework Marketplace...</p>
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
            Marketplace
          </h1>
          <p className="text-gray-600">
            Discover and use expert-curated frameworks ({frameworks.length}{' '}
            available)
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-xl">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search frameworks by name, category, or tags..."
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-4 top-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto border-b border-gray-200 pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 font-medium whitespace-nowrap transition-colors rounded-t-lg ${
                selectedCategory === category
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {category}
              {category === 'All' ? (
                <span className="ml-2 text-sm text-gray-500">
                  ({frameworks.length})
                </span>
              ) : categoryCounts[category] ? (
                <span className="ml-2 text-sm text-gray-500">
                  ({categoryCounts[category]})
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredFrameworks.length === 0 ? (
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
              No frameworks found
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'No frameworks have been published to the library yet'}
            </p>
          </div>
        ) : (
          /* Frameworks Grid - Grouped by Category */
          <div className="space-y-8">
            {Object.entries(groupedFrameworks)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, categoryFrameworks]) => (
                <div key={category}>
                  {/* Category Header */}
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="flex items-center space-x-2">
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
                      <h2 className="text-xl font-semibold text-gray-900">
                        {category}
                      </h2>
                      <span className="text-sm text-gray-500">
                        ({categoryFrameworks.length})
                      </span>
                    </div>
                  </div>

                  {/* Frameworks Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryFrameworks.map(framework => (
                      <LibraryCard key={framework.id} framework={framework} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Library