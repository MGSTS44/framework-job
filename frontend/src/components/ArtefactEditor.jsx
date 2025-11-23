import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { useState, useEffect, useCallback } from 'react'
import API_ENDPOINTS from '../lib/api'

// Toolbar Button Component
const ToolbarButton = ({ onClick, isActive, disabled, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded hover:bg-gray-200 transition-colors ${
      isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
)

// Toolbar Divider
const ToolbarDivider = () => <div className="w-px h-6 bg-gray-300 mx-1" />

// Main Toolbar Component
const EditorToolbar = ({ editor }) => {
  if (!editor) return null

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
      .run()
  }

  const setLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-t border-gray-200 rounded-b-lg">
      {/* Table */}
      <ToolbarButton onClick={addTable} title="Insert Table">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <span className="font-bold text-sm">B</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <span className="italic text-sm">I</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <span className="underline text-sm">U</span>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <span className="text-sm font-semibold">H1</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <span className="text-sm font-semibold">H2</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <span className="text-sm font-semibold">H3</span>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h10M3 8h.01M3 12h.01M3 16h.01" />
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      {/* Link */}
      <ToolbarButton
        onClick={setLink}
        isActive={editor.isActive('link')}
        title="Insert Link"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </ToolbarButton>

      {editor.isActive('link') && (
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          title="Remove Link"
        >
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </ToolbarButton>
      )}

      <ToolbarDivider />

      {/* Table Controls (only show when in table) */}
      {editor.isActive('table') && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add Row"
          >
            <span className="text-xs">+ Row</span>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add Column"
          >
            <span className="text-xs">+ Col</span>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete Row"
          >
            <span className="text-xs text-red-500">- Row</span>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete Column"
          >
            <span className="text-xs text-red-500">- Col</span>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete Table"
          >
            <span className="text-xs text-red-500">Delete Table</span>
          </ToolbarButton>
        </>
      )}

      {/* Color Picker */}
      <div className="relative ml-auto">
        <input
          type="color"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          className="w-8 h-8 rounded cursor-pointer border border-gray-300"
          title="Text Color"
        />
      </div>
    </div>
  )
}

// Convert artefact variant data to HTML for editor
export const convertVariantToHTML = (variant) => {
  if (!variant) return '<p></p>'

  let html = ''

  // Summary Section
  html += '<h2>Summary</h2>'
  html += `<p>${variant.summary || 'Enter summary here...'}</p>`
  html += '<hr>'

  // When to Use Section
  html += '<h2>When to Use</h2>'
  if (Array.isArray(variant.when_to_use) && variant.when_to_use.length > 0) {
    html += '<ul>'
    variant.when_to_use.forEach(item => {
      html += `<li>${item}</li>`
    })
    html += '</ul>'
  } else {
    html += '<ul><li>Enter use case here...</li></ul>'
  }
  html += '<hr>'

  // Outline Sections as Table
  html += '<h2>Outline Sections</h2>'
  const sections = Array.isArray(variant.sections) ? variant.sections : []
  
  if (sections.length > 0) {
    html += '<table><thead><tr><th>Section</th><th>Content</th></tr></thead><tbody>'
    sections.forEach((section, index) => {
      const heading = section.heading || `Section ${index + 1}`
      const body = section.body || 'Enter content...'
      html += `<tr><td>${index + 1}. ${heading}</td><td>${body}</td></tr>`
    })
    html += '</tbody></table>'
  } else {
    html += '<table><thead><tr><th>Section</th><th>Content</th></tr></thead><tbody>'
    html += '<tr><td>1. Introduction</td><td>Enter content...</td></tr>'
    html += '<tr><td>2. Main Content</td><td>Enter content...</td></tr>'
    html += '</tbody></table>'
  }

  return html
}

// Parse HTML back to structured data (for saving)
export const parseHTMLToVariant = (html, originalVariant) => {
  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Extract sections based on h2 headers
  const result = {
    ...originalVariant,
    _htmlContent: html, // Store raw HTML for flexibility
  }

  // Try to extract summary (content after first h2 "Summary" and before hr)
  const summaryH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
    h.textContent.toLowerCase().includes('summary')
  )
  if (summaryH2) {
    let summaryText = ''
    let sibling = summaryH2.nextElementSibling
    while (sibling && sibling.tagName !== 'HR' && sibling.tagName !== 'H2') {
      summaryText += sibling.textContent + ' '
      sibling = sibling.nextElementSibling
    }
    result.summary = summaryText.trim()
  }

  // Try to extract when_to_use (list items after "When to Use" h2)
  const whenToUseH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
    h.textContent.toLowerCase().includes('when to use')
  )
  if (whenToUseH2) {
    const ul = whenToUseH2.nextElementSibling
    if (ul && ul.tagName === 'UL') {
      const items = Array.from(ul.querySelectorAll('li')).map(li => li.textContent.trim())
      result.when_to_use = items
    }
  }

  // Try to extract sections from table
  const table = doc.querySelector('table')
  if (table) {
    const rows = Array.from(table.querySelectorAll('tbody tr'))
    const sections = rows.map((row, index) => {
      const cells = row.querySelectorAll('td')
      const headingText = cells[0]?.textContent?.trim() || `Section ${index + 1}`
      // Remove numbering prefix like "1. " from heading
      const heading = headingText.replace(/^\d+\.\s*/, '')
      const body = cells[1]?.textContent?.trim() || ''
      return { heading, body }
    })
    result.sections = sections
  }

  return result
}

// Main ArtefactEditor Component
const ArtefactEditor = ({ variant, index, onUpdate, onDelete, canDelete = true }) => {
  const [isAIFilling, setIsAIFilling] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300 w-full',
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2 bg-gray-100 font-semibold',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Underline,
      TextStyle,
      Color,
    ],
    content: convertVariantToHTML(variant),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const updatedVariant = parseHTMLToVariant(html, variant)
      onUpdate(index, updatedVariant)
    },
  })

  // Update editor content when variant changes externally (e.g., after regenerate)
  useEffect(() => {
    if (editor && variant) {
      const currentHTML = editor.getHTML()
      const newHTML = convertVariantToHTML(variant)
      // Only update if content is significantly different
      if (currentHTML.length < 50 || !variant._htmlContent) {
        editor.commands.setContent(newHTML)
      }
    }
  }, [variant?.name, variant?.summary]) // Only trigger on major changes

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${variant?.name || 'this artefact'}"?`)) {
      onDelete(index)
    }
  }

  // AI Fill - Fill empty content cells with AI generated content
  const handleAIFill = async () => {
    if (!editor) return

    // Parse current editor content to find empty sections
    const html = editor.getHTML()
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const table = doc.querySelector('table')

    if (!table) {
      alert('No table found. Please add a table with sections first.')
      return
    }

    // Extract sections with empty content
    const rows = Array.from(table.querySelectorAll('tbody tr'))
    const sectionsToFill = []
    const allSections = []

    rows.forEach((row, idx) => {
      const cells = row.querySelectorAll('td')
      const sectionName = cells[0]?.textContent?.trim() || ''
      const content = cells[1]?.textContent?.trim() || ''
      
      allSections.push({ heading: sectionName, body: content, index: idx })
      
      if (sectionName && !content) {
        sectionsToFill.push({ heading: sectionName, index: idx })
      }
    })

    if (sectionsToFill.length === 0) {
      alert('No empty sections found. All sections already have content.')
      return
    }

    // Validate section names - warn if too short
    const shortSections = sectionsToFill.filter(s => s.heading.length < 5 || /^\d+$/.test(s.heading))
    if (shortSections.length > 0) {
      const proceed = window.confirm(
        `⚠️ Warning: Some section names are too short or generic (${shortSections.map(s => `"${s.heading}"`).join(', ')}).\n\n` +
        `AI works best with descriptive names like:\n` +
        `- "Risk Assessment"\n` +
        `- "Implementation Steps"\n` +
        `- "Compliance Requirements"\n\n` +
        `Do you want to continue anyway? The AI will try its best, but results may be generic.`
      )
      if (!proceed) return
    }

    setIsAIFilling(true)

    try {
      // Call AI Fill API
      const response = await fetch(API_ENDPOINTS.AI_FILL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artefact_name: variant?.name || 'Artefact',
          artefact_summary: variant?.summary || '',
          existing_sections: allSections.filter(s => s.body).map(s => ({
            heading: s.heading,
            body: s.body,
          })),
          sections_to_fill: sectionsToFill.map(s => s.heading),
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success && result.filled_sections) {
        // Update the table with filled content
        const filledMap = {}
        result.filled_sections.forEach(section => {
          filledMap[section.heading] = section.body
        })

        // Update each empty row with the filled content
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td')
          const sectionName = cells[0]?.textContent?.trim() || ''
          
          if (filledMap[sectionName] && cells[1]) {
            cells[1].textContent = filledMap[sectionName]
          }
        })

        // Update editor with new HTML
        const updatedHTML = doc.body.innerHTML
        editor.commands.setContent(updatedHTML)

        // Trigger update
        const updatedVariant = parseHTMLToVariant(updatedHTML, variant)
        onUpdate(index, updatedVariant)

        alert(`✨ AI filled ${result.filled_sections.length} section(s) successfully!`)
      } else {
        throw new Error(result.error || 'AI Fill failed')
      }
    } catch (error) {
      console.error('❌ AI Fill failed:', error)
      alert(`Failed to fill sections: ${error.message}`)
    } finally {
      setIsAIFilling(false)
    }
  }

  if (!editor) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 bg-white animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📋</span>
            <h3 className="font-semibold text-gray-800">
              ARTEFACT {index + 1}: {variant?.name || 'Untitled'}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            {/* AI Fill Button */}
            <button
              onClick={handleAIFill}
              disabled={isAIFilling}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center space-x-1 ${
                isAIFilling
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
              title="Use AI to fill empty content cells"
            >
              {isAIFilling ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Filling...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>AI Fill</span>
                </>
              )}
            </button>
            
            {/* Delete Button */}
            {canDelete && onDelete && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete this artefact"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="editor-wrapper">
        <EditorContent editor={editor} />
      </div>

      {/* Toolbar at Bottom */}
      <EditorToolbar editor={editor} />
    </div>
  )
}

export default ArtefactEditor