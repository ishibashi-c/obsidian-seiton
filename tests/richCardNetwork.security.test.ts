import type { RequestUrlResponse, TFile, Vault } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestRichCardUrl } from "../src/platform/obsidian/richCardRequest";
import { RichCardStore } from "../src/platform/obsidian/richCardStore";
import { updateWebClipTitle } from "../src/platform/obsidian/webClipStore";
import {
  cacheMetadataPath,
  isRichCardDomainDisabled,
  type RichCardMetadata,
} from "../src/shared/richCard";

const page = "https://allowed.test/article";
const metadata: RichCardMetadata = {
  canonicalUrl: null,
  description: "Description",
  domain: "allowed.test",
  iconUrl: "https://blocked.test/icon.png",
  imageUrl: "https://blocked.test/image.png",
  siteName: null,
  title: "Page",
  url: page,
};
function memoryVault() {
  const files = new Map<string, string>();
  const writeBinary = vi.fn(async () => undefined);
  const vault = {
    adapter: {
      exists: async (path: string) => files.has(path),
      getResourcePath: (path: string) => `app://local/${path}`,
      list: async () => ({ files: [] }),
      mkdir: async () => undefined,
      read: async (path: string) => files.get(path) ?? "",
      trashLocal: async (path: string) => {
        files.delete(path);
      },
      write: async (path: string, text: string) => {
        files.set(path, text);
      },
      writeBinary,
    },
  } as unknown as Vault;
  return { files, vault, writeBinary };
}
function response(
  text: string,
  status = 200,
  headers: Record<string, string> = {}
) {
  return {
    arrayBuffer: new TextEncoder().encode(text).buffer,
    headers,
    json: null,
    status,
    text,
  } as RequestUrlResponse;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("rich-card cache cleanup", () => {
  it("coalesces concurrent cleanup and tolerates a cache file trashed by another task", async () => {
    const paths = [".seiton/cache/stale.json"];
    let resolveTrash: (() => void) | undefined;
    const adapter = {
      list: vi.fn(async () => ({ files: paths })),
      stat: vi.fn(async () => ({
        ctime: 0,
        mtime: 0,
        size: 10,
        type: "file" as const,
      })),
      trashLocal: vi.fn(async () => {
        await new Promise<void>((resolve) => {
          resolveTrash = resolve;
        });
        throw new Error("File was already moved by another cleanup");
      }),
    };
    const vault = { adapter } as unknown as Vault;
    const store = new RichCardStore(vault, { maxAgeDays: 0 });

    const first = store.cleanup(100_000);
    const second = store.cleanup(100_000);
    await vi.waitFor(() => expect(adapter.trashLocal).toHaveBeenCalledOnce());
    resolveTrash?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(adapter.list).toHaveBeenCalledOnce();
    expect(adapter.trashLocal).toHaveBeenCalledOnce();
  });
});

describe("rich-card network policy", () => {
  it.each([
    "https://BLOCKED.test:8443/path",
    "https://user@blocked.test/path",
    "blocked.test.",
  ])("normalizes %s like a request hostname", (entry) => {
    expect(
      isRichCardDomainDisabled("https://sub.blocked.test/path", [entry])
    ).toBe(true);
    expect(
      isRichCardDomainDisabled("https://blocked.test.allowed.test/path", [
        entry,
      ])
    ).toBe(false);
  });
  it("normalizes Unicode hostnames", () => {
    expect(
      isRichCardDomainDisabled("https://xn--r8jz45g.xn--zckzah/", [
        "例え.テスト",
      ])
    ).toBe(true);
  });
  it("uses a redirect-rejecting transport and never the native redirect follower under a policy", async () => {
    const native = vi.spyOn(await import("obsidian"), "requestUrl");
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("<title>Direct page</title>"));
    vi.stubGlobal("fetch", fetcher);
    const result = await requestRichCardUrl(page, () => ["blocked.test"]);
    expect(result.text).toContain("Direct page");
    expect(fetcher).toHaveBeenCalledWith(
      page,
      expect.objectContaining({
        credentials: "omit",
        mode: "cors",
        redirect: "error",
      })
    );
    expect(native).not.toHaveBeenCalled();
  });
  it.each([
    "https://blocked.test/",
    "https://sub.blocked.test/",
    "file:///private.txt",
  ])("rejects %s before either transport", async (url) => {
    const native = vi.spyOn(await import("obsidian"), "requestUrl");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      requestRichCardUrl(url, () => ["blocked.test"])
    ).rejects.toThrow();
    expect(native).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retains normal native requests and relative redirects without restrictions", async () => {
    const native = vi
      .spyOn(await import("obsidian"), "requestUrl")
      .mockResolvedValueOnce(response("", 302, { Location: "/next" }))
      .mockResolvedValueOnce(response("<title>Next</title>"));
    expect((await requestRichCardUrl(page, () => [])).text).toContain("Next");
    expect(native).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: "https://allowed.test/next" })
    );
  });
  it("bounds visible redirect loops without an extra request", async () => {
    const native = vi
      .spyOn(await import("obsidian"), "requestUrl")
      .mockResolvedValue(response("", 302, { location: "/loop" }));
    await expect(requestRichCardUrl(page, () => [])).rejects.toThrow(
      "Too many"
    );
    expect(native).toHaveBeenCalledTimes(5);
  });
  it("falls back to a URL card on redirect/CORS failure without rendering remote assets", async () => {
    const f = memoryVault();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("redirect or CORS"))
    );
    const native = vi.spyOn(await import("obsidian"), "requestUrl");
    const store = new RichCardStore(f.vault, {
      disabledDomains: ["blocked.test"],
    });
    const card = await store.fetch(page);
    expect(card.url).toBe(page);
    expect(card.title).toBe("allowed.test");
    expect(card.imageUrl).toBeNull();
    expect(card.iconUrl).toBeNull();
    expect(native).not.toHaveBeenCalled();
    expect(store.allowsRemoteAssets()).toBe(false);
  });
  it("filters denied image and icon metadata before any image request", async () => {
    const f = memoryVault();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          '<title>Page</title><meta property="og:image" content="https://blocked.test/image.png"><link rel="icon" href="https://blocked.test/icon.png">'
        )
      );
    vi.stubGlobal("fetch", fetcher);
    const store = new RichCardStore(f.vault, {
      disabledDomains: ["blocked.test"],
    });
    const card = await store.fetch(page);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(card.imageUrl).toBeNull();
    expect(card.iconUrl).toBeNull();
    expect(f.writeBinary).not.toHaveBeenCalled();
  });
  it("caches a permitted direct image and serves it locally", async () => {
    const f = memoryVault();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            '<title>Page</title><meta property="og:image" content="https://images.allowed.test/image.png">'
          )
        )
        .mockResolvedValueOnce(
          new Response(new Uint8Array([1, 2]), {
            headers: { "content-type": "image/png" },
          })
        )
    );
    const store = new RichCardStore(f.vault, {
      disabledDomains: ["blocked.test"],
    });
    const card = await store.fetch(page);
    expect(card.imageUrl).toMatch(/^app:\/\/local\//);
    expect(f.writeBinary).toHaveBeenCalledOnce();
  });
  it("rechecks old cache provenance and notifies mounted cards after a policy change", async () => {
    const f = memoryVault();
    f.files.set(
      cacheMetadataPath(page),
      JSON.stringify({
        ...metadata,
        cacheVersion: 3,
        fetchedAt: Date.now(),
        imagePath: ".seiton/cache/image.png",
      })
    );
    const store = new RichCardStore(f.vault);
    const card = await store.get(page);
    expect(card?.imageUrl).toMatch(/^app:/);
    const changed = vi.fn();
    const stop = store.subscribe(changed);
    store.updateOptions({ disabledDomains: ["blocked.test"] });
    expect(changed).toHaveBeenCalledOnce();
    expect(store.sanitize(card as RichCardMetadata).imageUrl).toBeNull();
    expect((await store.get(page))?.imageUrl).toBeNull();
    expect((await store.get(page))?.iconUrl).toBeNull();
    stop();
  });
  it("rechecks policy after an in-flight response and before the next request", async () => {
    const f = memoryVault();
    let resolve: (value: Response) => void = () => undefined;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    const fetcher = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetcher);
    const store = new RichCardStore(f.vault, {
      disabledDomains: ["other.test"],
    });
    const operation = store.fetch(page);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    store.updateOptions({ disabledDomains: ["blocked.test"] });
    resolve(
      new Response(
        '<title>Page</title><meta property="og:image" content="https://blocked.test/image.png">'
      )
    );
    expect((await operation).imageUrl).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("checks the actual source reread by title fetching", async () => {
    const f = memoryVault();
    const rename = vi.fn();
    Object.assign(f.vault, {
      read: async () => "---\nsource: https://blocked.test/changed\n---\n",
      rename,
    });
    const native = vi.spyOn(await import("obsidian"), "requestUrl");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const store = new RichCardStore(f.vault, {
      disabledDomains: ["blocked.test"],
    });
    const file = { path: "Clip.md" } as TFile;
    await updateWebClipTitle(f.vault, file, (source) =>
      store.fetchHtml(source)
    );
    expect(native).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });
});
