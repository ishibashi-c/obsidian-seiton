import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { setYamlParser } from "../src/shared/frontmatter";
import {
  applyOrganizationProposalBatch,
  hasOrganizationProposalMarker,
  isOrganizationProposalPath,
  organizationProposalCounts,
  organizationProposalFolder,
  organizationProposalOperationFingerprint,
  organizationProposalResultLine,
  parseOrganizationProposal,
} from "../src/shared/organizationProposal";
import { ReactOrganizeProposals } from "../src/ui/screens/react-organize-proposals";
import { testParseYaml } from "./helpers/yaml";

const validOperation = {
  changes: {
    destination: "Seiton/articles/research",
    lists: ["read-later"],
    status: "active",
    tags: ["research"],
  },
  expected: {
    lists: [],
    status: "inbox",
    tags: [],
    type: "article",
  },
  id: "organize-01",
  reason: "研究資料として保存先をまとめるため",
  source: "Seiton/inbox/example.md",
};

const validHold = {
  reason: "内容の用途が分からず、種類と保存先を決められないため",
  source: "Seiton/inbox/unclear.md",
};

const proposalMarkers: Record<string, unknown> = {
  active: {
    created: "2026-09-24",
    holds: [validHold],
    operations: [
      {
        ...validOperation,
        expected: { ...validOperation.expected, status: "active" },
      },
    ],
    version: 2,
  },
  collection: {
    created: "2026-09-24",
    holds: [],
    operations: [
      {
        ...validOperation,
        changes: {
          ...validOperation.changes,
          destination: "Seiton/collections",
          type: "collection",
        },
      },
    ],
    version: 2,
  },
  duplicateSource: {
    created: "2026-09-24",
    holds: [
      {
        ...validHold,
        source: validOperation.source,
      },
    ],
    operations: [validOperation],
    version: 2,
  },
  holdOnly: {
    created: "2026-09-24",
    holds: [validHold],
    operations: [],
    version: 2,
  },
  legacy: {
    created: "2026-09-24",
    operations: [
      {
        ...validOperation,
        reason: undefined,
      },
    ],
    version: 1,
  },
  missingHolds: {
    created: "2026-09-24",
    operations: [validOperation],
    version: 2,
  },
  missingReason: {
    created: "2026-09-24",
    holds: [],
    operations: [{ ...validOperation, reason: undefined }],
    version: 2,
  },
  outside: {
    created: "2026-09-24",
    holds: [],
    operations: [
      {
        ...validOperation,
        changes: { ...validOperation.changes, destination: "Outside/research" },
      },
    ],
    version: 2,
  },
  traversal: {
    created: "2026-09-24",
    holds: [],
    operations: [{ ...validOperation, source: "Seiton/inbox/../secret.md" }],
    version: 2,
  },
  valid: {
    created: "2026-09-24",
    holds: [validHold],
    operations: [validOperation],
    version: 2,
  },
};

setYamlParser((yaml) => {
  const marker = /^seiton-proposal:\s*(\w+)\s*$/m.exec(yaml)?.[1];
  return marker
    ? { "seiton-proposal": proposalMarkers[marker] }
    : testParseYaml(yaml);
});

function proposalDocument(marker = "valid"): string {
  return `---\nseiton-proposal: ${marker}\n---\n# September organization\n\nReview each change before applying it.\n`;
}

describe("organization proposals", () => {
  it("accepts collection as a proposal type and configured destination", () => {
    const parsed = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      proposalDocument("collection"),
      "Seiton"
    );

    expect(parsed?.operations[0]).toMatchObject({
      changes: {
        destination: "Seiton/collections",
        type: "collection",
      },
      expected: { type: "article" },
    });
  });

  it("uses the selected language folder and recognizes proposal documents", () => {
    expect(organizationProposalFolder("Seiton", "ja")).toBe("Seiton/整理案");
    expect(
      isOrganizationProposalPath(
        "Seiton/Organization proposals/2026-09-24.md",
        "Seiton"
      )
    ).toBe(true);
    expect(
      isOrganizationProposalPath("Other/整理案/proposal.md", "Seiton")
    ).toBe(false);
  });

  it("parses a safe inbox proposal and keeps result markers idempotent", () => {
    const parsed = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      proposalDocument(),
      "Seiton"
    );

    expect(parsed).toMatchObject({
      coverage: "complete",
      created: "2026-09-24",
      holds: [
        {
          reason: validHold.reason,
          source: validHold.source,
        },
      ],
      status: "pending",
      title: "September organization",
      version: 2,
    });
    const operation = parsed?.operations[0];
    if (!operation) {
      throw new Error("Expected the parsed proposal operation");
    }
    expect(operation).toMatchObject({
      changes: {
        destination: "Seiton/articles/research",
        lists: ["read-later"],
        status: "active",
        tags: ["research"],
      },
      expected: {
        status: "inbox",
        type: "article",
      },
      reason: "研究資料として保存先をまとめるため",
      source: "Seiton/inbox/example.md",
    });
    expect(organizationProposalCounts(parsed)).toEqual({
      appliedCount: 0,
      heldCount: 1,
      pendingCount: 1,
      proposedCount: 1,
      targetCount: 2,
    });
    const resultLine = organizationProposalResultLine({
      at: "2026-09-24T00:00:00.000Z",
      fingerprint: organizationProposalOperationFingerprint(operation),
      message: "Applied",
      operationId: "organize-01",
      status: "applied",
    });
    const withResult = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      `${proposalDocument()}\n${resultLine}\n`,
      "Seiton"
    );
    expect(withResult?.status).toBe("applied");
    expect(withResult?.results["organize-01"]?.status).toBe("applied");
  });

  it("live source state can overrule a forged applied marker", () => {
    const base = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      proposalDocument(),
      "Seiton"
    );
    const operation = base?.operations[0];
    if (!operation) {
      throw new Error("Expected the parsed proposal operation");
    }
    const forgedResult = organizationProposalResultLine({
      at: "2026-09-24T00:00:00.000Z",
      fingerprint: organizationProposalOperationFingerprint(operation),
      message: "Applied",
      operationId: operation.id,
      status: "applied",
    });
    const parsed = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      `${proposalDocument()}\n${forgedResult}\n`,
      "Seiton"
    );
    if (!parsed) {
      throw new Error("Expected a parsed proposal");
    }
    parsed.operations[0] = { ...parsed.operations[0], applied: false };

    expect(organizationProposalCounts(parsed)).toMatchObject({
      appliedCount: 0,
      pendingCount: 1,
      proposedCount: 1,
    });
  });

  it("renders proposed and held items as separate, counted sections", () => {
    const parsed = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      proposalDocument(),
      "Seiton"
    );
    if (!parsed) {
      throw new Error("Expected a parsed proposal");
    }
    const operation = parsed.operations[0];
    const hold = parsed.holds[0];
    if (!(operation && hold)) {
      throw new Error("Expected a proposed item and a held item");
    }
    parsed.operations[0] = {
      ...operation,
      current: {
        body: "Research note body",
        contentFingerprint: "source-version-1",
        lists: [],
        path: "Seiton/inbox/example.md",
        status: "inbox",
        tags: [],
        title: "Research note",
        type: "article",
      },
      matchesExpected: true,
    };
    parsed.holds[0] = {
      ...hold,
      current: {
        path: "Seiton/inbox/unclear.md",
        title: "Unclear note",
      },
    };

    const markup = renderToStaticMarkup(
      createElement(ReactOrganizeProposals, {
        lang: "ja",
        onApply: () => undefined,
        onApplyBatch: async () => ({ appliedCount: 0, failedCount: 0 }),
        proposals: [parsed],
        typeFolderPaths: {},
      })
    );

    expect(markup).toContain("作成時対象 2件");
    expect(markup).toContain("整理案（反映候補）");
    expect(markup).toContain("保留（変更しません）");
    expect(markup).toContain(validHold.reason);
    expect(markup).toContain("Research note");
    expect(markup).toContain("反映可能な項目をすべて選択");
  });

  it("distinguishes legacy proposals whose prose-only holds are not machine-readable", () => {
    const parsed = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      proposalDocument("legacy"),
      "Seiton"
    );

    expect(parsed).toMatchObject({
      coverage: "legacy",
      holds: [],
      status: "pending",
      version: 1,
    });
    if (!parsed) {
      throw new Error("Expected the legacy proposal");
    }
    expect(organizationProposalCounts(parsed)).toEqual({
      appliedCount: 0,
      heldCount: null,
      pendingCount: 1,
      proposedCount: 1,
      targetCount: null,
    });
  });

  it("supports proposals where every reviewed item is held", () => {
    const parsed = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      proposalDocument("holdOnly"),
      "Seiton"
    );
    if (!parsed) {
      throw new Error("Expected the held-only proposal");
    }
    expect(parsed.status).toBe("pending");
    expect(organizationProposalCounts(parsed)).toEqual({
      appliedCount: 0,
      heldCount: 1,
      pendingCount: 0,
      proposedCount: 0,
      targetCount: 1,
    });
  });

  it("applies a selected batch serially and continues after an individual failure", async () => {
    const operations = ["one", "two", "three"].map((operationId) => ({
      fingerprint: `fingerprint-${operationId}`,
      operationId,
      proposalPath: "Seiton/整理案/2026-09-24.md",
    }));
    const attempted: typeof operations = [];
    const result = await applyOrganizationProposalBatch(
      operations,
      async (operation) => {
        attempted.push(operation);
        if (operation.operationId === "two") {
          throw new Error("stale source");
        }
      }
    );

    expect(attempted).toEqual(operations);
    expect(result).toEqual({ appliedCount: 2, failedCount: 1 });
  });

  it.each([
    ["traversal source", "traversal"],
    ["outside destination", "outside"],
    ["duplicate source", "duplicateSource"],
    ["missing structured holds", "missingHolds"],
    ["missing operation reason", "missingReason"],
  ])("rejects a proposal with a %s", (_description, marker) => {
    const parsed = parseOrganizationProposal(
      "Seiton/整理案/2026-09-24.md",
      proposalDocument(marker),
      "Seiton"
    );
    expect(parsed?.status).toBe("invalid");
  });

  it("only accepts inbox items and never treats an unmarked note elsewhere as a proposal", () => {
    expect(
      parseOrganizationProposal(
        "Seiton/整理案/2026-09-24.md",
        proposalDocument("active"),
        "Seiton"
      )?.status
    ).toBe("invalid");
    expect(
      parseOrganizationProposal(
        "Seiton/tasks/note.md",
        "---\ntype: task\n---\n",
        "Seiton"
      )
    ).toBeNull();
    expect(hasOrganizationProposalMarker(proposalDocument())).toBe(true);
  });
});
