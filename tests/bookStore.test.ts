import { type App, type requestUrl, TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cacheCover,
  createBookNote,
  findSimilarBookNotes,
} from "../src/platform/obsidian/bookStore";

const atomicHabits = {
  basename: "Atomic Habits",
  path: "Seiton/readings/Atomic Habits.md",
} as TFile;

const atomicHabitsNote = `---
type: reading
status: active
created: "2026-09-02T21:18:12+09:00"
bookAuthor: "James Clear"
---
`;

function appWithNotes(notes: Map<TFile, string>): App {
  return {
    vault: {
      cachedRead: async (file: TFile) => notes.get(file) ?? "",
      getMarkdownFiles: () => [...notes.keys()],
    },
  } as unknown as App;
}

describe("findSimilarBookNotes", () => {
  it("finds an existing title when the new entry has no author", async () => {
    const app = appWithNotes(new Map([[atomicHabits, atomicHabitsNote]]));

    await expect(
      findSimilarBookNotes(app, "Atomic Habits", "")
    ).resolves.toEqual([atomicHabits]);
  });

  it("does not match a same title with a different known author", async () => {
    const app = appWithNotes(new Map([[atomicHabits, atomicHabitsNote]]));

    await expect(
      findSimilarBookNotes(app, "Atomic Habits", "A different author")
    ).resolves.toEqual([]);
  });
});

describe("createBookNote", () => {
  it("書籍ノートへ所持状態を書き込む", async () => {
    let createdContent = "";
    const app = {
      vault: {
        create: async (path: string, content: string) => {
          createdContent = content;
          return { path } as TFile;
        },
        createFolder: async () => ({}) as TFile,
        getAbstractFileByPath: () => null,
      },
    } as unknown as App;

    await createBookNote(
      app,
      {
        metadata: {
          author: "著者",
          coverUrl: "",
          isbn: "9780000000000",
          pages: 0,
          publishDate: "",
          publisher: "",
          title: "所持状態のテスト",
        },
        ownership: "owned",
      },
      {
        bookCoverCacheEnabled: false,
        memosFolder: "Memos",
        rootFolder: "Seiton",
        typeFolders: {},
      }
    );

    expect(createdContent).toContain("bookOwnership: owned");
  });
});

describe("cacheCover", () => {
  afterEach(() => vi.restoreAllMocks());

  it("replaces a cached cover with the newly fetched image", async () => {
    const file = new TFile();
    file.path = "Seiton/assets/covers/9784478025819.jpg";
    let stored = new Uint8Array([1]).buffer;
    const updated = new Uint8Array([2, 3]).buffer;
    vi.spyOn(await import("obsidian"), "requestUrl").mockResolvedValue({
      arrayBuffer: updated,
      status: 200,
    } as unknown as Awaited<ReturnType<typeof requestUrl>>);
    const app = {
      vault: {
        createFolder: async () => undefined,
        getAbstractFileByPath: (path: string) =>
          path === file.path ? file : null,
        modifyBinary: async (_file: TFile, data: ArrayBuffer) => {
          stored = data;
        },
      },
    } as unknown as App;

    await expect(
      cacheCover(app, "9784478025819", "https://example.com/cover.jpg")
    ).resolves.toBe(file.path);
    expect(new Uint8Array(stored)).toEqual(new Uint8Array([2, 3]));
  });

  it.each(["", "4478025818"])(
    "keeps separate covers when ISBN is missing or invalid (%s)",
    async (isbn) => {
      const files = new Map<string, TFile>();
      const images = new Map<string, ArrayBuffer>();
      vi.spyOn(await import("obsidian"), "requestUrl")
        .mockResolvedValueOnce({
          arrayBuffer: new Uint8Array([1]).buffer,
          status: 200,
        } as unknown as Awaited<ReturnType<typeof requestUrl>>)
        .mockResolvedValueOnce({
          arrayBuffer: new Uint8Array([2]).buffer,
          status: 200,
        } as unknown as Awaited<ReturnType<typeof requestUrl>>)
        .mockResolvedValueOnce({
          arrayBuffer: new Uint8Array([3]).buffer,
          status: 200,
        } as unknown as Awaited<ReturnType<typeof requestUrl>>);
      const app = {
        vault: {
          createBinary: async (path: string, data: ArrayBuffer) => {
            const file = new TFile();
            file.path = path;
            files.set(path, file);
            images.set(path, data);
            return file;
          },
          createFolder: async () => undefined,
          getAbstractFileByPath: (path: string) => files.get(path) ?? null,
          modifyBinary: async (file: TFile, data: ArrayBuffer) => {
            images.set(file.path, data);
          },
        },
      } as unknown as App;

      const first = await cacheCover(
        app,
        isbn,
        "https://example.com/first.jpg"
      );
      const second = await cacheCover(
        app,
        isbn,
        "https://example.com/second.jpg"
      );
      const repeated = await cacheCover(
        app,
        isbn,
        "https://example.com/first.jpg"
      );
      expect(first).not.toBe(second);
      expect(repeated).not.toBe(first);
      expect(new Uint8Array(images.get(first) ?? new ArrayBuffer(0))).toEqual(
        new Uint8Array([1])
      );
      expect(new Uint8Array(images.get(second) ?? new ArrayBuffer(0))).toEqual(
        new Uint8Array([2])
      );
    }
  );
});
