# 本博客的双仓工作流

代码仓：`Alex-Shen1121/Shirone-Alex`。内容仓：`Alex-Shen1121/Shirone-Content`，作为独立私有仓库维护，不再同步原内容仓上游。网站地址为 `https://blog.codingshen.top/`。

## 文件归属

| 修改内容 | 编辑位置 |
| --- | --- |
| 文章、动态、系列、关于页面 | 内容仓 `content/` |
| 友链、项目、设备、游戏等数据 | 内容仓 `data/` |
| 头像、横幅、游戏封面 | 内容仓 `assets/` |
| 相册、原图、站点图标 | 内容仓 `public/` |
| 站点身份、个人资料、其他个人覆盖 | 内容仓 `config/*.yaml` |
| 页面、组件、样式、构建工具和默认配置 | 代码仓 `src/`、`scripts/` |

代码仓里的文章与媒体是同步副本，已停止 Git 跟踪。请直接编辑内容仓；在代码仓修改同步副本后再次同步，改动可能被覆盖或裁剪。

本次迁移保留原有内容和配置值。`config/site.yaml` 与 `config/profile.yaml` 保存站点身份，其他设置按需添加最小覆盖，不复制整套主题默认配置。

## 本地开发

将两个仓库放在相邻目录。在代码仓未提交的 `.env` 中设置：

```dotenv
CONTENT_DIR="../Shirone-Content"
```

在代码仓运行：

```bash
pnpm content:validate
pnpm content:sync
pnpm dev
```

持续写作时，另开一个终端运行 `pnpm content:watch`。提交文章时进入内容仓，提交主题代码时留在代码仓。

## Vercel 连接

Vercel 关联代码仓，构建命令为 `pnpm build`，输出目录为 `dist`。

- 使用 Node.js 24，并设置 `ENABLE_EXPERIMENTAL_COREPACK=1`，让 Vercel 按 `package.json` 中的 `packageManager` 安装 pnpm，避免覆盖安装命令时落到旧版 pnpm。
- 构建默认读取根目录 `shirone.content.json` 中的远端内容源；本地 `.env` 不提交，也不上传到 Vercel。
- Vercel 不应设置指向本机路径的 `CONTENT_DIR`。
- 构建通过 SSH 的 443 端口读取私有内容仓。内容仓登记只读部署公钥，私钥以 `CONTENT_REPO_SSH_KEY` 保存到 Vercel 的生产、预览环境以及代码仓的 GitHub Actions Secret。
- 私钥只用于构建期拉取内容；脚本将其写入权限为 `0600` 的临时文件，并在 Git 命令结束后清理。SSH 使用仓库内的 GitHub 官方主机公钥校验，不关闭主机验证。
- 推送代码仓 `main` 会自动发布生产版本；其他代码分支用于预览，默认读取内容仓 `main`。
- 内容仓的工作流会调用代码仓现有的内容校验流程。校验通过后，只有 `main` 分支会调用 `VERCEL_DEPLOY_HOOK`。
- `VERCEL_DEPLOY_HOOK` 存放在内容仓的 GitHub Actions Secret 中。未配置时工作流会明确提示未部署。
- 部署钩子只请求一次新构建，不代表部署已经成功。简单钩子方案读取构建时的内容分支；精确重建历史发布时，应使用具体的 `CONTENT_REPO_REF` 提交号。

构建生成的 `content.lock.json` 记录实际使用的内容提交号，可用于发布追溯。代码预览分支默认继续搭配内容仓 `main`，需要预览其他内容分支时显式设置 `CONTENT_REPO_REF`。

## 发布前检查

依次运行 `pnpm content:validate`、`pnpm content:sync`、`pnpm check`、`pnpm type-check`、`pnpm check:manifest` 和 `pnpm build`。内容同步测试与这些检查串行运行，避免测试夹具修改生成配置时相互干扰。

归档页仅向浏览器传递展示所需字段；生产构建会移除相册源配置 `images/albums/*/info.json`。文章和图片仍按主题的发布规则生成静态网站，私有仓库不等于网站访问控制。不要提交服务凭据；此前已经公开的 Git 历史也不会因仓库改为私有而从他人的副本中消失。
