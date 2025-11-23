import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function SortableSubStep({
  id,
  content,
  frameworkId,
  index,
  isOver,
  overId,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: id,
    data: {
      type: 'substep',
      content: content,
      frameworkId: frameworkId,
      index: index,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // 判断是否应该显示插入指示器
  const showInsertIndicator = isOver && overId === id && !isDragging

  return (
    <>
      {/* 插入指示器 - 显示在当前项之前 */}
      {showInsertIndicator && (
        <div className="h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full my-1 animate-pulse shadow-lg" />
      )}

      <li
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`text-sm text-gray-600 flex items-start gap-2 cursor-move hover:bg-blue-50 p-2 rounded transition-all group ${
          isDragging ? 'opacity-30 scale-95' : 'opacity-100'
        }`}
      >
        {/* Drag Handle Icon */}
        <svg
          className="w-4 h-4 text-gray-400 group-hover:text-purple-500 mt-1 flex-shrink-0 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
          />
        </svg>

        {/* Content */}
        <span className="flex-1">{content}</span>

        {/* Bullet point for visual feedback */}
        <span className="text-blue-600 text-lg leading-none">•</span>
      </li>
    </>
  )
}
