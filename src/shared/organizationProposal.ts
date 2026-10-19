import { ITEM_TYPES } from "./constants";
import { parseFrontmatter } from "./frontmatter";
import type { Lang } from "./i18n";
import { normalizeFolder } from "./paths";
import type { ItemStatus, ItemType } from "./types";

export interface OrganizationProposalOperation {
  applied?: boolean;
  changes: {
    destination?: string;
    lists?: string[];
    status: "active" | "archive";
    tags?: string[];
    type?: ItemType;
  };
  current?: {
    archiveDestination?: string;
    body: string;
    contentFingerprint?: string;
    lists: string[];
    path: string;
    status: ItemStatus;
    tags: string[];
    title: string;
    type: ItemType;
  } | null;
  expected: {
    lists: string[];
    status: ItemStatus;
    tags: string[];
    type: ItemType;
  };
  id: string;
  matchesExpected?: boolean;
  reason?: string;
  source: string;
}

export interface OrganizationProposalHold {
  current?: { path: string; title: string } | null;
  reason: string;
  source: string;
  title?: string;
}

export interface OrganizationProposalResult {
  at: string;
  fingerprint: string;
  message?: string;
  operationId: string;
  status: "applied" | "blocked";
}

export interface OrganizationProposalDocument {
  coverage: "complete" | "legacy";
  created: string;
  error?: string;
  holds: OrganizationProposalHold[];
  operations: OrganizationProposalOperation[];
  path: string;
  results: Record<string, OrganizationProposalResult>;
  status: "applied" | "invalid" | "partial" | "pending";
  title: string;
  version: 1 | 2;
}

export interface OrganizationProposalCounts {
  appliedCount: number;
  heldCount: number | null;
  pendingCount: number;
  proposedCount: number;
  targetCount: number | null;
}

export interface OrganizationProposalOperationRef {
  fingerprint: string;
  operationId: string;
  proposalPath: string;
  sourceFingerprint?: string;
}

const PROPOSAL_FOLDER_NAMES: Record<Lang, string> = {
  de: "Sortiervorschläge",
  en: "Organization proposals",
  es: "Propuestas de organización",
  fr: "Propositions de classement",
  ja: "整理案",
  ko: "정리 제안",
  "pt-BR": "Propostas de organização",
  "zh-CN": "整理建议",
};

const RESULT_MARKER = /^<!-- seiton-proposal-result:(.+) -->\s*$/gm;
const VALID_STATUSES: readonly ItemStatus[] = ["active", "archive", "inbox"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    return null;
  }
  return [
    ...new Set(value.map((entry) => (entry as string).trim()).filter(Boolean)),
  ];
}

function safeVaultPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const raw = value.trim().replace(/\\/g, "/");
  if (
    !raw ||
    raw.startsWith("/") ||
    raw.split("/").some((part) => part === ".." || part === ".")
  ) {
    return null;
  }
  return normalizeFolder(raw);
}

function proposalReason(value: unknown, required: boolean): string | null {
  if (value === undefined && !required) {
    return "";
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

function parseOperation(
  value: unknown,
  rootFolder: string,
  requireReason: boolean
): OrganizationProposalOperation | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
    return null;
  }
  const source = safeVaultPath(value.source);
  const expected = value.expected;
  const changes = value.changes;
  if (
    !(
      source &&
      isRecord(expected) &&
      isRecord(changes) &&
      source.startsWith(`${normalizeFolder(rootFolder)}/`)
    ) ||
    isOrganizationProposalPath(source, rootFolder) ||
    source.startsWith(`${normalizeFolder(rootFolder)}/archive/`) ||
    typeof expected.type !== "string" ||
    !ITEM_TYPES.includes(expected.type as ItemType) ||
    typeof expected.status !== "string" ||
    !VALID_STATUSES.includes(expected.status as ItemStatus) ||
    expected.status !== "inbox"
  ) {
    return null;
  }
  const expectedTags = stringArray(expected.tags);
  const expectedLists = stringArray(expected.lists);
  if (
    expectedTags === null ||
    expectedLists === null ||
    typeof changes.status !== "string" ||
    !(changes.status === "active" || changes.status === "archive")
  ) {
    return null;
  }
  const tags =
    changes.tags === undefined ? undefined : stringArray(changes.tags);
  const lists =
    changes.lists === undefined ? undefined : stringArray(changes.lists);
  const type = changes.type;
  const destination =
    changes.destination === undefined
      ? undefined
      : safeVaultPath(changes.destination);
  const reason = proposalReason(value.reason, requireReason);
  if (
    (changes.tags !== undefined && tags === null) ||
    (changes.lists !== undefined && lists === null) ||
    (type !== undefined &&
      (typeof type !== "string" || !ITEM_TYPES.includes(type as ItemType))) ||
    (changes.destination !== undefined && !destination) ||
    (destination &&
      !destination.startsWith(`${normalizeFolder(rootFolder)}/`)) ||
    reason === null
  ) {
    return null;
  }
  return {
    changes: {
      destination: destination ?? undefined,
      lists: lists ?? undefined,
      status: changes.status,
      tags: tags ?? undefined,
      type: type as ItemType | undefined,
    },
    expected: {
      lists: expectedLists,
      status: expected.status as ItemStatus,
      tags: expectedTags,
      type: expected.type as ItemType,
    },
    id: value.id.trim(),
    reason: reason || undefined,
    source,
  };
}

function parseHold(
  value: unknown,
  rootFolder: string
): OrganizationProposalHold | null {
  if (!isRecord(value)) {
    return null;
  }
  const source = safeVaultPath(value.source);
  const reason = proposalReason(value.reason, true);
  const title =
    typeof value.title === "string" && value.title.trim()
      ? value.title.trim()
      : undefined;
  if (!source?.startsWith(`${normalizeFolder(rootFolder)}/`)) {
    return null;
  }
  if (
    isOrganizationProposalPath(source, rootFolder) ||
    source.startsWith(`${normalizeFolder(rootFolder)}/archive/`) ||
    reason === null ||
    (value.title !== undefined && !title)
  ) {
    return null;
  }
  return { reason, source, title };
}

export function organizationProposalFolderName(lang: Lang): string {
  return PROPOSAL_FOLDER_NAMES[lang];
}

export function organizationProposalFolder(
  rootFolder: string,
  lang: Lang
): string {
  return `${normalizeFolder(rootFolder)}/${organizationProposalFolderName(lang)}`;
}

export function organizationProposalFolders(rootFolder: string): string[] {
  return [...new Set(Object.values(PROPOSAL_FOLDER_NAMES))].map(
    (name) => `${normalizeFolder(rootFolder)}/${name}`
  );
}

export function hasOrganizationProposalMarker(content: string): boolean {
  return parseFrontmatter(content)?.data["seiton-proposal"] !== undefined;
}

export function isOrganizationProposalPath(
  path: string,
  rootFolder: string
): boolean {
  const normalizedPath = normalizeFolder(path).toLowerCase();
  return organizationProposalFolders(rootFolder).some((folder) => {
    const normalizedFolder = normalizeFolder(folder).toLowerCase();
    return (
      normalizedPath === normalizedFolder ||
      normalizedPath.startsWith(`${normalizedFolder}/`)
    );
  });
}

export function organizationProposalValuesMatch(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

function parseResults(
  body: string
): Record<string, OrganizationProposalResult> {
  const results: Record<string, OrganizationProposalResult> = {};
  for (const match of body.matchAll(RESULT_MARKER)) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      if (
        isRecord(parsed) &&
        typeof parsed.operationId === "string" &&
        typeof parsed.at === "string" &&
        typeof parsed.fingerprint === "string" &&
        (parsed.status === "applied" || parsed.status === "blocked")
      ) {
        results[parsed.operationId] = {
          at: parsed.at,
          fingerprint: parsed.fingerprint,
          message:
            typeof parsed.message === "string" ? parsed.message : undefined,
          operationId: parsed.operationId,
          status: parsed.status,
        };
      }
    } catch {
      // Ignore malformed result markers and keep the proposal reviewable.
    }
  }
  return results;
}

export function organizationProposalOperationFingerprint(
  operation: OrganizationProposalOperation
): string {
  return JSON.stringify({
    changes: operation.changes,
    expected: operation.expected,
    id: operation.id,
    source: operation.source,
  });
}

/** A lightweight change token used to prevent applying a proposal to edited note content. */
export function organizationContentFingerprint(content: string): string {
  let first = 2_166_136_261;
  let second = 3_266_489_917;
  for (let index = 0; index < content.length; index += 1) {
    const code = content.charCodeAt(index);
    first = Math.imul(first ^ code, 16_777_619);
    second = Math.imul(second ^ code, 2_246_822_519);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function organizationProposalCounts(
  proposal: OrganizationProposalDocument
): OrganizationProposalCounts {
  const appliedCount = proposal.operations.filter((operation) =>
    organizationProposalOperationIsApplied(operation, proposal)
  ).length;
  const proposedCount = proposal.operations.length;
  const heldCount =
    proposal.coverage === "complete" ? proposal.holds.length : null;
  return {
    appliedCount,
    heldCount,
    pendingCount: proposedCount - appliedCount,
    proposedCount,
    targetCount: heldCount === null ? null : proposedCount + heldCount,
  };
}

export function organizationProposalOperationIsApplied(
  operation: OrganizationProposalOperation,
  proposal: Pick<OrganizationProposalDocument, "results">
): boolean {
  return typeof operation.applied === "boolean"
    ? operation.applied
    : proposal.results[operation.id]?.status === "applied";
}

export async function applyOrganizationProposalBatch(
  operations: readonly OrganizationProposalOperationRef[],
  apply: (operation: OrganizationProposalOperationRef) => void | Promise<void>
): Promise<{ appliedCount: number; failedCount: number }> {
  let appliedCount = 0;
  let failedCount = 0;
  for (const operation of operations) {
    try {
      await apply(operation);
      appliedCount += 1;
    } catch {
      failedCount += 1;
    }
  }
  return { appliedCount, failedCount };
}

export function parseOrganizationProposal(
  path: string,
  content: string,
  rootFolder: string
): OrganizationProposalDocument | null {
  const frontmatter = parseFrontmatter(content);
  const marker = frontmatter?.data["seiton-proposal"];
  if (!isOrganizationProposalPath(path, rootFolder) && marker === undefined) {
    return null;
  }
  const title =
    /^#\s+(.+)$/m.exec(frontmatter?.body ?? "")?.[1]?.trim() ??
    path.split("/").at(-1)?.replace(/\.md$/i, "") ??
    path;
  const base = {
    coverage: "legacy" as const,
    created: "",
    holds: [] as OrganizationProposalHold[],
    operations: [] as OrganizationProposalOperation[],
    path,
    results: parseResults(frontmatter?.body ?? content),
    status: "invalid" as const,
    title,
    version: 1 as const,
  };
  if (
    !isRecord(marker) ||
    (marker.version !== 1 && marker.version !== 2) ||
    typeof marker.created !== "string" ||
    !Array.isArray(marker.operations) ||
    (marker.version === 2 && !Array.isArray(marker.holds))
  ) {
    return { ...base, error: "Unsupported or malformed proposal document" };
  }
  const version = marker.version;
  const operations = marker.operations.map((operation) =>
    parseOperation(operation, rootFolder, version === 2)
  );
  const holds =
    version === 2
      ? (marker.holds as unknown[]).map((hold) => parseHold(hold, rootFolder))
      : [];
  if (
    operations.some((operation) => operation === null) ||
    holds.some((hold) => hold === null)
  ) {
    return {
      ...base,
      created: marker.created,
      error: "One or more proposal operations are invalid",
    };
  }
  const validOperations = operations as OrganizationProposalOperation[];
  const validHolds = holds as OrganizationProposalHold[];
  const sourcePaths = [
    ...validOperations.map((operation) => operation.source),
    ...validHolds.map((hold) => hold.source),
  ];
  if (
    sourcePaths.length === 0 ||
    new Set(validOperations.map((operation) => operation.id)).size !==
      validOperations.length ||
    new Set(sourcePaths).size !== sourcePaths.length
  ) {
    return {
      ...base,
      created: marker.created,
      error: "Proposal must contain uniquely identified operations",
    };
  }
  const results = Object.fromEntries(
    Object.entries(base.results).filter(([operationId, result]) => {
      const operation = validOperations.find(
        (candidate) => candidate.id === operationId
      );
      return Boolean(
        operation &&
          result.fingerprint ===
            organizationProposalOperationFingerprint(operation)
      );
    })
  );
  const appliedCount = validOperations.filter(
    (operation) => results[operation.id]?.status === "applied"
  ).length;
  const hasResults = validOperations.some((operation) => results[operation.id]);
  return {
    coverage: version === 2 ? "complete" : "legacy",
    created: marker.created,
    holds: validHolds,
    operations: validOperations,
    path,
    results,
    status:
      validOperations.length > 0 && appliedCount === validOperations.length
        ? "applied"
        : hasResults
          ? "partial"
          : "pending",
    title,
    version,
  };
}

export function organizationProposalResultLine(
  result: OrganizationProposalResult
): string {
  return `<!-- seiton-proposal-result:${JSON.stringify(result)} -->`;
}
