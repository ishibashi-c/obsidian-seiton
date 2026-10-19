import { describe, expect, it } from "vitest";
import {
  assertCompleteDictionaries,
  detectLang,
  LANGS,
  t,
} from "../src/shared/i18n";

describe("i18n", () => {
  it("replaces both legacy double-brace and single-brace parameters", () => {
    expect(t("ja", "organize.remaining", { count: "3" })).toBe("残り 3 件");
  });
  it("全言語でキーセットが一致する", () => {
    expect(assertCompleteDictionaries()).toEqual([]);
  });

  it("整理画面・メモ振り返り・タグ候補の文言を全対応言語で表示する", () => {
    const keys = [
      "organize.applyItem",
      "organize.archiveItem",
      "organize.archived",
      "organize.currentType",
      "organize.emptyHint",
      "organize.inbox",
      "organize.keyboardHint",
      "organize.laterItem",
      "organize.laterMoved",
      "organize.laterNoChange",
      "organize.reload",
      "organize.reloadCount",
      "organize.reloadFailed",
      "book.bulkEditUpdated",
      "book.bulkEditPartial",
      "organize.saveFailed",
      "organize.saved",
      "organize.tagsPlaceholder",
      "organize.typeOptional",
      "organize.typePlaceholder",
      "tags.add",
      "tags.suggestions",
      "memoReview.requiredFields",
      "memoReview.saveSuccess",
      "memoReview.saveFailed",
      "memoReview.deleteSuccess",
      "memoReview.deleteFailed",
      "memoReview.keepSuccess",
      "memoReview.keepFailed",
    ] as const;

    for (const lang of LANGS) {
      for (const key of keys) {
        expect(
          t(lang, key, {
            count: "2",
            failed: "1",
            tag: "AI",
            title: "UI Lab",
            type: t(lang, "type.article"),
            updated: "1",
          })
        ).not.toBe(key);
      }
    }

    expect(t("de", "organize.applyItem", { title: "UI Lab" })).toBe(
      "UI Lab ordnen"
    );
    expect(t("de", "tags.add", { tag: "AI" })).toBe("AI hinzufügen");
    expect(t("de", "memoReview.requiredFields")).toBe(
      "Gib ein Datum, eine Uhrzeit und einen Inhalt ein."
    );
    expect(t("ja", "organize.reloadCount", { count: "2" })).toBe(
      "未整理の項目を2件読み込みました"
    );
  });

  it("新規作成の補足・検証メッセージを表示言語に合わせる", () => {
    const languages = [
      "ja",
      "en",
      "zh-CN",
      "ko",
      "es",
      "pt-BR",
      "fr",
      "de",
    ] as const;
    const keys = [
      "new.folderHintWithPath",
      "new.titleHint",
      "new.memoAppendMarker",
      "new.tagsOptional",
      "new.subfolderParentError",
      "new.subfolderInvalidError",
    ] as const;

    for (const lang of languages) {
      for (const key of keys) {
        expect(
          t(lang, key, { folder: "Seiton/articles", type: "Article" })
        ).not.toBe(key);
      }
    }

    expect(
      t("de", "new.folderHintWithPath", { folder: "Seiton/articles" })
    ).toBe("Wähle einen Unterordner in Seiton/articles.");
    expect(t("de", "new.titleHint", { type: t("de", "type.article") })).toBe(
      "Gib den Titel für eine Notiz vom Typ Artikel ein."
    );
    expect(t("de", "new.memoAppendMarker")).toBe("(wird angehängt)");
    expect(t("de", "new.tagsOptional")).toBe("Tags (optional)");
    expect(t("de", "new.subfolderParentError")).toContain("(..)");
    expect(t("ja", "new.subfolderInvalidError")).toContain("別の名前");
  });

  it("日本語で取得できる", () => {
    expect(t("ja", "memo.save")).toBe("保存");
    expect(t("ja", "home.title")).toBe("ホーム");
    expect(t("ja", "type.collection")).toBe("コレクション");
    for (const lang of LANGS) {
      expect(t(lang, "type.collection")).not.toBe("type.collection");
    }
  });

  it("作成タイプの用途と整理軸の説明を全言語で表示する", () => {
    const keys = [
      "new.typePurpose.class",
      "new.typePurpose.task",
      "new.typePurpose.reading",
      "new.typePurpose.idea",
      "new.typePurpose.article",
      "new.typePurpose.project",
      "new.typePurpose.webclip",
      "new.typePurpose.collection",
      "new.typePurpose.memo",
      "new.typePurpose.profile",
      "organize.tagsHint",
      "organize.listsHint",
    ] as const;

    for (const lang of LANGS) {
      for (const key of keys) {
        expect(t(lang, key)).not.toBe(key);
      }
    }

    expect(t("ja", "view.list")).toBe("一覧表示");
    expect(t("ja", "organize.tags")).toBe("タグ");
  });

  it("新規作成フォームの戻る文言は実際の遷移先に合わせる", () => {
    for (const lang of LANGS) {
      expect(t(lang, "new.back")).toBe(t(lang, "nav.backHome"));
    }
  });

  it("一言メモの保存失敗で入力保持と再試行を案内する", () => {
    const languages = [
      "ja",
      "en",
      "zh-CN",
      "ko",
      "es",
      "pt-BR",
      "fr",
      "de",
    ] as const;

    for (const lang of languages) {
      expect(t(lang, "memo.saveFailed")).not.toBe("memo.saveFailed");
    }

    expect(t("ja", "memo.saveFailed")).toBe(
      "一言メモを保存できませんでした。入力内容は残っています。もう一度お試しください。"
    );
    expect(t("de", "memo.saveFailed")).toBe(
      "Kurznotiz konnte nicht gespeichert werden. Ihre Eingabe bleibt erhalten. Bitte versuchen Sie es erneut."
    );
  });

  it("ホームの固定ラベル・説明・件数を表示言語に合わせる", () => {
    expect(t("de", "home.title")).toBe("Startseite");
    expect(t("de", "home.entry.searchDescription")).toBe("Notizen suchen");
    expect(t("de", "home.entry.libraryDescription")).toBe(
      "Nach Tag, Typ oder Liste suchen"
    );
    expect(t("de", "home.itemCountOne", { count: "1" })).toBe("1 Eintrag");
    expect(t("de", "home.itemCountMany", { count: "2" })).toBe("2 Einträge");
    expect(t("ja", "home.itemCountMany", { count: "2" })).toBe("2件");
  });

  it("ホームのショートカットとリスト操作を選択言語で表示する", () => {
    expect(t("de", "home.listCreateTitle")).toBe("Neue Liste");
    expect(t("de", "home.listNameLabel")).toBe("Listenname");
    expect(t("de", "home.listCreateFailed")).toBe(
      "Liste konnte nicht erstellt werden"
    );
    expect(t("de", "home.listNameDuplicate")).toBe(
      "Eine Liste mit diesem Namen gibt es bereits. Gib einen anderen Namen ein."
    );
    expect(t("ja", "home.listNameDuplicate")).toBe(
      "同じ名前のリストがあります。別の名前を入力してください。"
    );
    expect(t("de", "shortcut.editTitle")).toBe("Kurzbefehl bearbeiten");
    expect(t("de", "shortcut.editNamed", { title: "Google" })).toBe(
      "Google bearbeiten"
    );
    expect(t("de", "shortcut.groupShortcuts", { group: "Arbeit" })).toBe(
      "Verknüpfungen in Arbeit"
    );
    expect(t("de", "shortcut.add.typeTabsLabel")).toBe(
      "Typ des hinzuzufügenden Kurzbefehls"
    );
    expect(t("de", "action.update")).toBe("Aktualisieren");
    expect(t("de", "new.presetRootFolder")).toBe("Im Typordner");
    expect(t("de", "new.openFailed")).toBe(
      "Erstellungsansicht konnte nicht geöffnet werden"
    );
    expect(t("ja", "shortcut.closeGroup", { group: "仕事" })).toBe(
      "仕事を閉じる"
    );
  });

  it("ショートカットの表示順・グループ編集を全言語で案内する", () => {
    const languages = [
      "ja",
      "en",
      "zh-CN",
      "ko",
      "es",
      "pt-BR",
      "fr",
      "de",
    ] as const;

    for (const lang of languages) {
      expect(t(lang, "home.orderShortcuts")).not.toBe("home.orderShortcuts");
      expect(t(lang, "home.orderShortcutGroup")).not.toBe(
        "home.orderShortcutGroup"
      );
      expect(t(lang, "shortcut.noGroup")).not.toBe("shortcut.noGroup");
      expect(t(lang, "home.orderMoveUp", { section: "Google" })).not.toBe(
        "home.orderMoveUp"
      );
      expect(t(lang, "home.orderMoveDown", { section: "Google" })).not.toBe(
        "home.orderMoveDown"
      );
    }

    expect(t("ja", "home.orderShortcuts")).toBe(
      "ショートカットの順序とグループ"
    );
    expect(t("ja", "home.orderShortcutGroup")).toBe("グループ");
    expect(t("ja", "shortcut.noGroup")).toBe("グループなし");
    expect(t("de", "home.orderShortcuts")).toBe("Reihenfolge und Gruppen");
    expect(t("de", "home.orderShortcutGroup")).toBe("Gruppe");
    expect(t("de", "shortcut.noGroup")).toBe("Ohne Gruppe");
  });

  it("英語フォールバック", () => {
    expect(t("en", "memo.save")).toBe("Post");
  });

  it("書庫リストの列見出しを日本語と英語で取得できる", () => {
    expect(t("ja", "library.column.folder")).toBe("保存先");
    expect(t("en", "library.column.folder")).toBe("Folder");
    expect(t("ja", "library.column.updated")).toBe("更新日");
    expect(t("en", "library.column.updated")).toBe("Updated");
  });

  it("書庫の総件数と絞り込み後の件数を区別する", () => {
    expect(t("ja", "library.totalCount", { count: "59" })).toBe("登録数: 59件");
    expect(t("ja", "library.count", { count: "1" })).toBe("1件");
    expect(t("en", "library.countOne", { count: "1" })).toBe("1 item");
    expect(t("en", "library.count", { count: "2" })).toBe("2 items");
    expect(t("en", "library.totalCountOne", { count: "1" })).toBe(
      "Total in library: 1 item"
    );
    expect(t("en", "library.totalCount", { count: "59" })).toBe(
      "Total in library: 59 items"
    );
  });

  it("書庫の説明・操作・欠落日付を表示言語に合わせる", () => {
    const languages = [
      "ja",
      "en",
      "zh-CN",
      "ko",
      "es",
      "pt-BR",
      "fr",
      "de",
    ] as const;
    const keys = [
      "date.none",
      "library.actionsFor",
      "library.listUpdateFailed",
      "library.listUpdateSuccess",
      "library.noListsHint",
      "library.noPreview",
    ] as const;

    for (const lang of languages) {
      for (const key of keys) {
        expect(t(lang, key, { title: "嫌われる勇気" })).not.toBe(key);
      }
    }

    expect(t("de", "date.none")).toBe("Kein Datum");
    expect(t("de", "library.actionsFor", { title: "Clean Code" })).toBe(
      "Aktionen für Clean Code"
    );
    expect(t("de", "library.listUpdateFailed")).toBe(
      "Listen konnten nicht aktualisiert werden."
    );
    expect(t("de", "library.listUpdateSuccess")).toBe("Listen aktualisiert");
    expect(t("de", "library.noListsHint")).toContain("Einstellungen");
    expect(t("de", "library.noPreview")).toBe("Keine Textvorschau");
    expect(t("ja", "library.actionsFor", { title: "嫌われる勇気" })).toBe(
      "嫌われる勇気の操作"
    );
    expect(t("ja", "date.none")).toBe("日付なし");
    expect(t("de", "shortcut.kind.view")).toBe("Seiton-Ansicht");
  });

  it("プレースホルダーを置換する", () => {
    const ja = t("ja", "empty.noSearch", { count: "3" });
    expect(ja).toContain("3");
  });

  it("検索対象件数は結果件数と誤解しない表現にする", () => {
    expect(t("ja", "search.indexCount", { count: "73" })).toBe(
      "検索対象: 73件"
    );
    expect(t("en", "search.indexCount", { count: "73" })).toBe(
      "Search scope: 73 items"
    );
  });

  it("検索の日付範囲エラーを各言語で説明する", () => {
    expect(t("ja", "search.invalidDateRange")).toBe(
      "開始日は終了日以前の日付を選んでください。"
    );
    expect(t("en", "search.invalidDateRange")).toBe(
      "Choose a start date on or before the end date."
    );
  });

  it("本棚の検索失敗と候補0件を区別し、回復方法を案内する", () => {
    expect(t("ja", "book.searchFailed")).toContain("再試行");
    expect(t("ja", "book.searchFailed")).toContain("手入力");
    expect(t("en", "book.searchFailed")).toContain("Retry");
    expect(t("en", "book.searchFailed")).toContain("manual entry");
    expect(t("ja", "book.noCandidates")).toContain("候補が見つかりません");
  });

  it("本棚追加previewの固定ラベルを表示言語に合わせる", () => {
    expect(t("ja", "book.candidateNumber", { count: "2" })).toBe("2件目");
    expect(t("de", "book.candidate")).toBe("Kandidat");
    expect(t("de", "book.candidateNumber", { count: "2" })).toBe("Kandidat 2");
    expect(t("de", "book.category")).toBe("Kategorie");
    expect(t("de", "book.listsOptional")).toBe("Listen (optional)");
    expect(t("de", "book.seriesOptional")).toBe("Reihe (optional)");
    expect(t("de", "book.seriesPlaceholder")).toBe("z. B. Reihenname");
  });

  it("検索・書庫の案内文と演算子表記を表示言語に合わせる", () => {
    expect(t("ja", "search.noResults")).toBe("一致する項目がありません。");
    expect(t("en", "search.noResults")).toBe("No matching items.");
    expect(t("ja", "search.noResultsHint")).toContain("検索設定");
    expect(t("en", "search.noResultsHint")).toContain("Settings");
    expect(t("ja", "search.operatorHint")).toBe("検索演算子");
    expect(t("en", "search.operatorHint")).toBe("Search operators");
    expect(t("ja", "search.operatorTag")).toBe("tag:タグ");
    expect(t("en", "search.operatorPhrase")).toBe('"exact phrase"');
    expect(t("ja", "library.noResultsHint")).toContain("条件をクリア");
    expect(t("en", "library.noResultsHint")).toContain("clear");
    expect(t("ja", "library.noTagsHint")).toContain("表示できるタグ");
    expect(t("en", "library.noTagsHint")).toContain("No tags");
  });

  it("検索結果の省略タグ数を読み上げ用に翻訳する", () => {
    expect(t("ja", "search.additionalTags", { count: "1" })).toBe("他1件");
    expect(t("en", "search.additionalTags", { count: "1" })).toBe("1 more");
  });

  it("検索履歴の削除操作を各言語で説明する", () => {
    expect(t("ja", "search.history")).toBe("検索履歴");
    expect(t("ja", "search.clearHistory")).toBe("履歴をすべて削除");
    expect(t("ja", "search.removeHistoryItem", { query: "AI ノート" })).toBe(
      "検索履歴「AI ノート」を削除"
    );
    expect(t("en", "search.removeHistoryItem", { query: "AI notes" })).toBe(
      "Remove “AI notes” from search history"
    );
    expect(t("ja", "search.historySaveFailed")).toContain("もう一度");
  });

  it("一言メモの空状態はこの画面の回復操作を案内する", () => {
    expect(t("ja", "memoReview.emptyHint")).toBe(
      "検索語を消すか、前後の期間を確認してください。"
    );
    expect(t("ja", "memoReview.emptyHint")).not.toContain("アーカイブ");
    expect(t("en", "memoReview.emptyHint")).toContain(
      "previous and next periods"
    );
  });

  it("一言メモの件数を表示言語の単位と単複で表示する", () => {
    const languages = [
      "ja",
      "en",
      "zh-CN",
      "ko",
      "es",
      "pt-BR",
      "fr",
      "de",
    ] as const;

    for (const lang of languages) {
      expect(t(lang, "memoReview.countOne", { count: "1" })).not.toBe(
        "memoReview.countOne"
      );
      expect(t(lang, "memoReview.countMany", { count: "2" })).not.toBe(
        "memoReview.countMany"
      );
      expect(t(lang, "memoReview.searchPlaceholder")).not.toBe(
        "memoReview.searchPlaceholder"
      );
    }

    expect(t("ja", "memoReview.countMany", { count: "2" })).toBe("2件");
    expect(t("en", "memoReview.countOne", { count: "1" })).toBe("1 memo");
    expect(t("en", "memoReview.countMany", { count: "2" })).toBe("2 memos");
    expect(t("de", "memoReview.countOne", { count: "1" })).toBe("1 Kurznotiz");
    expect(t("de", "memoReview.countMany", { count: "2" })).toBe(
      "2 Kurznotizen"
    );
    expect(t("de", "memoReview.searchPlaceholder")).toBe(
      "Text oder Tags suchen"
    );
  });

  it("一言メモの削除でゴミ箱から内容を復元できることを伝える", () => {
    expect(t("ja", "confirm.deleteMemoHint")).toContain("ゴミ箱");
    expect(t("ja", "confirm.deleteMemoHint")).toContain("別ノート");
    expect(t("en", "confirm.deleteMemoHint")).toContain("trash");
  });

  it("整理の保存先説明はタイプ変更時の移動先を区別する", () => {
    expect(t("ja", "organize.destinationHint")).toContain("タイプを変更せず");
    expect(t("ja", "organize.typeFolderHint")).toContain("タイプ別フォルダ");
    expect(t("ja", "organize.typeFolder")).toBe("タイプ別フォルダを使う");
    expect(t("en", "organize.typeFolderHint")).toContain("type folder");
  });

  it("本棚の一括編集対象とフィルター外の選択を明示する", () => {
    expect(t("ja", "book.bulkEditSummary", { count: "2" })).toContain("2冊");
    expect(t("ja", "book.hiddenSelection", { count: "1" })).toContain("1冊");
    expect(t("en", "book.reviewSelection")).toBe("Review selected books");
  });

  it("本棚の追加・編集ダイアログの共通操作を表示言語に合わせる", () => {
    expect(t("de", "book.bulkEditTitle")).toBe("Ausgewählte Bücher bearbeiten");
    expect(t("de", "book.noChange")).toBe("Keine Änderung");
    expect(t("de", "book.markRead")).toBe("Als gelesen markieren");
    expect(t("de", "book.addToListOption", { list: "Lesen" })).toBe(
      "Zu Lesen hinzufügen"
    );
    expect(t("de", "book.editTitleFor", { title: "Clean Code" })).toBe(
      "Buch bearbeiten · Clean Code"
    );
    expect(t("de", "book.readingStatus")).toBe("Lesestatus");
    expect(t("de", "action.applyChanges")).toBe("Änderungen übernehmen");
    expect(t("ja", "book.bulkEditReadDateHint")).toContain("今日の日付");
    expect(t("en", "book.addMethodsSummary")).toContain("manual entry");
  });

  it("本棚の固定UIと動的アクセシブル名を表示言語に合わせる", () => {
    expect(t("de", "book.ratingFilter")).toBe("Nach Bewertung filtern");
    expect(t("de", "book.ratingFilterAll")).toBe("Alle Bewertungen");
    expect(t("de", "book.resultsCount", { count: "7" })).toBe("7 angezeigt");
    expect(t("de", "book.resultsSummary", { count: "7" })).toBe(
      "Leseaufzeichnungen, 7 angezeigt"
    );
    expect(t("de", "book.openTitle", { title: "嫌われる勇気" })).toBe(
      "嫌われる勇気 öffnen"
    );
    expect(t("de", "book.authorMissing")).toBe("Keine Autorenangabe");
    expect(t("de", "book.completionDateMissing")).toBe("Kein Abschlussdatum");
    expect(t("de", "book.authorOptional")).toBe("Autor (optional)");
    expect(t("de", "book.isbnOptional")).toBe("ISBN (optional)");
    expect(t("de", "book.list.columnSelection")).toBe("Auswahl");
    expect(t("ja", "book.openTitle", { title: "嫌われる勇気" })).toBe(
      "嫌われる勇気を開く"
    );
  });

  it("本棚の操作失敗通知を8言語で表示する", () => {
    for (const lang of [
      "ja",
      "en",
      "zh-CN",
      "ko",
      "es",
      "pt-BR",
      "fr",
      "de",
    ] as const) {
      expect(t(lang, "book.openFailed")).not.toBe("book.openFailed");
      expect(t(lang, "book.coverRemoveFailed")).not.toBe(
        "book.coverRemoveFailed"
      );
      expect(t(lang, "book.supplementFailed")).not.toBe(
        "book.supplementFailed"
      );
    }
    expect(t("de", "book.openFailed")).toBe(
      "Das Buch konnte nicht geöffnet werden."
    );
    expect(t("ja", "book.coverRemoveFailed")).toBe(
      "表紙キャッシュを削除できませんでした。"
    );
    expect(t("en", "book.supplementFailed")).toBe(
      "Could not fill in missing book information."
    );
  });

  it("言語判定", () => {
    expect(detectLang("ja-JP")).toBe("ja");
    expect(detectLang("zh-TW")).toBe("zh-CN");
    expect(detectLang("pt-BR")).toBe("pt-BR");
    expect(detectLang("fr-CA")).toBe("fr");
    expect(detectLang("xx-YY")).toBe("en");
  });
});
