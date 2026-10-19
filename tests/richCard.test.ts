/** リッチカード純関数のテスト（spec §7: 画像5段階・キャッシュ削除計算） */
import { describe, expect, it } from "vitest";
import {
  cacheKey,
  cacheMetadataPath,
  cachePathsToDelete,
  extractFirstHttpUrl,
  extractRichCardMetadata,
  isRichCardDomainDisabled,
  isRichCardFolderTarget,
  normalizeRichCardDomains,
} from "../src/shared/richCard";

describe("richCard", () => {
  it("画像候補は5段階の優先順位で選ぶ", () => {
    const html = [
      "<meta property='og:image' content='https://a.com/og.png'>",
      "<meta name='twitter:image' content='https://a.com/tw.png'>",
      "<link rel='image_src' href='https://a.com/src.png'>",
      "<img src='/content.png'>",
      "<link rel='apple-touch-icon' href='https://a.com/icon.png'>",
    ].join("");
    const meta = extractRichCardMetadata(html, "https://a.com/page");
    expect(meta.imageUrl).toBe("https://a.com/og.png");
  });

  it("og:imageがなければtwitter:image、次にimage_src", () => {
    const html =
      "<meta name='twitter:image' content='https://b.com/tw.png'><link rel='image_src' href='https://b.com/src.png'>";
    expect(extractRichCardMetadata(html, "https://b.com/").imageUrl).toBe(
      "https://b.com/tw.png"
    );
    expect(
      extractRichCardMetadata(
        "<link rel='image_src' href='src2.png'>",
        "https://b.com/x"
      ).imageUrl
    ).toBe("https://b.com/src2.png");
  });

  it("コンテンツ画像とapple-touch-iconも拾う", () => {
    const content = extractRichCardMetadata(
      "<img src='pic.png'>",
      "https://c.com/"
    );
    expect(content.imageUrl).toBe("https://c.com/pic.png");
    const icon = extractRichCardMetadata(
      "<link rel='apple-touch-icon' href='icon.png'>",
      "https://c.com/"
    );
    expect(icon.imageUrl).toBe("https://c.com/icon.png");
  });

  it("タイトルはog:title→titleタグ→ドメインの順", () => {
    expect(
      extractRichCardMetadata(
        "<meta property='og:title' content='OG'>",
        "https://d.com/"
      ).title
    ).toBe("OG");
    expect(
      extractRichCardMetadata("<title>Page</title>", "https://d.com/").title
    ).toBe("Page");
    expect(extractRichCardMetadata("", "https://d.com/").title).toBe("d.com");
  });

  it("説明・サイト名・canonical・faviconを公開メタデータから取り出す", () => {
    const meta = extractRichCardMetadata(
      [
        "<meta property='og:title' content='Card title'>",
        "<meta property='og:description' content='A short description'>",
        "<meta property='og:site_name' content='Example'>",
        "<link rel='canonical' href='/canonical'>",
        "<link rel='icon' href='/favicon.png'>",
      ].join(""),
      "https://d.com/page"
    );
    expect(meta.description).toBe("A short description");
    expect(meta.siteName).toBe("Example");
    expect(meta.canonicalUrl).toBe("https://d.com/canonical");
    expect(meta.iconUrl).toBe("https://d.com/favicon.png");
  });

  it("遅延画像とsrcsetを通常画像の代替候補として拾う", () => {
    expect(
      extractRichCardMetadata("<img data-src='/lazy.jpg'>", "https://e.com/")
        .imageUrl
    ).toBe("https://e.com/lazy.jpg");
    expect(
      extractRichCardMetadata(
        "<img srcset='/small.jpg 480w, /large.jpg 1200w'>",
        "https://e.com/"
      ).imageUrl
    ).toBe("https://e.com/small.jpg");
  });

  it("DOMのmeta属性がpropertyとnameを併記していても画像を拾う", () => {
    const meta = extractRichCardMetadata(
      '<meta property="og:image" name="og:image" content="/article.png"><meta property="og:title" name="og:title" content="Article">',
      "https://zenn.dev/example"
    );
    expect(meta.title).toBe("Article");
    expect(meta.imageUrl).toBe("https://zenn.dev/article.png");
  });

  it("相対URLを絶対化し、javascript:等は拒否", () => {
    const meta = extractRichCardMetadata(
      "<img src='//cdn.e.com/i.png'>",
      "https://e.com/"
    );
    expect(meta.imageUrl).toBe("https://cdn.e.com/i.png");
    expect(
      extractRichCardMetadata(
        "<img src='javascript:alert(1)'>",
        "https://e.com/"
      ).imageUrl
    ).toBeNull();
  });

  it("本文から最初のHTTP URLを取り出す", () => {
    expect(extractFirstHttpUrl("見て https://x.com/a これ")).toBe(
      "https://x.com/a"
    );
    expect(extractFirstHttpUrl("なし")).toBeNull();
  });

  it("Markdownリンクのリンク先URLを取り出す", () => {
    expect(
      extractFirstHttpUrl(
        "[https://www.mcdonalds.co.jp/](https://www.mcdonalds.co.jp/)"
      )
    ).toBe("https://www.mcdonalds.co.jp/");
  });

  it("対象フォルダ判定はプレフィックス一致", () => {
    expect(
      isRichCardFolderTarget("Seiton/readings/note.md", ["Seiton/readings"])
    ).toBe(true);
    expect(isRichCardFolderTarget("Seiton/other/note.md", ["readings"])).toBe(
      false
    );
    expect(
      isRichCardFolderTarget("Seiton/readings-x/n.md", ["Seiton/readings"])
    ).toBe(false);
    expect(isRichCardFolderTarget("a.md", [])).toBe(false);
  });

  it("無効domainは正規化し完全一致とsubdomainだけを止める", () => {
    expect(
      normalizeRichCardDomains([
        " HTTPS://Example.COM/path ",
        ".example.com",
        "",
      ])
    ).toEqual(["example.com"]);
    expect(
      isRichCardDomainDisabled("https://example.com/a", ["example.com"])
    ).toBe(true);
    expect(
      isRichCardDomainDisabled("https://sub.example.com/a", ["example.com"])
    ).toBe(true);
    expect(
      isRichCardDomainDisabled("https://example.com.evil.test/a", [
        "example.com",
      ])
    ).toBe(false);
    expect(isRichCardDomainDisabled("invalid", [])).toBe(true);
  });

  it("キャッシュキーはURLごとに一意でパスは固定フォルダ配下", () => {
    const k1 = cacheKey("https://a.com/");
    const k2 = cacheKey("https://b.com/");
    expect(k1).not.toBe(k2);
    expect(cacheMetadataPath("https://a.com/")).toBe(
      `.seiton/cache/${k1}.json`
    );
  });

  it("期限切れと容量超過の両方で削除対象を計算する", () => {
    const now = 1_000_000_000_000;
    const day = 24 * 60 * 60 * 1000;
    const entries = [
      { modified: now - 40 * day, path: "old.json", size: 100 },
      { modified: now - 1 * day, path: "new.json", size: 100 },
      { modified: now - 1 * day, path: "new.img", size: 200 },
    ];
    // 期限切れのみ削除
    expect(cachePathsToDelete(entries, 10_000, 30, now)).toEqual(["old.json"]);
    // 容量超過（maxBytes=150・総400）: 古い順に old.json→new.json→new.img と削除して初めて150以下になる
    expect(cachePathsToDelete(entries, 150, 30, now)).toEqual([
      "old.json",
      "new.json",
      "new.img",
    ]);
  });
});
