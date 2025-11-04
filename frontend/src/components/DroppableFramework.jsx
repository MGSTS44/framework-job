import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import DraggableItem from './DraggableItem'
import SortableSubStep from './SortableSubStep'

export default function DroppableFramework({
  framework,
  index,
  isNewFramework = false,
  onUpdateName,
  activeId,
  overId,
}) {
  // 为整个框架创建 droppable（但只用于 Description）
  const { setNodeRef: setFrameworkRef, isOver: isFrameworkOver } = useDroppable(
    {
      id: `framework-${framework.id}`,
      data: {
        type: 'framework',
        frameworkId: framework.id,
        acceptTypes: ['description'], // 只接受 Description
      },
    }
  )

  // 为 sub-steps 区域创建单独的 droppable
  const { setNodeRef: setSubStepsRef, isOver: isSubStepsOver } = useDroppable({
    id: `substeps-${framework.id}`,
    data: {
      type: 'substeps-area',
      frameworkId: framework.id,
      acceptTypes: ['substep'], // 只接受 Sub-steps
    },
  })

  // 为 sub-steps 创建唯一的 ID 列表
  const subStepIds = framework.subSteps
    ? framework.subSteps.map((_, idx) => `substep-${framework.id}-${idx}`)
    : []

  // 判断当前是否正在拖拽 description
  const isDraggingDescription =
    activeId && activeId.toString().startsWith('desc-')

  // 判断当前是否正在拖拽 substep
  const isDraggingSubstep =
    activeId && activeId.toString().startsWith('substep-')

  return (
    <div
      className={`bg-white border rounded-lg p-6 shadow-sm transition-all min-h-[200px] ${
        isNewFramework
          ? 'border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50'
          : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {isNewFramework ? (
          <input
            type="text"
            value={framework.name}
            onChange={e => onUpdateName && onUpdateName(e.target.value)}
            className="flex-1 text-lg font-semibold border-b-2 border-blue-300 bg-transparent focus:outline-none focus:border-blue-600 px-2 py-1"
            placeholder="New Framework"
          />
        ) : (
          <h3 className="text-lg font-semibold text-gray-900">
            {framework.name || `Step ${index + 1}`}
          </h3>
        )}

        {!isNewFramework && (
          <span className="text-sm text-gray-500">Framework {index + 1}</span>
        )}
      </div>

      {/* Description Area - 单独的 droppable */}
      <div
        ref={setFrameworkRef}
        className={`mb-4 transition-all ${
          isDraggingDescription && isFrameworkOver
            ? 'bg-purple-50 border-2 border-purple-300 rounded-lg p-2'
            : ''
        }`}
      >
        {framework.description ? (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              Description:
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                Draggable
              </span>
            </p>
            <DraggableItem
              id={`desc-${framework.id}`}
              type="description"
              content={framework.description}
              frameworkId={framework.id}
            />
          </div>
        ) : isDraggingDescription && isFrameworkOver ? (
          <div className="p-4 border-2 border-dashed border-purple-400 rounded-lg bg-purple-100 text-center animate-pulse">
            <p className="text-sm font-medium text-purple-700">
              💧 Drop description here
            </p>
          </div>
        ) : null}
      </div>

      {/* Sub-steps Area - 移除外部高亮 */}
      {framework.subSteps && framework.subSteps.length > 0 ? (
        <div ref={setSubStepsRef}>
          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            Sub-steps:
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
              Sortable & Draggable
            </span>
          </p>

          <SortableContext
            items={subStepIds}
            strategy={verticalListSortingStrategy}
          >
            {/* ✅ 只在空的时候显示提示 */}
            {isDraggingSubstep &&
              isSubStepsOver &&
              framework.subSteps.length === 0 && (
                <div className="p-3 mb-2 border-2 border-dashed border-blue-400 rounded-lg bg-blue-50 text-center">
                  <p className="text-xs text-blue-600">Drop here</p>
                </div>
              )}

            <ul className="space-y-1 bg-gray-50 rounded-lg p-2 border border-gray-200">
              {framework.subSteps.map((step, idx) => (
                <SortableSubStep
                  key={`substep-${framework.id}-${idx}`}
                  id={`substep-${framework.id}-${idx}`}
                  content={step}
                  frameworkId={framework.id}
                  index={idx}
                  isOver={isSubStepsOver}
                  overId={overId}
                />
              ))}
            </ul>
          </SortableContext>
        </div>
      ) : isDraggingSubstep && isSubStepsOver ? (
        <div
          ref={setSubStepsRef}
          className="p-4 border-2 border-dashed border-blue-400 rounded-lg bg-blue-100 text-center"
        >
          <p className="text-sm font-medium text-blue-700">
            💧 Drop sub-step here
          </p>
        </div>
      ) : null}

      {/* Empty State */}
      {!framework.description &&
        (!framework.subSteps || framework.subSteps.length === 0) && (
          <div className="text-center py-8 text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="text-sm font-medium">Empty Framework</p>
            <p className="text-xs mt-1">Drop items here to add content</p>
          </div>
        )}
    </div>
  )
}
