import { useState, useMemo, useCallback, DragEvent } from 'react'
import { diffChars } from 'diff'
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
    <span className="font-mono text-sm">
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

// Diff 渲染组件 - 右侧显示新增部分
function DiffAddedText({ original, renamed }: { original: string; renamed: string }) {
  const parts = useMemo(() => diffChars(original, renamed), [original, renamed])

  return (
    <span className="font-mono text-sm">
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
        return (
          <span key={index} className="text-slate-800 dark:text-slate-200">
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

  const handleRename = (): void => {
    console.log('开始重命名，指令:', instruction)
  }

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
    // 只有真正离开容器时才取消高亮
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

      {/* Pane Headers - 精致的标题栏 */}
      <div className="flex flex-shrink-0">
        {/* Left Header */}
        <div className="flex h-8 w-1/2 items-center border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            原始文本
          </span>
          {!isEmpty && (
            <span className="ml-2 font-mono text-xs text-slate-400 dark:text-slate-500">
              ({files.length} 个文件)
            </span>
          )}
        </div>
        {/* Right Header */}
        <div className="flex h-8 w-1/2 items-center border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4">
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
          <div className="flex min-h-full">
            {/* Left Pane - 原始文本 (只读) */}
            <div className="w-1/2 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="py-0.5">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    className={`flex h-7 items-center transition-colors ${hoveredLine === index
                      ? 'bg-blue-50/80 dark:bg-blue-900/20'
                      : ''
                      }`}
                    onMouseEnter={() => setHoveredLine(index)}
                    onMouseLeave={() => setHoveredLine(null)}
                  >
                    {/* 行号区域 (Gutter) */}
                    <div className="w-12 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 h-full flex items-center justify-end pr-3">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 select-none">
                        {index + 1}
                      </span>
                    </div>
                    {/* 文件名 - Diff 删除高亮 */}
                    <div className="pl-3 pr-2 min-w-0 flex-1">
                      <DiffRemovedText original={file.original} renamed={file.renamed} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Pane - 预览文本 */}
            <div className="w-1/2 bg-white dark:bg-slate-950">
              <div className="py-0.5">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    className={`flex h-7 items-center transition-colors ${hoveredLine === index
                      ? 'bg-blue-50/80 dark:bg-blue-900/20'
                      : ''
                      }`}
                    onMouseEnter={() => setHoveredLine(index)}
                    onMouseLeave={() => setHoveredLine(null)}
                  >
                    {/* 行号区域 (Gutter) */}
                    <div className="w-12 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 h-full flex items-center justify-end pr-3">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 select-none">
                        {index + 1}
                      </span>
                    </div>
                    {/* 文件名 - Diff 新增高亮 */}
                    <div className="pl-3 pr-2 min-w-0 flex-1">
                      <DiffAddedText original={file.original} renamed={file.renamed} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
