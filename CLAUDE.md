# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供操作此仓库的指导。

## 开发服务器

使用 Python 本地运行（file:// 会有 fetch CORS 问题）：

```
python serve.py        # 端口 8000
python serve.py 3000   # 自定义端口
```

无需构建步骤。JSX 由浏览器内的 Babel 即时编译，修改文件后刷新即可。

## 添加文章

1. 创建 `archive/posts/p{num}.md`（三位零填充编号，例如 `p003.md`）
2. 将 ID 添加到 `archive/index.json` 的 `posts` 数组开头（最新在前）

### 文章 frontmatter

```yaml
---
num: "003"        # 与文件名对应
title: 文章标题
excerpt: 一行摘要，显示在归档/卡片中
date: 2026-04-19  # YYYY-MM-DD
read: 5           # 预估阅读时间（分钟）
tags: [tag1, tag2]
lede: 显示在文章顶部的提示文字  # 可选
featured: true    # 可选，在首页特色位置展示
pinned: true      # 可选，置顶显示在归档页
---
```

## 架构

- 单文件 React 应用（`blog.jsx`）——无外部状态库或路由器
- 哈希路由：`#/`、`#/archive`、`#/about`、`#/post/{id}`
- 自定义 Markdown 解析器内置于 `blog.jsx`——不要替换为第三方库
- 站点配置和文章列表存放于 `archive/index.json`
- 部署目标：个人/VPS 服务器
