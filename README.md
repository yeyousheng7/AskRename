# AskRename

AskRename 是一款 AI 驱动的智能文件重命名工具，主打自然语言指令，拒绝复杂正则。

## 下载安装

请前往仓库右侧 **Releases** 页面下载对应安装包（Windows / macOS）。

> [!NOTE]
> 由于应用尚未签名，安装或首次启动时可能出现系统安全拦截，请选择“仍要运行”继续。

## 技术栈

基于当前代码与依赖：

- Electron 39
- React 19
- TypeScript 5
- Tailwind CSS 4
- Vite 7
- electron-vite
- electron-builder

## 本地开发

### 启动开发环境

```bash
npm ci
npm run dev
```

### 构建

```bash
# 前端与 Electron 代码编译（不打包安装包）
npm run build

# 本地打包
npm run build:win
npm run build:mac
npm run build:linux
```
