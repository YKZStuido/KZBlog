# 亚の博客 · KZBlog

一个纯静态的个人博客：单文件 React 应用 + 浏览器内 Babel 实时编译 JSX，无构建步骤。

## 本地开发

克隆代码，然后执行：
```bash
python serve.py        # 默认端口 8000
python serve.py 3000   # 自定义端口
```

然后浏览 <http://127.0.0.1:8000/>。由于 `fetch` 会在 `file://` 下触发 CORS 错误，**不能**直接双击 `index.html` 打开。

## 添加文章

详见 [CLAUDE.md](./CLAUDE.md)。简要来说：

1. 在 `archive/posts/` 新建 `p{num}.md`（三位零填充编号）
2. 在 `archive/index.json` 的 `posts` 数组**开头**添加该 ID（最新在前）

## 部署到 GitHub Pages

仓库已经配置好 GitHub Actions 自动部署工作流（见 `.github/workflows/pages.yml`），地址：https://ykzstuido.github.io/KZBlog。

### 为什么无需改动代码

- 所有 `fetch` 路径是相对路径（`./archive/...`），在子路径下也能正确解析
- 路由使用 URL `hash`（如 `#/post/p001`），服务端无需 404 回退
- 外部依赖（React / Babel / Google Fonts）均走 CDN 绝对 URL
- 根目录 `.nojekyll` 文件让 GitHub Pages 跳过 Jekyll 处理

## 许可

代码按 [LICENSE](./LICENSE) 授权；文章按 CC BY-NC 4.0 授权。