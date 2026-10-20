# Seiton

[English](README.md) · [日本語](README-ja.md) · [Deutsch](README-de.md) · [Español](README-es.md) · [Français](README-fr.md) · [한국어](README-ko.md) · [Português](README-pt_BR.md) · [简体中文](README-zh_cn.md)

先记录，需要时再查找和使用。

Seiton 是一款用于在 Markdown Vault 中保存笔记、资料、任务和阅读记录的 Obsidian 插件。保存时无需立即决定文件夹或标签：先放入收件箱，之后再查找和整理。

> 截图和 GIF 使用虚构的示例笔记。Seiton 目前尚未列入 Obsidian 社区插件目录。

![Seiton 流程：记录、浏览和整理](docs/images/readme/workflow.gif)

## 安装开发版

需要 Obsidian 1.13.7 或更高版本。从源码构建还需要 Git、Node.js 和 npm。目前尚不支持从社区插件目录安装。

1. 获取源码并构建：

   ```sh
   git clone https://github.com/ishibashi-c/obsidian-seiton.git
   cd obsidian-seiton
   npm ci
   npm run build
   ```

2. 创建 `<Vault>/.obsidian/plugins/seiton/`，将仓库中的 `main.js`、`manifest.json` 和 `styles.css` 复制到该目录。
3. 重新加载 Obsidian，在“设置 → 社区插件”中启用 Seiton。首次设置时选择语言、启用的类型和可选模块。

## 记录、查找和整理

1. 在主页记录简短想法，或创建结构化笔记。
2. 暂时无法分类的内容可以留在收件箱中。类型、文件夹和标签以后再决定。
3. 搜索 Seiton 笔记和已配置的其他文件夹，或在资料库中按文件夹、类型、标签和列表查找。
4. 需要时更改笔记的文件夹或元数据，也可以将其移入归档。

### 选择需要的可选模块

主页、搜索、资料库、收件箱整理和归档共同支持主要流程。书架、备忘回顾、富卡片和编辑器工具栏等可选模块可以在设置中启用或关闭。

<details>
<summary>查看主页、资料库和整理界面截图</summary>

![包含快速记录和主要入口的主页](docs/images/readme/home.png)

![可按文件夹、类型和列表筛选的资料库](docs/images/readme/library.png)

![可编辑元数据的收件箱整理界面](docs/images/readme/organize.png)

</details>

## 笔记保存与网络访问

笔记仍是 Vault 中的普通 Markdown 文件。Seiton 保留未知的 frontmatter 字段；没有网络时，本地笔记仍可使用。记录、搜索和整理都不需要 AI。

### 可选的外部 AI 工具

Seiton 不内置或调用 AI 模型，也不会将 Vault 内容发送给 AI 服务。如果使用外部 AI 工具，它可以生成 Markdown 整理方案。你可以在 Seiton 中检查建议的移动位置和元数据，再选择要应用的更改。

### 使用网络的功能

Seiton 不提供托管账户、分析、遥测、广告或内置 LLM。网络请求仅用于明确启用或使用的功能，例如网页剪藏元数据、图书检索和可选的日本图书馆查询。目的地和数据详情请参阅[隐私与网络行为](docs/privacy-and-network.md)。不要将包含私密令牌的 URL 保存为网页剪藏。

网页剪藏从已保存的网页及其指定的图片服务器获取元数据和图片；Google 的 favicon 服务提供备用域名图标。openBD 和 Open Library 提供 ISBN 书目数据和封面，Open Library 也提供书名和作者搜索。

### 丰富卡片的域名限制

你可以在设置中逐个添加或删除屏蔽域名。设置屏蔽域名后，自动获取卡片和标题时会使用拒绝重定向的浏览器传输方式。遇到重定向或 CORS 无法访问响应时，卡片会退回为仅显示 URL。笔记和已保存的 URL 仍可使用。无法安全获取的图片和远程 favicon 会被省略；本地缓存图片会根据当前设置进行检查。设置变更后，已有卡片也会更新。未设置屏蔽域名时，仍使用 Obsidian 的常规传输方式。

Calil 馆藏查询和日本国土地理院（GSI）的市区町村、地址搜索仅在日语界面中提供，面向日本境内的图书馆。Calil 需要用户自己的 API 密钥。切换到其他界面语言后，这些图书馆功能会隐藏；书架和图书搜索仍可使用。

## 开发

| 命令 | 用途 |
|---|---|
| `npm test` | 运行测试 |
| `npm run build` | 检查类型并构建插件 |
| `npm run harness` | 启动 UI Lab |
| `npm run lint` | 运行 lint 检查 |
| `npm run release:check` | 运行测试、两种构建和发布文件检查 |

[产品规格](spec.md) · [实现路线图](docs/implementation-roadmap.md) · [UI Lab 路由与测试数据](docs/ui-mock-map.md) · [发布检查清单](docs/release-checklist.md) · [开发规范](AGENTS.md)

## 许可与数据来源

MIT © 2026 IshibashiCustomize。请参阅 [LICENSE](LICENSE) 和[第三方声明](THIRD_PARTY_NOTICES.md)。图书数据与封面来源：[openBD](https://openbd.jp/) 和 [Open Library](https://openlibrary.org/developers/api)。
