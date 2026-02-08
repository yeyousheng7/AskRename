import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { diffChars } from 'diff'
import TextareaAutosize from 'react-textarea-autosize'
import type { FileItem } from '@/hooks/useFileStore'

const textStyles = 'font-mono text-sm leading-6'

function DiffRemovedText({ original, renamed }: { original: string; renamed: string }): React.JSX.Element {
  const parts = useMemo(() => diffChars(original, renamed), [original, renamed])

  return (
    <span className={textStyles}>
      {parts.map((part, index) => {
        if (part.added) {
          return null
        }
        if (part.removed) {
          return (
            <span
              key={index}
              className="bg-red-50 text-red-600 line-through decoration-red-300 dark:bg-red-950/30 dark:text-red-400"
            >
              {part.value}
            </span>
          )
        }
        return (
          <span key={index} className="text-slate-600 dark:text-slate-400">
            {part.value}
          </span>
        )
      })}
    </span>
  )
}

function DiffAddedText({
  original,
  renamed,
  onClick
}: {
  original: string
  renamed: string
  onClick: () => void
}): React.JSX.Element {
  const parts = useMemo(() => diffChars(original, renamed), [original, renamed])

  return (
    <div
      className={`${textStyles} min-h-6 cursor-text text-slate-800 dark:text-slate-200`}
      onClick={onClick}
    >
      {parts.map((part, index) => {
        if (part.removed) {
          return null
        }
        if (part.added) {
          return (
            <span
              key={index}
              className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
            >
              {part.value}
            </span>
          )
        }
        return <span key={index}>{part.value}</span>
      })}
      {renamed.length === 0 && (
        <span className="text-slate-300 dark:text-slate-600 italic">鐐瑰嚮缂栬緫...</span>
      )}
    </div>
  )
}

export type EditorRowProps = {
  file: FileItem
  index: number
  filesLength: number
  editingIndex: number | null
  setEditingIndex: (next: number | null) => void
  onRename: (id: string, newName: string) => void
}

export default function EditorRow({
  file,
  index,
  filesLength,
  editingIndex,
  setEditingIndex,
  onRename
}: EditorRowProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false)

  const stopEditing = useCallback(() => {
    setEditingIndex(null)
  }, [setEditingIndex])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget
      const { selectionStart, selectionEnd, value } = textarea

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        stopEditing()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        stopEditing()
        return
      }

      if (selectionStart !== selectionEnd) return

      if (e.key === 'ArrowUp') {
        const textBeforeCursor = value.substring(0, selectionStart)
        const isFirstLine = !textBeforeCursor.includes('\n')

        if (isFirstLine && index > 0) {
          e.preventDefault()
          setEditingIndex(index - 1)
        }
      } else if (e.key === 'ArrowDown') {
        const textAfterCursor = value.substring(selectionStart)
        const isLastLine = !textAfterCursor.includes('\n')

        if (isLastLine && index < filesLength - 1) {
          e.preventDefault()
          setEditingIndex(index + 1)
        }
      }
    },
    [filesLength, index, setEditingIndex, stopEditing]
  )

  return (
    <div
      className={`grid grid-cols-[3rem_1fr_3rem_1fr] border-b border-slate-100 dark:border-slate-800 transition-colors ${isHovered ? 'bg-blue-50/80 dark:bg-blue-900/20' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-end border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pr-3 py-1.5">
        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 select-none leading-6">
          {index + 1}
        </span>
      </div>

      <div className="border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-1.5">
        <DiffRemovedText original={file.original} renamed={file.renamed} />
      </div>

      <div className="flex items-start justify-end border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pr-3 py-1.5">
        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 select-none leading-6">
          {index + 1}
        </span>
      </div>

      <div className="px-3 py-1.5 bg-white dark:bg-slate-950">
        {editingIndex === index ? (
          <TextareaAutosize
            value={file.renamed}
            onChange={(e) => onRename(file.id, e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={stopEditing}
            autoFocus
            className={`w-full bg-transparent resize-none focus:outline-none ${textStyles} text-slate-800 dark:text-slate-200`}
            minRows={1}
          />
        ) : (
          <DiffAddedText
            original={file.original}
            renamed={file.renamed}
            onClick={() => setEditingIndex(index)}
          />
        )}
      </div>
    </div>
  )
}
