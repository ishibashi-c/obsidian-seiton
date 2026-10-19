# Seiton

[English](README.md) · [日本語](README-ja.md) · [Deutsch](README-de.md) · [Español](README-es.md) · [Français](README-fr.md) · [한국어](README-ko.md) · [Português](README-pt_BR.md) · [简体中文](README-zh_cn.md)

Capture first. Find and use it when you need it.

Seiton is an Obsidian plugin for keeping notes, references, tasks, and reading records in one Markdown-based Vault. You do not have to decide on a folder or tags while capturing: leave an item in the inbox, then find and organize it later.

> The screenshots and GIF use synthetic demo notes. Seiton is not currently listed in Obsidian Community Plugins.

![Seiton workflow: capture, browse, and organize](docs/images/readme/workflow.gif)

## Install the development build

Requires Obsidian 1.13.7 or later. Building from source also requires Git, Node.js, and npm. Community Plugins installation is not available yet.

1. Get the source and build it:

   ```sh
   git clone https://github.com/ishibashi-c/obsidian-seiton.git
   cd obsidian-seiton
   npm ci
   npm run build
   ```

2. Create `<Vault>/.obsidian/plugins/seiton/` and copy `main.js`, `manifest.json`, and `styles.css` from the repository into it.
3. Reload Obsidian, then enable Seiton under **Settings → Community plugins**. Follow onboarding to choose your language, enabled types, and optional modules.

## Capture, find, and organize

1. Capture a quick thought or create a structured note from Home.
2. Leave items you cannot classify yet in the inbox. Choosing a type, folder, or tags can wait.
3. Search Seiton notes and configured additional folders, or browse the Library by content, folder, type, tag, and list.
4. When useful, organize an item in Seiton: change its folder, type, tags, or lists, or move it to the archive.

### Choose the modules you need

Home, Search, Library, inbox organization, and archive handling support the main capture-and-reuse workflow. Optional modules—such as Bookshelf, memo reflection, rich cards, and the editor toolbar—can be enabled or disabled in Settings.

<details>
<summary>View Home, Library, and organization screenshots</summary>

![Home with quick capture and main entry points](docs/images/readme/home.png)

![Library with folder, type, and list filters](docs/images/readme/library.png)

![Inbox organization with editable metadata](docs/images/readme/organize.png)

</details>

## Your notes and network access

Notes remain ordinary Markdown files in your Vault. Seiton preserves unknown frontmatter fields, and local notes remain usable without network access. Search, capture, and organization do not require AI.

### Optional external AI tools

Seiton does not include or call an AI model. If you use an external AI tool, it can prepare a Markdown organization proposal for Seiton to display. Review the proposed moves and metadata in the app, then choose which changes to apply. The plugin does not send Vault content to an AI service.

### When Seiton uses the network

Seiton has no hosted account, analytics, telemetry, advertising, or embedded LLM. Network requests are limited to explicit or enabled features such as web-clip metadata, book lookup, and optional Japanese library search. See [privacy and network behavior](docs/privacy-and-network.md) for destinations and data details. Do not save URLs containing private tokens as web clips.

Remote services are used as follows: the saved web page and its declared image hosts provide web-clip metadata and images; Google’s favicon service provides fallback domain icons; openBD and Open Library provide ISBN metadata and covers, and Open Library also provides title/author search.

Library holdings search through Calil and municipality/address lookup through the Geospatial Information Authority of Japan (GSI) are available only in the Japanese UI and are intended for libraries in Japan. Calil requires your own API key. Switching to another UI language hides these library features; the Bookshelf and book metadata search remain available.

## Development

| Command | Purpose |
|---|---|
| `npm test` | Run tests |
| `npm run build` | Check types and build the plugin |
| `npm run harness` | Open UI Lab |
| `npm run lint` | Run lint checks |
| `npm run release:check` | Run tests, both builds, and release asset checks |

[Product specification](spec.md) · [Implementation roadmap](docs/implementation-roadmap.md) · [UI Lab routes and fixtures](docs/ui-mock-map.md) · [Release checklist](docs/release-checklist.md) · [Development contract](AGENTS.md)

## License and data sources

MIT © 2026 IshibashiCustomize. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md). Book data and cover sources: [openBD](https://openbd.jp/) and [Open Library](https://openlibrary.org/developers/api).
