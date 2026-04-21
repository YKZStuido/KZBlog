# 亚の博客 · KZBlog

一个纯静态的个人博客：单文件 React 应用 + 浏览器内 Babel 实时编译 JSX，无构建步骤。

## 本地开发

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

仓库已经配置好 GitHub Actions 自动部署工作流（见 `.github/workflows/pages.yml`）。

### 首次启用（一次性）

1. 推送包含工作流文件的代码到 `main` 分支
2. 打开仓库 **Settings → Pages**
3. 在 **Build and deployment → Source** 选择 **GitHub Actions**
4. 回到 **Actions** 页面等待 `Deploy to GitHub Pages` 工作流跑完

### 日常发布

推送到 `main` 分支即自动发布。工作流会把整个仓库当作静态产物上传到 Pages。

### 访问地址

- 默认：`https://<你的账号>.github.io/KZBlog/`
- 自定义域名：在仓库根目录新建 `CNAME` 文件，内容为你的域名（如 `blog.example.com`），然后在 Pages 设置里同步绑定域名

### 为什么无需改动代码

- 所有 `fetch` 路径是相对路径（`./archive/...`），在子路径下也能正确解析
- 路由使用 URL `hash`（如 `#/post/p001`），服务端无需 404 回退
- 外部依赖（React / Babel / Google Fonts）均走 CDN 绝对 URL
- 根目录 `.nojekyll` 文件让 GitHub Pages 跳过 Jekyll 处理

## 许可

代码按 [LICENSE](./LICENSE) 授权；文章按 CC BY-NC 4.0 授权。
