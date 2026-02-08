import { useState, useMemo, useCallback, useRef, DragEvent, KeyboardEvent } from 'react'
import { diffChars } from 'diff'
import TextareaAutosize from 'react-textarea-autosize'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SparklesIcon, UploadIcon } from 'lucide-react'

// Electron 扩展的 File 类型（包含 path 属性）
interface ElectronFile extends File {
  path: string
}

// 文件数据类型
interface FileItem {
  id: string
  original: string
  renamed: string
  path: string
}

// Diff 渲染组件 - 左侧显示删除部分
function DiffRemovedText({ original, renamed }: { original: string; renamed: string }) {
  const parts = useMemo(() => diffChars(original, renamed), [original, renamed])

  return (
    <span className="font-mono text-sm leading-6">
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

// 空状态组件
function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-slate-400 dark:text-slate-500">
        <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-6">
          <UploadIcon className="h-12 w-12" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
            拖入文件以开始重命名
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            支持批量拖入多个文件
          </p>
        </div>
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [instruction, setInstruction] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([])

  const handleRename = (): void => {
    console.log('开始重命名，指令:', instruction)
  }

  // 处理单个文件名的编辑
  const handleFileRename = useCallback((id: string, newName: string) => {
    setFiles(prev => prev.map(file =>
      file.id === id ? { ...file, renamed: newName } : file
    ))
  }, [])

  // 处理键盘导航 - 上下方向键跳转
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const textarea = e.currentTarget
    const { selectionStart, selectionEnd, value } = textarea

    // 确保没有选中文本
    if (selectionStart !== selectionEnd) return

    if (e.key === 'ArrowUp') {
      // 检查光标是否在第一行
      const textBeforeCursor = value.substring(0, selectionStart)
      const isFirstLine = !textBeforeCursor.includes('\n')

      if (isFirstLine && index > 0) {
        e.preventDefault()
        const prevTextarea = textareaRefs.current[index - 1]
        if (prevTextarea) {
          prevTextarea.focus()
          // 将光标移到末尾
          prevTextarea.selectionStart = prevTextarea.value.length
          prevTextarea.selectionEnd = prevTextarea.value.length
        }
      }
    } else if (e.key === 'ArrowDown') {
      // 检查光标是否在最后一行
      const textAfterCursor = value.substring(selectionStart)
      const isLastLine = !textAfterCursor.includes('\n')

      if (isLastLine && index < files.length - 1) {
        e.preventDefault()
        const nextTextarea = textareaRefs.current[index + 1]
        if (nextTextarea) {
          nextTextarea.focus()
          // 将光标移到开头
          nextTextarea.selectionStart = 0
          nextTextarea.selectionEnd = 0
        }
      }
    }
  }, [files.length])

  // 处理文件拖入
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)

    // 过滤掉文件夹，只接受文件
    const newFiles: FileItem[] = droppedFiles
      .filter(file => file.size > 0) // 文件夹 size 为 0
      .map(file => {
        const electronFile = file as ElectronFile
        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          original: file.name,
          renamed: file.name, // 初始时预览和原始相同
          path: electronFile.path || file.name,
        }
      })

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles])
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const isEmpty = files.length === 0

  return (
    <div
      className={`flex h-screen w-screen flex-col bg-white dark:bg-slate-950 transition-colors ${isDragging ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
        }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* 拖拽遮罩层 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-lg m-2">
          <div className="flex flex-col items-center gap-3 text-blue-500">
            <UploadIcon className="h-16 w-16" />
            <p className="text-xl font-medium">释放以添加文件</p>
          </div>
        </div>
      )}

      {/* Header - Grid 布局标题 */}
      <div className="flex-shrink-0 grid grid-cols-[3rem_1fr_3rem_1fr] border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        {/* 左行号区标题 */}
        <div className="h-8 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800" />
        {/* 左原名区标题 */}
        <div className="flex h-8 items-center border-r border-slate-200 dark:border-slate-700 px-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            原始文本
          </span>
          {!isEmpty && (
            <span className="ml-2 font-mono text-xs text-slate-400 dark:text-slate-500">
              ({files.length})
            </span>
          )}
        </div>
        {/* 右行号区标题 */}
        <div className="h-8 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800" />
        {/* 右编辑区标题 */}
        <div className="flex h-8 items-center px-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            预览文本
          </span>
        </div>
      </div>

      {/* Editor Area 或 Empty State */}
      {isEmpty ? (
        <EmptyState />
      ) : (
        <ScrollArea className="flex-1">
          <div className="min-h-full">
            {files.map((file, index) => (
              <div
                key={file.id}
                className={`grid grid-cols-[3rem_1fr_3rem_1fr] border-b border-slate-100 dark:border-slate-800 transition-colors ${hoveredLine === index
                  ? 'bg-blue-50/80 dark:bg-blue-900/20'
                  : ''
                  }`}
                onMouseEnter={() => setHoveredLine(index)}
                onMouseLeave={() => setHoveredLine(null)}
              >
                {/* 左行号 */}
                <div className="flex items-start justify-end border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pr-3 py-1.5">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500 select-none leading-6">
                    {index + 1}
                  </span>
                </div>

                {/* 左原名 (只读) */}
                <div className="border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-1.5">
                  <DiffRemovedText original={file.original} renamed={file.renamed} />
                </div>

                {/* 右行号 */}
                <div className="flex items-start justify-end border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pr-3 py-1.5">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500 select-none leading-6">
                    {index + 1}
                  </span>
                </div>

                {/* 右编辑区 (可编辑 Textarea) */}
                <div className="px-3 py-1.5 bg-white dark:bg-slate-950">
                  <TextareaAutosize
                    ref={(el) => { textareaRefs.current[index] = el }}
                    value={file.renamed}
                    onChange={(e) => handleFileRename(file.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="w-full bg-transparent resize-none focus:outline-none font-mono text-sm leading-6 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                    minRows={1}
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Bottom Footer - 浮动操作台 */}
      <footer className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-3">
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="输入重命名指令，例如：将所有图片按日期命名..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="flex-1 h-9 font-mono text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-blue-400 focus:ring-blue-400/20"
            disabled={isEmpty}
          />
          <Button
            onClick={handleRename}
            size="default"
            className="h-9 px-5 text-sm font-medium"
            disabled={isEmpty}
          >
            <SparklesIcon className="mr-2 h-4 w-4" />
            开始重命名
          </Button>
        </div>
      </footer>
    </div>
  )
}

export default App
