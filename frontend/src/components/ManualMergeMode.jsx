import React, { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import DroppableFramework from './DroppableFramework'
import DescriptionMergeDialog from './DescriptionMergeDialog'

export default function ManualMergeMode({ frameworks, onExit, onSave }) {
  const [workingFrameworks, setWorkingFrameworks] = useState([])
  const [newFramework, setNewFramework] = useState(null)
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false)
  const [pendingDescriptionDrop, setPendingDescriptionDrop] = useState(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [activeId, setActiveId] = useState(null)

  // 初始化工作副本
  useEffect(() => {
    setWorkingFrameworks(JSON.parse(JSON.stringify(frameworks)))
  }, [frameworks])

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  )

  // Handle drag cancellation (e.g., ESC key or dropping outside valid area)
  const handleDragCancel = () => {
    console.log('⏪ Drag cancelled - element stays in place')
    setActiveId(null)
    setOverId(null)
  }

  // 创建新的空 Framework
  const handleCreateNewFramework = () => {
    setNewFramework({
      id: `new-fw-${Date.now()}`,
      name: 'New Framework',
      type: 'framework',
      source: 'custom',
      description: '',
      subSteps: [],
      isNew: true,
    })
  }

  // 更新新框架的名称
  const handleUpdateNewFrameworkName = name => {
    setNewFramework({ ...newFramework, name })
  }

  // 删除新框架
  const handleDeleteNewFramework = () => {
    setNewFramework(null)
  }

  // 拖拽开始
  const handleDragStart = event => {
    setActiveId(event.active.id)
  }

  // ✅ 新增：追踪拖拽经过的区域
  const [, setOverId] = useState(null)

  const handleDragOver = event => {
    setOverId(event.over?.id || null)
  }

  // 拖拽结束
  const handleDragEnd = event => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    // If user didn't drop on a valid target, just return (element stays in original position)
    if (!over) {
      console.log('⏪ Drag cancelled - element stays in place')
      return
    }

    const draggedData = active.data.current
    const overData = over.data.current

    // ✅ Case 1: Reordering sub-steps within same framework
    if (
      draggedData.type === 'substep' &&
      overData?.type === 'substep' &&
      draggedData.frameworkId === overData.frameworkId
    ) {
      handleSubStepReorder(
        draggedData.frameworkId,
        draggedData.index,
        overData.index
      )
      return
    }

    // ✅ Case 2: Dragging to another framework
    // Handle new droppable ID format (framework-xxx or substeps-xxx)
    let targetFrameworkId = overData?.frameworkId || over.id

    // If format is framework-xxx, extract actual framework ID
    if (typeof targetFrameworkId === 'string') {
      if (targetFrameworkId.startsWith('framework-')) {
        targetFrameworkId = targetFrameworkId.replace('framework-', '')
      } else if (targetFrameworkId.startsWith('substeps-')) {
        targetFrameworkId = targetFrameworkId.replace('substeps-', '')
      }
    }

    // If dropped on same framework (but not reordering), don't process
    if (
      draggedData.frameworkId === targetFrameworkId &&
      draggedData.type !== 'substep'
    ) {
      return
    }

    if (draggedData.type === 'description') {
      handleDescriptionDrop(
        targetFrameworkId,
        draggedData.content,
        draggedData.frameworkId
      )
    } else if (draggedData.type === 'substep') {
      // Dragging to another framework's sub-steps list
      const insertIndex =
        overData?.type === 'substep' ? overData.index : undefined
      handleSubStepDrop(
        targetFrameworkId,
        draggedData.content,
        draggedData.frameworkId,
        draggedData.index,
        insertIndex
      )
    }
  }

  // 新增：处理 Sub-step 在同一框架内重新排序
  const handleSubStepReorder = (frameworkId, oldIndex, newIndex) => {
    if (frameworkId === newFramework?.id) {
      setNewFramework({
        ...newFramework,
        subSteps: arrayMove(newFramework.subSteps, oldIndex, newIndex),
      })
    } else {
      setWorkingFrameworks(prev =>
        prev.map(fw =>
          fw.id === frameworkId
            ? { ...fw, subSteps: arrayMove(fw.subSteps, oldIndex, newIndex) }
            : fw
        )
      )
    }
  }

  // 处理 Description 拖拽
  const handleDescriptionDrop = (targetId, description, sourceId) => {
    const targetFramework =
      targetId === newFramework?.id
        ? newFramework
        : workingFrameworks.find(fw => fw.id === targetId)

    // 如果目标已有 Description，弹窗询问
    if (targetFramework?.description) {
      setPendingDescriptionDrop({ targetId, description, sourceId })
      setShowDescriptionDialog(true)
    } else {
      // 直接设置
      applyDescriptionDrop(targetId, description, sourceId, 'replace')
    }
  }

  // 应用 Description 拖拽（Replace 或 Append）
  const applyDescriptionDrop = (targetId, description, sourceId, action) => {
    if (targetId === newFramework?.id) {
      setNewFramework({
        ...newFramework,
        description:
          action === 'replace'
            ? description
            : `${newFramework.description}\n\n${description}`,
      })
    } else {
      setWorkingFrameworks(prev =>
        prev.map(fw =>
          fw.id === targetId
            ? {
                ...fw,
                description:
                  action === 'replace'
                    ? description
                    : `${fw.description}\n\n${description}`,
              }
            : fw
        )
      )
    }

    // 从源框架移除
    removeFromSource(sourceId, 'description', description)
  }

  // 处理 Sub-step 拖拽到其他框架（支持指定位置插入）
  const handleSubStepDrop = (
    targetId,
    subStep,
    sourceId,
    sourceIndex,
    insertIndex
  ) => {
    if (targetId === newFramework?.id) {
      const newSteps = [...(newFramework.subSteps || [])]

      // 如果指定了插入位置，插入到该位置；否则添加到末尾
      if (insertIndex !== undefined) {
        newSteps.splice(insertIndex, 0, subStep)
      } else {
        newSteps.push(subStep)
      }

      setNewFramework({
        ...newFramework,
        subSteps: newSteps,
      })
    } else {
      setWorkingFrameworks(prev =>
        prev.map(fw => {
          if (fw.id !== targetId) return fw

          const newSteps = [...(fw.subSteps || [])]

          // 如果指定了插入位置，插入到该位置；否则添加到末尾
          if (insertIndex !== undefined) {
            newSteps.splice(insertIndex, 0, subStep)
          } else {
            newSteps.push(subStep)
          }

          return { ...fw, subSteps: newSteps }
        })
      )
    }

    // 从源框架移除
    removeFromSource(sourceId, 'substep', subStep, sourceIndex)
  }

  // 从源框架移除项目
  const removeFromSource = (sourceId, type, value, index) => {
    if (sourceId === newFramework?.id) {
      if (type === 'description') {
        setNewFramework({ ...newFramework, description: '' })
      } else if (type === 'substep') {
        setNewFramework({
          ...newFramework,
          subSteps: newFramework.subSteps.filter((_, idx) => idx !== index),
        })
      }
    } else {
      setWorkingFrameworks(prev =>
        prev.map(fw => {
          if (fw.id !== sourceId) return fw

          if (type === 'description') {
            return { ...fw, description: '' }
          } else if (type === 'substep') {
            return {
              ...fw,
              subSteps: fw.subSteps.filter((_, idx) => idx !== index),
            }
          }
          return fw
        })
      )
    }

    // 检查是否变空并自动删除
    checkAndRemoveEmpty(sourceId)
  }

  // 检查并删除空框架
  const checkAndRemoveEmpty = frameworkId => {
    setTimeout(() => {
      setWorkingFrameworks(prev =>
        prev.filter(fw => {
          if (fw.id !== frameworkId) return true

          // 检查是否完全为空
          const isEmpty =
            (!fw.description || fw.description.trim() === '') &&
            (!fw.subSteps || fw.subSteps.length === 0)

          return !isEmpty
        })
      )
    }, 300)
  }

  // 处理 Done 按钮
  const handleDone = () => {
    setShowConfirmDialog(true)
  }

  // 确认保存
  const handleConfirmSave = () => {
    const finalFrameworks = [...workingFrameworks]
    if (
      newFramework &&
      (newFramework.description ||
        (newFramework.subSteps && newFramework.subSteps.length > 0))
    ) {
      finalFrameworks.push(newFramework)
    }

    onSave(finalFrameworks)
    setShowConfirmDialog(false)
    onExit()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                Manual Merge Mode
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Drag items between frameworks to merge them. Empty frameworks
                will be automatically removed.
              </p>
            </div>

            <button
              onClick={onExit}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Exit Merge Mode
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full flex gap-6">
            {/* Left: Existing Frameworks */}
            <div
              className={`${newFramework ? 'w-[60%]' : 'w-full'} overflow-y-auto pr-4`}
            >
              <div className="space-y-4">
                {workingFrameworks.map((framework, index) => (
                  <DroppableFramework
                    key={framework.id}
                    framework={framework}
                    index={index}
                    onUpdateName={null}
                    activeId={activeId} // ← 添加
                    overId={activeId} // ← 添加（暂时用 activeId）
                  />
                ))}
              </div>
            </div>

            {/* Right: New Framework */}
            {newFramework && (
              <div className="w-[40%]">
                <div className="sticky top-6">
                  <div className="relative">
                    <button
                      onClick={handleDeleteNewFramework}
                      className="absolute -right-2 -top-2 z-10 w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <svg
                        className="w-5 h-5 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                    <DroppableFramework
                      framework={newFramework}
                      index={-1}
                      isNewFramework={true}
                      onUpdateName={handleUpdateNewFrameworkName}
                      activeId={activeId} // ← 添加
                      overId={activeId} // ← 添加
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleCreateNewFramework}
            disabled={newFramework !== null}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              newFramework
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            <svg
              className="w-5 h-5"
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
            Create New Framework
          </button>

          <div className="flex gap-4">
            <button
              onClick={onExit}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDone}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-md"
            >
              Done - Save Changes
            </button>
          </div>
        </div>

        {/* Description Merge Dialog */}
        <DescriptionMergeDialog
          isOpen={showDescriptionDialog}
          onClose={() => {
            setShowDescriptionDialog(false)
            setPendingDescriptionDrop(null)
          }}
          onConfirm={action => {
            if (pendingDescriptionDrop) {
              applyDescriptionDrop(
                pendingDescriptionDrop.targetId,
                pendingDescriptionDrop.description,
                pendingDescriptionDrop.sourceId,
                action
              )
            }
            setShowDescriptionDialog(false)
            setPendingDescriptionDrop(null)
          }}
          currentDescription={
            pendingDescriptionDrop?.targetId === newFramework?.id
              ? newFramework?.description
              : workingFrameworks.find(
                  fw => fw.id === pendingDescriptionDrop?.targetId
                )?.description
          }
          newDescription={pendingDescriptionDrop?.description}
        />

        {/* Confirm Save Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Save Changes?
              </h3>
              <p className="text-gray-600 mb-6">
                You have {workingFrameworks.length + (newFramework ? 1 : 0)}{' '}
                framework(s). Original count was {frameworks.length}. This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId ? (
          <div className="bg-purple-100 border-2 border-purple-500 rounded-lg p-3 shadow-xl">
            <p className="text-sm font-medium text-purple-900">Dragging...</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}