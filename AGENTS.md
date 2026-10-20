# Seiton contributor guidance

Read [spec.md](spec.md) for product behavior, [DESIGN.md](DESIGN.md) for visual decisions, and [docs/data-guide.md](docs/data-guide.md) before working with Vault data.

## Workflow

Plan, build, and verify changes proportionately. Preserve unrelated work. Do not require a particular AI agent, editor, or external workflow plugin. Keep source, tests, and documentation aligned.

## Product and implementation boundaries

- Keep primary operations usable through the human interface. Store notes as ordinary Markdown and preserve unknown frontmatter fields.
- Keep Library and Bookshelf responsibilities separate. Optional features remain internal modules of one plugin.
- Use TypeScript, React, esbuild, Vitest, and the existing project tooling. Avoid adding runtime dependencies without a demonstrated need.
- Own UI components in `src/ui/` and reuse them in UI Lab. Keep Obsidian integration in `src/platform/obsidian/` and connection code in `src/app/`.
- Scope plugin styles to the Shadow DOM boundary. Use Obsidian theme variables and accessible keyboard, focus, error, and reduced-motion behavior.
- Use `requestUrl` (except the redirect-rejecting rich-card transport when a domain deny list is active), Obsidian `parseYaml`, and the repository's safe flow-YAML serializer, which preserves frontmatter key order. Use the injected Obsidian app; do not use a global `app`.
- Preserve compatibility for existing settings and Markdown. Include old keys, unknown keys, and incomplete frontmatter in relevant fixtures.
- Update all eight locale dictionaries when adding interface text.

## Verification

Run `npm run release:check` before a release. It includes Ultracite, tests, TypeScript, production and UI Lab builds, and release asset checks. Run `git diff --check` before committing.

For UI changes, verify relevant light/dark states at desktop and narrow widths in a real browser. Verify Obsidian integration in a disposable test Vault and record browser and native evidence separately. Build success alone does not establish native acceptance. Keep production Vaults intact.

## Data and publication safety

Never commit Vault notes, plugin settings, credentials, local paths, personal correspondence, or private review artifacts. Use synthetic fixtures. Preserve attribution and third-party license texts.

Propose data changes with a dry run, preserve unknown metadata and links, and prefer archiving to deletion. Use Obsidian's trash instead of permanent deletion. Do not send Vault contents or credentials to external services or logs.

Obtain explicit authorization before publishing a repository, release, or directory entry, or modifying a production Vault. Follow [the release checklist](docs/release-checklist.md).
