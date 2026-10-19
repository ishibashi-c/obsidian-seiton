# Privacy and network behavior

Last reviewed: 2026-10-03

Seiton has no hosted account, analytics, telemetry, advertising, or embedded LLM.
Vault content is not uploaded for indexing. Local Markdown remains usable when every
network request fails.

## Requests Seiton can make

| Trigger | Destination | Data sent | Local result | Failure behavior |
|---|---|---|---|---|
| Save or modify a web clip while rich cards are enabled | The saved page URL | A GET request for the full URL, including its path and query. Obsidian's network layer also exposes ordinary request metadata such as the device IP and user agent. Seiton adds no cookies, credentials, or authorization headers. | Public title, description, canonical URL, domain, and Open Graph image metadata | The URL-only Markdown note remains saved and its fallback filename remains unchanged. 401, 403, 429, and other failures are not bypassed. |
| Cache a rich-card image | The public image URL declared by the page | A GET request to that image URL | Image under `.seiton/cache/` | The card continues without a local image. |
| Render a rich-card domain icon when the page has no usable favicon | `www.google.com/s2/favicons` | The public domain from the card URL | Favicon shown beside the domain | If the service is unavailable, a local globe icon is shown. |
| Search or add a book by ISBN | `api.openbd.jp`, then `openlibrary.org` when openBD has no usable record | The normalized ISBN | Selected metadata in a reading note | Empty results are shown and manual entry remains available. |
| Search or add a book by title/author | `openlibrary.org` | The user-entered title/author query | Selected metadata in a reading note | Empty results are shown and manual entry remains available. Requests to Open Library are serialized at least 1.1 seconds apart. |
| Cache a book cover | The selected public cover URL from openBD or Open Library | The selected cover URL | Image under `Seiton/assets/covers/` | The reading note is saved without a local cover. |
| Search library holdings (Japanese UI, when configured) | `api.calil.jp/library` and `api.calil.jp/check` | The ISBN, selected prefecture/city, and the user's Calil application key | Matching library names and availability statuses | Missing key/area, empty holdings, API errors, and polling timeouts remain visible in the modal. |
| Resolve a municipality reference point (Japanese UI, when requested) | `msearch.gsi.go.jp/address-search/AddressSearch` | The configured prefecture and municipality name | Candidate municipality points and coordinates shown for explicit selection | Empty results and API errors remain in Settings; no personal address is saved. |
| Search from a missing municipality (Japanese UI, when requested) | `msearch.gsi.go.jp/address-search/AddressSearch` and `api.calil.jp/library` | The address entered for this search only, then the resulting coordinates to Calil | Distance-sorted library results | The address is not saved; empty results and API errors remain visible in the search modal. |

Opening a user-created shortcut or a rich-card link navigates to that URL as an
explicit user action; Seiton does not proxy that navigation.

## Language and region

Calil library holdings, GSI municipality/address lookup, and the associated library
settings and results are available only in the Japanese UI and target libraries in
Japan. Switching UI language hides those features; it does not restrict the
Bookshelf or ISBN/title metadata search. These are language and service-coverage
limits, not IP-based geofencing.

## Controls

- The rich-card module can be disabled entirely.
- The fallback domain icon uses Google's public favicon endpoint. The page URL,
  page metadata, and vault contents are not sent to that endpoint; only the domain
  value is included in the request.
- Settings → Seiton → Rich cards accepts a comma-separated domain deny list.
  A denied domain and all of its subdomains are excluded from automatic page-title
  and rich-card requests.
- Rich-card cache age and byte limits are configurable. “Clear rich-card cache” moves
  derived cache files to Obsidian's local trash; it never deletes user notes.
- Book-cover caching can be disabled. Existing covers can be removed or replaced per book.
- ISBN lookup tries openBD first and uses Open Library as the fallback. Title/author search remains Open Library because openBD's built-in lookup is ISBN-based.
- Calil's application key is user-provided in Japanese settings only; Seiton does not ship a shared key. Library names and availability statuses are linked to Calil as required by its API documentation.
- Seiton does not modify Sync or Syncthing ignore files. Users who do not want derived
  `.seiton/cache/` files synchronized should configure that exclusion in their chosen
  sync product.
- The deprecated schema-v6 `richCardCacheExcludeFromSync` value is preserved for one
  compatibility window but has no effect. Seiton leaves any legacy ignore-file line in
  place so a user's sync policy is not silently changed.

## Important URL caution

A URL query can itself contain private tokens or personal information. Do not save
secret-bearing URLs as web clips. The domain deny list prevents future automatic
metadata requests but does not redact URLs already stored in Markdown.

## Provider decision

ISBN lookup uses openBD first and Open Library as a fallback. Book metadata and
covers from openBD are used to introduce books in the Bookshelf and reading notes.
Its [guidelines](https://openbd.jp/terms/) limit data use to book promotion or
introduction, require prompt cache updates and compliance with deletion requests,
and prohibit arbitrary modification of supplied data. The source API response is
not edited or republished by Seiton; personal notes and annotations remain local.
This description does not grant permission to reuse provider data for other purposes.

Metadata is fetched on demand without a persistent API-response cache. Selected
fields become the user's local reading note; missing-field completion preserves
existing values and is not an automatic metadata synchronization service. Covers
are fetched when caching is requested; a newly fetched image replaces a cache file
at the same path. Seiton does not poll providers for later changes. When a provider
changes or withdraws data, remove the affected cover through Seiton's trash action
and correct or remove the affected source-derived fields in the reading note.
Fetch current data again when appropriate. Keep personal annotations separate from
provider data when sharing or publishing a reading note.

Calil is an optional, user-keyed Japanese-UI-only library lookup for Japan, and its
returned names/statuses link back to Calil. External agents may use another
bibliographic source only after respecting that source's current terms.
