# Kimi Web Assistant

[![Build Extension](https://github.com/MuseLinn/kimi-web-assistant/actions/workflows/build.yml/badge.svg)](https://github.com/MuseLinn/kimi-web-assistant/actions/workflows/build.yml)

增强 [Kimi](https://kimi.com) 网页端的浏览器扩展，提供对话导航、LaTeX 复制、收藏管理等功能。

## 功能

- **收藏管理** — 在侧边栏和历史页面为对话注入星标按钮，支持收藏/取消收藏
- **LaTeX 复制** — 在数学公式旁显示一键复制 LaTeX 源码按钮
- **对话导航** — 右侧悬浮进度条，按用户/AI 分段，支持点击跳转
- **跨对话搜索** — 拦截 API 请求缓存对话内容，在 Popup 中实时搜索
- **液态玻璃 UI** — 采用 Liquid Glass 视觉风格，支持深色/浅色模式

## 安装

### 从源码加载（开发者）

1. 克隆仓库

   ```bash
   git clone https://github.com/MuseLinn/kimi-web-assistant.git
   cd kimi-web-assistant
   npm install
   npx wxt build
   ```

2. 打开 Chrome → `chrome://extensions/` → 开启「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择 `.output/chrome-mv3/` 文件夹

### 从 Release 安装

在 [Releases](https://github.com/MuseLinn/kimi-web-assistant/releases) 页面下载 `.zip` 文件，解压后按上述步骤加载。

## 开发

```bash
# 安装依赖
npm install

# 开发模式（带热重载）
npx wxt

# 生产构建
npx wxt build

# 打包为 zip
npx wxt zip
```

## 技术栈

- [WXT](https://wxt.dev/) — Chrome Extension 框架
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- Manifest V3

## 权限说明

| 权限               | 用途                     |
| ------------------ | ------------------------ |
| `storage`          | 本地保存收藏、缓存、设置 |
| `activeTab`        | 获取当前标签页信息       |
| `clipboardWrite`   | 复制 LaTeX 到剪贴板      |
| `scripting`        | 内容脚本注入             |
| `unlimitedStorage` | 缓存大量对话内容         |

所有数据保存在本地 `chrome.storage.local`，**不上传任何第三方服务器**。

## 兼容

- Chrome / Edge / 其他 Chromium 浏览器
- [kimi.moonshot.cn](https://kimi.moonshot.cn) / [kimi.com](https://kimi.com)

## 许可

MIT
