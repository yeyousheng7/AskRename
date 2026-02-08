import { useState } from 'react'
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

function App(): React.JSX.Element {
  const [instruction, setInstruction] = useState('')
  const [files] = useState(mockFiles)

  const handleRename = (): void => {
    console.log('开始重命名，指令:', instruction)
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-white dark:bg-neutral-900">
      {/* Pane Headers */}
      <div className="flex flex-shrink-0 border-b border-neutral-200 dark:border-neutral-700">
        {/* Left Header */}
        <div className="w-1/2 border-r border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-1.5">
          <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
            原始文本 (只读)
          </span>
        </div>
        {/* Right Header */}
        <div className="w-1/2 bg-neutral-100 dark:bg-neutral-800 px-4 py-1.5">
          <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
            预览文本
          </span>
        </div>
      </div>

      {/* Editor Area - 同步滚动的左右分栏 */}
      <ScrollArea className="flex-1">
        <div className="flex min-h-full">
          {/* Left Pane - 原始文本 (只读) */}
          <div className="w-1/2 border-r border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
            <div className="py-2">
              {files.map((file, index) => (
                <div key={file.id} className="flex h-6 items-center hover:bg-neutral-100 dark:hover:bg-neutral-800/50">
                  {/* 行号 */}
                  <span className="w-10 flex-shrink-0 pr-3 text-right font-mono text-xs text-neutral-300 dark:text-neutral-600 select-none">
                    {index + 1}
                  </span>
                  {/* 文件名 */}
                  <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
                    {file.original}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Pane - 预览文本 */}
          <div className="w-1/2 bg-white dark:bg-neutral-900">
            <div className="py-2">
              {files.map((file, index) => (
                <div key={file.id} className="flex h-6 items-center hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  {/* 行号 */}
                  <span className="w-10 flex-shrink-0 pr-3 text-right font-mono text-xs text-neutral-300 dark:text-neutral-600 select-none">
                    {index + 1}
                  </span>
                  {/* 文件名 */}
                  <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                    {file.renamed}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Bottom Footer - 输入区域 */}
      <footer className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-3">
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
