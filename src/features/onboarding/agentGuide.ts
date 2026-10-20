import { ITEM_TYPES } from "../../shared/constants";
import type { Lang } from "../../shared/i18n";
import { organizationProposalFolder } from "../../shared/organizationProposal";
import { folderForType } from "../../shared/paths";
import type { SeitonSettings } from "../../shared/types";

export const AGENT_GUIDE_SCHEMA_VERSION = 3;
export type AgentGuideChoice = "none" | "create" | "propose";
export type AgentGuidePlan =
  | { kind: "none" }
  | { kind: "create"; path: string; content: string }
  | { kind: "proposal"; path: string; content: string };

export function buildAgentGuide(
  settings: Pick<
    SeitonSettings,
    "rootFolder" | "memosFolder" | "inboxFolder" | "typeFolders"
  >,
  lang: Lang = "en"
): string {
  const proposalFolder = organizationProposalFolder(settings.rootFolder, lang);
  const typeFolders = ITEM_TYPES.map(
    (type) => `  - \`${type}\`: \`${folderForType(settings, type)}\``
  ).join("\n");
  return `# Seiton Vault guide

<!-- seiton-agent-guide-schema: ${AGENT_GUIDE_SCHEMA_VERSION} -->

This folder is managed by the Seiton Obsidian plugin. Keep Markdown human-readable and preserve unknown frontmatter keys and body content.

## Safety

- Do not edit source notes directly for organization work. Create a proposal and let the user review and apply each operation in Seiton.
- Do not delete notes unless the user explicitly asks. Archiving moves the note to Seiton's dedicated archive and can be restored.
- Keep \`type\`, \`status\`, \`created\`, existing tags, lists, links, and unknown keys.
- Use Obsidian-safe renames so links remain valid.
- Do not send Vault contents, secrets, or personal data to external services.

## Schema

- Types: ${ITEM_TYPES.join(", ")}
- Type folders:\n${typeFolders}
- Status: \`inbox\`, \`active\`, \`archive\`
- Content tags: \`tags\`; source metadata tags: \`sourceTags\`; curated groups: \`lists\`
- Use \`collection\` for one long-lived curated reference or index note whose entries accumulate over time. Use \`lists\` to group multiple separate notes; they are not interchangeable.
- Root: \`${settings.rootFolder}\`; inbox: \`${settings.inboxFolder}\`; memos: \`${settings.memosFolder}\`
- Treat partial frontmatter and legacy keys as data to preserve, not errors to erase.

## Common operations

- Organize inbox: inspect the current note and propose justified tags, lists, type, and (only when needed) an existing destination folder. Do not modify the source note; create a review file in \`${proposalFolder}/\`.
- Name each proposal \`YYYY-MM-DD.md\` using the current date. If that file already exists, use \`YYYY-MM-DD-02.md\`, then increment the suffix.
- Use one \`seiton-proposal\` frontmatter object with \`version: 2\`, \`created: YYYY-MM-DD\`, an \`operations\` list, and a \`holds\` list. For one review run, account for every inbox note in the inspected snapshot exactly once: either as an operation or as a hold. Do not put coverage counts or decisions only in prose.
- Each operation has a unique \`id\`, exact Vault-relative \`source\` path, a short \`reason\`, an \`expected\` snapshot of \`type\`, \`status\`, \`tags\`, and \`lists\`, plus \`changes\` containing a desired \`status\` (\`active\` or \`archive\`) and only the fields to change (\`type\`, \`tags\`, \`lists\`, optional \`destination\`). Each hold has an exact \`source\` path, a short \`reason\`, and optional \`title\`. Use a hold when the available types do not fit naturally or the evidence is insufficient; do not force a type just to clear the inbox. Distinguish \`article\` (substantial writing the user authors/structures), \`idea\` (a concept to develop), and \`collection\` (one persistent curated reference whose entries accumulate over time). A format such as email or an art reference alone does not determine the type. Example:

\`\`\`yaml
seiton-proposal:
  version: 2
  created: "2026-09-24"
  operations:
    - id: organize-01
      source: Seiton/inbox/example.md
      expected:
        type: article
        status: inbox
        tags: []
        lists: []
      changes:
        status: active
        tags: [research]
        lists: [read-later]
        destination: Seiton/articles/research
      reason: "Research material belongs with related notes"
  holds:
    - source: Seiton/inbox/ambiguous.md
      title: "Unclear reference"
      reason: "No core type fits without guessing"
\`\`\`

- \`destination\` must already exist and belong to the resulting type's configured folder. Do not create folders; omit the destination when no move is needed. Leave ambiguous notes out of operations and record them as holds with a reason.
- Keep the proposal's Markdown body human-readable, but treat the structured frontmatter as canonical. Seiton renders operations and holds from the structured data and records each operation's result in this file.
- The user must review and explicitly apply each operation in Seiton's proposal review screen. They may select several and confirm them together; Seiton rechecks each source immediately before applying and continues other items if one is stale or blocked. Holds are never applied. Re-read the source metadata immediately before preparing the proposal; if its current values are uncertain, use a hold instead of guessing.
- Tag existing folders: preview target files and proposed changes before bulk edits; make the operation rerunnable.
- Add a book by title: use an available bibliographic-search tool or connector first. Otherwise use a public bibliographic API whose terms allow the intended storage; Seiton's ISBN lookup tries openBD first and falls back to Open Library, while title/author search uses Open Library. Confirm title, author, publisher, year, and edition. Normalize ISBN-10 to ISBN-13, ignore hyphens/spaces, check existing \`bookIsbn\`, and never invent missing metadata.
- Reading notes use \`type: reading\`. Optional book fields include \`bookIsbn\`, \`bookAuthor\`, \`bookPublisher\`, \`bookPublished\`, \`bookFinished\`, \`bookRating\`, \`bookCategory\`, \`bookSeries\`, \`readingStatus\`, and \`bookOwnership\`. Seiton also adds the selected \`bookCategory\` to \`tags\`.
`;
}

export function agentGuideVersion(content: string): number {
  const match = /seiton-agent-guide-schema:\s*(\d+)/.exec(content);
  return match ? Number(match[1]) : 0;
}

export function planAgentGuide(
  choice: AgentGuideChoice,
  rootFolder: string,
  existing: string | null,
  content: string
): AgentGuidePlan {
  if (choice === "none") {
    return { kind: "none" };
  }
  const root = rootFolder.replace(/^\/+|\/+$/g, "");
  if (!existing) {
    return { content, kind: "create", path: `${root}/AGENTS.md` };
  }
  if (
    choice === "propose" &&
    agentGuideVersion(existing) < AGENT_GUIDE_SCHEMA_VERSION
  ) {
    return {
      content,
      kind: "proposal",
      path: `${root}/AGENTS.seiton-proposed.md`,
    };
  }
  return { kind: "none" };
}
