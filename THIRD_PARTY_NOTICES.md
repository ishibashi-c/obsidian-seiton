# Third-party notices

Seiton is distributed under the MIT License. Its runtime dependencies include
[React](https://react.dev/) and
[date-fns](https://github.com/date-fns/date-fns), both distributed under the MIT License.
The React notice also covers React DOM and Scheduler. Their license is included at
`third_party/react/LICENSE`; date-fns is at `third_party/date-fns/LICENSE`.
The production `main.js` embeds these licenses and the three adapted-source licenses
in full, so the notices remain available when only the plugin assets are installed.
Development dependencies and their resolved versions are listed in `package-lock.json`.

The cover-image cache behavior in `src/platform/obsidian/bookStore.ts` is adapted from
[easy-Obookshelf](https://github.com/CocoaAI-IT/easy-obookshelf),
Copyright (c) 2026 cocoa, used under the MIT License. The upstream license is
included at `third_party/easy-obookshelf/LICENSE`. Seiton retains attribution and
implements the behavior independently within its own data model.

Rich link-card presentation and Live Preview replacement behavior are adapted from
[Link Card Preview](https://github.com/groundfic/link-card-preview),
Copyright (c) 2026 Groundfic, used under the MIT License. The upstream license is
included at `third_party/link-card-preview/LICENSE`. Seiton ports the Reading View
and Live Preview card behavior into its React/Obsidian adapter boundary; Canvas,
Threads/Instagram handling, tracking-link cleanup, and upstream plugin settings are
not included.

The selection-following editor toolbar behavior is adapted from
[selection-format-toolbar](https://github.com/avinashingit/selection-format-toolbar),
Copyright (c) 2026 Avinash, used under the MIT License. The upstream license is
included at `third_party/selection-format-toolbar/LICENSE`. Seiton keeps the
selection-following, selection-preserving toolbar interaction and reimplements the
editor mutation against Obsidian's Editor API; the upstream plugin's code is not
bundled as a runtime dependency.

ISBN book discovery and cover images may be provided by
[openBD](https://openbd.jp/) and [Open Library](https://openlibrary.org/developers/api).
Open Library is a project of the Internet Archive. Availability and metadata accuracy
are not guaranteed. Optional Japanese library availability uses the
[Calil Library API](https://calil.jp/doc/api_ref.html); each user supplies their own
application key in Seiton settings and the app does not ship a shared key.
