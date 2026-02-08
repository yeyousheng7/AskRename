import { useState, useMemo } from 'react'
import { diffChars } from 'diff'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SparklesIcon } from 'lucide-react'

// Mock data - 占位符数据
const mockFiles = [
  { id: 1, original: 'IMG_20240315_142536.jpg', renamed: 'vacation_beach_sunset.jpg' },
  { id: 2, original: 'DSC_0001.png', renamed: 'family_portrait_2024.png' },
  { id: 3, original: 'screenshot_2024-03-10.png', renamed: 'app_dashboard_design.png' },
  { id: 4, original: 'document (1).pdf', renamed: 'contract_agreement_v1.pdf' },
  { id: 5, original: 'VID_20240320_183022.mp4', renamed: 'birthday_party_celebration.mp4' },
  { id: 6, original: 'IMG_20240316_091234.jpg', renamed: 'morning_coffee_routine.jpg' },
  { id: 7, original: 'DSC_0002.png', renamed: 'sunset_mountain_view.png' },
  { id: 8, original: 'notes_final_v3.txt', renamed: 'meeting_notes_march.txt' },
  { id: 9, original: 'backup_20240301.zip', renamed: 'project_backup_march.zip' },
  { id: 10, original: 'report.docx', renamed: 'quarterly_report_q1.docx' },
]

// Diff 渲染组件 - 左侧显示删除部分
function DiffRemovedText({ original, renamed }: { original: string; renamed: string }) {
  const parts = useMemo(() => diffChars(original, renamed), [original, renamed])

  return (
    <span className="font-mono text-sm">
      {parts.map((part, index) => {
        if (part.added) {
          return null // 不在左侧显示新增部分
        }
        if (part.removed) {
          return (
            <span
              key={index}
              className="bg-red-100 text-red-700 line-through dark:bg-red-900/30 dark:text-red-400"
            >
              {part.value}
            </span>
          )
        }
        return (
          <span key={index} className="text-neutral-600 dark:text-neutral-400">
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
          return null // 不在右侧显示删除部分
        }
        if (part.added) {
          return (
            <span
              key={index}
              className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            >
              {part.value}
            </span>
          )
        }
        return (
          <span key={index} className="text-neutral-900 dark:text-neutral-100">
            {part.value}
          </span>
        )
      })}
    </span>
  )
}

function App(): React.JSX.Element {
  const [instruction, setInstruction] = useState('')
  const [files] = useState(mockFiles)
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)

  const handleRename = (): void => {
    console.log('开始重命名，指令:', instruction)
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-white dark:bg-neutral-900">
      {/* Pane Headers */}
      <div className="flex flex-shrink-0 border-b border-neutral-200 dark:border-neutral-700">
        {/* Left Header */}
        <div className="w-1/2 border-r border-neutral-200 dark:border-neutral-700 bg-slate-100 dark:bg-slate-800 px-4 py-1.5">
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            原始文本 (只读)
          </span>
        </div>
        {/* Right Header */}
        <div className="w-1/2 bg-slate-100 dark:bg-slate-800 px-4 py-1.5">
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            预览文本
          </span>
        </div>
      </div>

      {/* Editor Area - 同步滚动的左右分栏 */}
      <ScrollArea className="flex-1">
        <div className="flex min-h-full">
          {/* Left Pane - 原始文本 (只读) */}
          <div className="w-1/2 border-r border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
            <div className="py-1">
              {files.map((file, index) => (
                <div
                  key={file.id}
                  className={`flex h-7 items-center transition-colors ${hoveredLine === index
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                    }`}
                  onMouseEnter={() => setHoveredLine(index)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {/* 行号区域 (Gutter) */}
                  <div className="w-12 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 pr-3 h-full flex items-center justify-end">
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
          <div className="w-1/2 bg-white dark:bg-neutral-900">
            <div className="py-1">
              {files.map((file, index) => (
                <div
                  key={file.id}
                  className={`flex h-7 items-center transition-colors ${hoveredLine === index
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30'
                    }`}
                  onMouseEnter={() => setHoveredLine(index)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {/* 行号区域 (Gutter) */}
                  <div className="w-12 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 pr-3 h-full flex items-center justify-end">
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

      {/* Bottom Footer - 输入区域 */}
      <footer className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-slate-800 p-3">
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="输入重命名指令，例如：将所有图片按日期命名..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="flex-1 h-9 font-mono text-sm bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600"
          />
          <Button
            onClick={handleRename}
            size="default"
            className="h-9 px-5 text-sm font-medium"
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
