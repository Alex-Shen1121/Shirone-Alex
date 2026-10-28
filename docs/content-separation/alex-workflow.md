# 本博客的双仓工作流

代码仓：`Alex-Shen1121/Shirone-Alex`。内容仓：`Alex-Shen1121/Shirone-Content`，是 `LyraVoid/Shirone-Content` 的公开 Fork。

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

- 构建默认读取根目录 `shirone.content.json` 中的远端内容源；本地 `.env` 不提交，也不上传到 Vercel。
- Vercel 不应设置指向本机路径的 `CONTENT_DIR`。
- 内容仓公开，构建时通过 HTTPS 读取，不需要额外的 GitHub 读取令牌。
- 内容仓的工作流会调用代码仓现有的内容校验流程。校验通过后，只有 `main` 分支会调用 `VERCEL_DEPLOY_HOOK`。
- `VERCEL_DEPLOY_HOOK` 存放在内容仓的 GitHub Actions Secret 中。未配置时工作流会明确提示未部署。
- 部署钩子只请求一次新构建，不代表部署已经成功。简单钩子方案读取构建时的内容分支；精确重建历史发布时，应使用具体的 `CONTENT_REPO_REF` 提交号。

构建生成的 `content.lock.json` 记录实际使用的内容提交号，可用于发布追溯。代码预览分支默认继续搭配内容仓 `main`，需要预览其他内容分支时显式设置 `CONTENT_REPO_REF`。

## 发布前检查

依次运行 `pnpm content:validate`、`pnpm content:sync`、`pnpm check`、`pnpm type-check`、`pnpm check:manifest` 和 `pnpm build`。内容同步测试与这些检查串行运行，避免测试夹具修改生成配置时相互干扰。

内容仓为公开 Fork，文章源文件、草稿和配置都可以公开读取。不要在其中保存私密原文或服务凭据；此前发现的文章归档参数、相册原始配置泄露也未包含在本次迁移修复中。
