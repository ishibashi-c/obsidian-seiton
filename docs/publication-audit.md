# Publication audit — 2026-10-20

## Scope

The initial public source snapshot includes plugin source, synthetic tests and UI Lab fixtures, build tooling, eight READMEs, product and data documentation, demo images, and license notices. Plugin source is unchanged from the accepted candidate.

The snapshot excludes private Git history, internal development discussions and delegation records, review screenshots, local workspace settings, Vault notes, plugin settings, caches, and the unfinished standalone theme. The public repository begins with a new Git history and a GitHub noreply commit identity.

## Privacy review

Text checks covered local home paths, personal-name identifiers, personal email addresses, common credential formats, and links to the private source repository. No matches remained in the publication set. URLs in source and fixtures were reviewed by destination; runtime destinations are described in [privacy and network behavior](privacy-and-network.md). Settings and API keys are supplied by each user. The library-error fixture uses generic Tokyo example coordinates rather than a maintainer-specific region.

The three README screenshots and all three GIF frames were inspected visually. They show synthetic demo content. Public author identity and required copyright and third-party notices are retained.

Pattern checks and visual inspection reduce disclosure risk; they are not a guarantee that arbitrary sensitive data can be detected automatically.

## Verification

- Clean dependency installation passed with the committed lockfile and `.npmrc`. The setting retains the tested dependency graph despite the SDK's exact CodeMirror peer declarations.
- `npm run release:check` passed: Ultracite, 41 test files / 338 tests, TypeScript, production build, UI Lab build, and release metadata and full license checks.
- All 180 relative document links resolved.
- Japanese README passed the existing Japanese prose check with no findings.
- The rebuilt `main.js`, `manifest.json`, and `styles.css` are byte-for-byte identical to the accepted candidate.
- Native Obsidian 1.14.4: installed these three assets in a clean disposable Vault; completed onboarding; opened Home; saved a synthetic memo; found it through full-text search. Saved Markdown and installed asset hashes were also checked.
- No runtime or visual behavior changed during migration. Earlier visual acceptance is not represented as a new full UI review. Physical-phone UX and live external-service calls were not rechecked.
- UI Lab reported existing Vite deprecation, mixed import, and large chunk warnings; builds passed.

## Release asset SHA-256

| Asset | SHA-256 |
|---|---|
| `main.js` | `91d25c3e1e4d8800409cc758ee7162217ad3b3f31ef2054a48dd0a25a6e6151f` |
| `manifest.json` | `ca651c101b477d8eaf9bb408dbbf0704a77c57f2ffbbc0d7523c3e8fe494f784` |
| `styles.css` | `8af1c424f06be92db980273739ec1170bdbf8568a4cbdfb555cd08efd9a68a84` |

GitHub publication and Community directory submission are separate steps. The maintainer handles Community submission.
