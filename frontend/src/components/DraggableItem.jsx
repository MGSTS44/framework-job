import React from 'react'
import { useDraggable } from '@dnd-kit/core'

export default function DraggableItem({
  id,
  type, // 'description' | 'substep'
  content,
  frameworkId,
  index,
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: id,
    data: {
      type: type,
      content: content,
      frameworkId: frameworkId,
      index: index,
    },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group relative ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      {type === 'description' ? (
        <div className="relative">
          <div className="absolute -left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-4 h-4 text-purple-500"
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
          </div>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-200 cursor-move hover:border-purple-300 hover:bg-purple-50 transition-all">
            {content}
          </p>
        </div>
      ) : (
        <li className="text-sm text-gray-600 flex items-start gap-2 cursor-move hover:bg-blue-50 p-2 rounded transition-all group">
          <span className="text-blue-600 mt-1 opacity-100 group-hover:opacity-0 transition-opacity">
            •
          </span>
          <svg
            className="w-4 h-4 text-purple-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute"
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
          <span className="ml-6">{content}</span>
        </li>
      )}
    </div>
  )
}
