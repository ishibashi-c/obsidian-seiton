import { TFile, TFolder } from "obsidian";
import { describe, expect, it } from "vitest";
import { createObsidianProductionAdapter } from "../src/platform/obsidian/productionAdapter";
import { parseFrontmatter, setYamlParser } from "../src/shared/frontmatter";
import {
  organizationContentFingerprint,
  organizationProposalOperationFingerprint,
  parseOrganizationProposal,
} from "../src/shared/organizationProposal";
import { DEFAULT_SETTINGS } from "../src/shared/settings";
import { testParseYaml } from "./helpers/yaml";

const proposalMarker = {
  created: "2026-09-24",
  operations: [
    {
      changes: { status: "active", tags: ["planning"] },
      expected: {
        lists: [],
        status: "inbox",
        tags: [],
        type: "task",
      },
      id: "plan-01",
      source: "Seiton/inbox/Plan.md",
    },
  ],
  version: 1,
};

const changedProposalMarker = {
  ...proposalMarker,
  operations: proposalMarker.operations.map((operation) => ({
    ...operation,
    changes: { ...operation.changes, tags: ["unreviewed-change"] },
  })),
};

setYamlParser((yaml) => {
  if (yaml.includes("seiton-proposal: changed")) {
    return { "seiton-proposal": changedProposalMarker };
  }
  return yaml.includes("seiton-proposal: test")
    ? { "seiton-proposal": proposalMarker }
    : testParseYaml(yaml);
});

const sourceContent = `---
type: task
status: inbox
created: 2026-09-24T10:00:00+09:00
tags: []
lists: []
customKey: keep-me
---
# Plan
Keep this body.
`;
const proposalContent = `---
seiton-proposal: test
---
# Inbox cleanup
`;

function fakeFolder(path: string): TFolder {
  const folder = new TFolder();
  Object.defineProperty(folder, "path", { configurable: true, value: path });
  return folder;
}

function createFakeAdapter(sourceText: string) {
  const sourcePath = "Seiton/inbox/Plan.md";
  const proposalPath = "Seiton/整理案/2026-09-24.md";
  const source = Object.assign(new TFile(), {
    extension: "md",
    name: "Plan.md",
    parent: fakeFolder("Seiton/inbox"),
    path: sourcePath,
  });
  const proposal = Object.assign(new TFile(), {
    extension: "md",
    name: "2026-09-24.md",
    parent: fakeFolder("Seiton/整理案"),
    path: proposalPath,
  });
  const files = new Map<string, unknown>([
    [sourcePath, source],
    [proposalPath, proposal],
  ]);
  const contents = new Map([
    [sourcePath, sourceText],
    [proposalPath, proposalContent],
  ]);
  const app = {
    fileManager: {
      renameFile: async (file: TFile, path: string) => {
        files.delete(file.path);
        file.path = path;
        files.set(path, file);
      },
    },
    vault: {
      append: async (file: TFile, text: string) => {
        contents.set(file.path, `${contents.get(file.path) ?? ""}${text}`);
      },
      createFolder: async () => {},
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      modify: async (file: TFile, text: string) => {
        contents.set(file.path, text);
      },
      process: async (file: TFile, transform: (value: string) => string) => {
        const next = transform(contents.get(file.path) ?? "");
        contents.set(file.path, next);
        return next;
      },
      read: async (file: TFile) => contents.get(file.path) ?? "",
    },
  };
  return {
    app,
    contents,
    files,
    proposalPath,
    source,
  };
}

function proposalFingerprint(path: string): string {
  const operation = parseOrganizationProposal(path, proposalContent, "Seiton")
    ?.operations[0];
  if (!operation) {
    throw new Error("Expected a parsed proposal operation");
  }
  return organizationProposalOperationFingerprint(operation);
}

describe("organization proposal application", () => {
  it("applies one approved metadata change and records it in the proposal Markdown", async () => {
    const fake = createFakeAdapter(sourceContent);
    const adapter = createObsidianProductionAdapter(
      fake.app as never,
      async () => ({}) as never
    );
    const settings = {
      ...DEFAULT_SETTINGS,
      archiveNoteMoves: [] as typeof DEFAULT_SETTINGS.archiveNoteMoves,
    };

    await adapter.applyProposalOperation(
      settings,
      fake.proposalPath,
      "plan-01",
      proposalFingerprint(fake.proposalPath),
      organizationContentFingerprint(sourceContent),
      "ja",
      async () => {}
    );

    expect(
      parseFrontmatter(fake.contents.get(fake.source.path) ?? "")?.data
    ).toMatchObject({
      customKey: "keep-me",
      status: "active",
      tags: ["planning"],
      type: "task",
    });
    expect(fake.contents.get(fake.source.path)).toContain("Keep this body.");
    const proposal = parseOrganizationProposal(
      fake.proposalPath,
      fake.contents.get(fake.proposalPath) ?? "",
      "Seiton"
    );
    expect(proposal?.status).toBe("applied");
    expect(proposal?.results["plan-01"]?.status).toBe("applied");
  });

  it("blocks stale proposals without overwriting the current note", async () => {
    const changedSource = sourceContent.replace("tags: []", "tags: [changed]");
    const fake = createFakeAdapter(changedSource);
    const adapter = createObsidianProductionAdapter(
      fake.app as never,
      async () => ({}) as never
    );
    const settings = {
      ...DEFAULT_SETTINGS,
      archiveNoteMoves: [] as typeof DEFAULT_SETTINGS.archiveNoteMoves,
    };

    await expect(
      adapter.applyProposalOperation(
        settings,
        fake.proposalPath,
        "plan-01",
        proposalFingerprint(fake.proposalPath),
        organizationContentFingerprint(sourceContent),
        "ja",
        async () => {}
      )
    ).rejects.toThrow();

    expect(
      parseFrontmatter(fake.contents.get(fake.source.path) ?? "")?.data
    ).toMatchObject({
      status: "inbox",
      tags: ["changed"],
    });
    const proposal = parseOrganizationProposal(
      fake.proposalPath,
      fake.contents.get(fake.proposalPath) ?? "",
      "Seiton"
    );
    expect(proposal?.results["plan-01"]?.status).toBe("blocked");
  });

  it("preserves a note edit that lands between proposal validation and write", async () => {
    const fake = createFakeAdapter(sourceContent);
    const process = fake.app.vault.process;
    fake.app.vault.process = async (file, transform) => {
      fake.contents.set(
        file.path,
        sourceContent.replace("Keep this body.", "A newer edit.")
      );
      return process(file, transform);
    };
    const adapter = createObsidianProductionAdapter(
      fake.app as never,
      async () => ({}) as never
    );

    await expect(
      adapter.applyProposalOperation(
        {
          ...DEFAULT_SETTINGS,
          archiveNoteMoves: [],
        },
        fake.proposalPath,
        "plan-01",
        proposalFingerprint(fake.proposalPath),
        organizationContentFingerprint(sourceContent),
        "ja",
        async () => {}
      )
    ).rejects.toThrow();

    const latest = fake.contents.get(fake.source.path) ?? "";
    expect(latest).toContain("A newer edit.");
    expect(parseFrontmatter(latest)?.data).toMatchObject({
      status: "inbox",
      tags: [],
    });
  });

  it("does not apply a proposal changed after the user reviewed it", async () => {
    const fake = createFakeAdapter(sourceContent);
    const reviewed = parseOrganizationProposal(
      fake.proposalPath,
      proposalContent,
      "Seiton"
    )?.operations[0];
    if (!reviewed) {
      throw new Error("Expected a parsed proposal operation");
    }
    const reviewedFingerprint =
      organizationProposalOperationFingerprint(reviewed);
    fake.contents.set(
      fake.proposalPath,
      proposalContent.replace("test", "changed")
    );
    const adapter = createObsidianProductionAdapter(
      fake.app as never,
      async () => ({}) as never
    );

    await expect(
      adapter.applyProposalOperation(
        {
          ...DEFAULT_SETTINGS,
          archiveNoteMoves: [],
        },
        fake.proposalPath,
        "plan-01",
        reviewedFingerprint,
        organizationContentFingerprint(sourceContent),
        "ja",
        async () => {}
      )
    ).rejects.toThrow("確認後に整理案が変更されています");

    expect(fake.contents.get(fake.source.path)).toBe(sourceContent);
    expect(fake.contents.get(fake.proposalPath)).not.toContain(
      "seiton-proposal-result:"
    );
  });

  it("records source changes as applied even if writing the result marker fails", async () => {
    const fake = createFakeAdapter(sourceContent);
    fake.app.vault.append = async () => {
      throw new Error("proposal write failed");
    };
    const adapter = createObsidianProductionAdapter(
      fake.app as never,
      async () => ({}) as never
    );

    await expect(
      adapter.applyProposalOperation(
        {
          ...DEFAULT_SETTINGS,
          archiveNoteMoves: [],
        },
        fake.proposalPath,
        "plan-01",
        proposalFingerprint(fake.proposalPath),
        organizationContentFingerprint(sourceContent),
        "ja",
        async () => {}
      )
    ).resolves.toBeUndefined();

    expect(
      parseFrontmatter(fake.contents.get(fake.source.path) ?? "")?.data
    ).toMatchObject({ status: "active", tags: ["planning"] });
    expect(fake.contents.get(fake.proposalPath)).not.toContain(
      "seiton-proposal-result:"
    );
  });

  it("uses the journaled archived note when the original path is reused", async () => {
    const fake = createFakeAdapter(sourceContent);
    const originalPath = fake.source.path;
    const archivedPath = "Seiton/archive/tasks/notes/inbox/Plan.md";
    fake.files.delete(originalPath);
    fake.source.path = archivedPath;
    fake.files.set(archivedPath, fake.source);
    fake.contents.delete(originalPath);
    fake.contents.set(
      archivedPath,
      sourceContent.replace("status: inbox", "status: archive")
    );
    const replacement = Object.assign(new TFile(), {
      extension: "md",
      name: "Plan.md",
      path: originalPath,
    });
    fake.files.set(originalPath, replacement);
    fake.contents.set(
      originalPath,
      sourceContent.replace("tags: []", "tags: [replacement]")
    );
    const adapter = createObsidianProductionAdapter(
      fake.app as never,
      async () => ({}) as never
    );

    await expect(
      adapter.applyProposalOperation(
        {
          ...DEFAULT_SETTINGS,
          archiveNoteMoves: [
            {
              archivedPath,
              originalPath,
              previousStatus: "inbox",
              type: "task",
            },
          ],
        },
        fake.proposalPath,
        "plan-01",
        proposalFingerprint(fake.proposalPath),
        organizationContentFingerprint(
          sourceContent.replace("status: inbox", "status: archive")
        ),
        "ja",
        async () => {}
      )
    ).rejects.toThrow();

    expect(fake.contents.get(originalPath)).toContain("tags: [replacement]");
    expect(fake.contents.get(archivedPath)).toContain("status: archive");
  });
});
