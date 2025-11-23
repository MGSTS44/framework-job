import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import PublishModal from './PublishModal'

function FrameworkCard({ framework, showCreator = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [showDropdown, setShowDropdown] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  const handleEdit = () => {
    navigate(`/${user.tenantId}/editor/${framework.id}`)
  }

  const handleDownload = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
      
      const response = await fetch(
        `${API_BASE_URL}/api/frameworks/export-docx`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(framework),
        }
      )

      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${framework.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      console.log('✅ Word document downloaded successfully')
    } catch (error) {
      console.error('Download failed:', error)
      alert('Failed to download framework')
    }
  }

  const formatDate = dateString => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handlePublish = () => {
    setShowPublishModal(true)
    setShowDropdown(false)
  }

  const handleUnpublish = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to unpublish this framework from the Library?'
    )

    if (!confirmed) return

    try {
      const frameworkRef = doc(db, 'frameworks', framework.id)
      await updateDoc(frameworkRef, {
        isPublic: false,
        updatedAt: serverTimestamp(),
      })
      console.log('✅ Framework unpublished from Library')
      setShowDropdown(false)
    } catch (error) {
      console.error('❌ Error unpublishing framework:', error)
      alert('Failed to unpublish framework')
    }
  }

  // ===== ✅ 修复：Publish to Organization =====
  const handlePublishToOrg = async () => {
    const confirmed = window.confirm(
      'Publish this framework to your organization? All members will be able to view it.'
    )

    if (!confirmed) return

    try {
      // ✅ 确定要发布到哪个organization
      // - 如果用户加入了organization，发布到该organization
      // - 否则发布到用户自己的tenant
      const targetOrganization = user.joinedOrganization || user.tenantId

      console.log(`📤 Publishing framework to organization: ${targetOrganization}`)

      const frameworkRef = doc(db, 'frameworks', framework.id)
      await updateDoc(frameworkRef, {
        organization: targetOrganization,     // ✅ 核心修复：设置organization字段
        publishedToOrganization: true,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      
      console.log('✅ Framework published to Organization')
      console.log(`   - Framework ID: ${framework.id}`)
      console.log(`   - Organization: ${targetOrganization}`)
      
      setShowDropdown(false)
    } catch (error) {
      console.error('❌ Error publishing to organization:', error)
      alert('Failed to publish to organization')
    }
  }

  // ===== ✅ 修复：Unpublish from Organization =====
  const handleUnpublishFromOrg = async () => {
    const confirmed = window.confirm(
      'Remove this framework from your organization? Members will no longer see it in shared frameworks.'
    )

    if (!confirmed) return

    try {
      console.log(`📥 Unpublishing framework from organization`)

      const frameworkRef = doc(db, 'frameworks', framework.id)
      await updateDoc(frameworkRef, {
        organization: user.tenantId,          // ✅ 恢复为用户自己的tenant
        publishedToOrganization: false,
        unpublishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      
      console.log('✅ Framework unpublished from Organization')
      console.log(`   - Framework ID: ${framework.id}`)
      console.log(`   - Restored to: ${user.tenantId}`)
      
      setShowDropdown(false)
    } catch (error) {
      console.error('❌ Error unpublishing from organization:', error)
      alert('Failed to unpublish from organization')
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${framework.title}"? This action cannot be undone.`
    )

    if (!confirmed) return

    setIsDeleting(true)

    try {
      await deleteDoc(doc(db, 'frameworks', framework.id))
      console.log('✅ Framework deleted:', framework.id)
    } catch (error) {
      console.error('❌ Error deleting framework:', error)
      alert('Failed to delete framework')
      setIsDeleting(false)
    }
  }

  const handleDuplicate = () => {
    alert('Duplicate feature - Coming soon!')
    setShowDropdown(false)
  }

  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right - 208 + window.scrollX,
      })
    }
  }

  const toggleDropdown = () => {
    if (!showDropdown) {
      updateDropdownPosition()
    }
    setShowDropdown(!showDropdown)
  }

  useEffect(() => {
    if (!showDropdown) return

    const handleUpdate = () => {
      updateDropdownPosition()
    }

    window.addEventListener('scroll', handleUpdate, true)
    window.addEventListener('resize', handleUpdate)

    return () => {
      window.removeEventListener('scroll', handleUpdate, true)
      window.removeEventListener('resize', handleUpdate)
    }
  }, [showDropdown])

  useEffect(() => {
    if (!showDropdown) return

    const handleClickOutside = event => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-200 p-6">
        {/* Header: Title + Confidence */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {framework.title}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {framework.family}
              </span>
              <span>•</span>
              <span>v{framework.version}</span>
              
              {framework.isPublic && (
                <>
                  <span>•</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                    Published
                  </span>
                </>
              )}
              
              {framework.publishedToOrganization && (
                <>
                  <span>•</span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                    Shared
                  </span>
                </>
              )}
            </div>
            
            {showCreator && framework.creatorId !== user?.uid && (
              <p className="text-xs text-gray-500 mt-1">
                by {framework.creatorEmail || framework.creatorName || 'Team Member'}
              </p>
            )}
          </div>

          {/* Confidence Score */}
          <div className="ml-4 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-green-600">
                {Math.round(framework.confidence)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 text-right mt-1">Confidence</p>
          </div>
        </div>

        {/* Artefacts Preview */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Key Artefacts
          </h4>
          <div className="space-y-2">
            {framework.preview_artefacts &&
            framework.preview_artefacts.length > 0 ? (
              framework.preview_artefacts.map((artefact, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded p-3 border border-gray-100"
                >
                  <div className="flex items-start">
                    <svg
                      className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {artefact.name}
                      </p>
                      {artefact.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {artefact.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">
                No artefacts defined
              </p>
            )}
          </div>
        </div>

        {/* Footer: Date + Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            <span>Created {formatDate(framework.created_at)}</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center space-x-1"
              title="Download as Markdown"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              <span>Download</span>
            </button>

            {/* Edit Button */}
            {framework.creatorId === user?.uid && (
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span>Edit</span>
              </button>
            )}

            {/* More Button */}
            {framework.creatorId === user?.uid && (
              <button
                ref={buttonRef}
                onClick={toggleDropdown}
                className="px-2 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                title="More options"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Portal Dropdown */}
      {showDropdown &&
        createPortal(
          <div
            ref={dropdownRef}
            className="w-60 bg-white rounded-lg shadow-2xl border border-gray-200 py-1"
            style={{
              position: 'absolute',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              zIndex: 9999,
            }}
          >
            {/* Publish/Unpublish to Library */}
            {framework.isPublic ? (
              <button
                onClick={handleUnpublish}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
                <span>Unpublish from Library</span>
              </button>
            ) : (
              <button
                onClick={handlePublish}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                  />
                </svg>
                <span>Publish to Library</span>
              </button>
            )}

            {/* Publish/Unpublish to Organization */}
            {framework.publishedToOrganization ? (
              <button
                onClick={handleUnpublishFromOrg}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
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
                <span>Unpublish from Organization</span>
              </button>
            ) : (
              <button
                onClick={handlePublishToOrg}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
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
                <span>Publish to Organization</span>
              </button>
            )}

            {/* Duplicate */}
            <button
              onClick={handleDuplicate}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Duplicate</span>
            </button>

            {/* Divider */}
            <div className="border-t border-gray-100 my-1"></div>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>,
          document.body
        )}

      {/* Publish Modal */}
      {showPublishModal && (
        <PublishModal
          framework={framework}
          onClose={() => setShowPublishModal(false)}
          onSuccess={() => {
            console.log('Framework published successfully')
          }}
        />
      )}
    </>
  )
}

export default FrameworkCard