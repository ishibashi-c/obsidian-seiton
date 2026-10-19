# UI Labと本番画面の対応表

UIを変更する開発者向けの参照表。`npm run harness`でUI Labを起動し、`http://localhost:5178/`に以下のクエリを付ける。ルートの定義は[`harness/index.ts`](../harness/index.ts)にある。

## 本番と同じコンポーネントを確認する

UIの正本は`src/ui/`。本番とUI Labは同じReactコンポーネントを描画し、Vaultデータとホスト操作をadapterで差し替える。接続は[`mountSeitonApp.tsx`](../src/app/mountSeitonApp.tsx)、Obsidian連携は[`productionAdapter.ts`](../src/platform/obsidian/productionAdapter.ts)を参照する。

| 画面 | UIの入口（`src/ui/`からの相対パス） | クエリ |
|---|---|---|
| ホーム | `screens/react-home-prototype.tsx` | `?view=home` |
| ライブラリ | `screens/react-library-prototype.tsx` | `?view=library` |
| 検索 | `screens/react-search-prototype.tsx` | `?view=search` |
| 整理 | `screens/react-organize-prototype.tsx` | `?view=organize` |
| つぶやき振り返り | `screens/react-memo-prototype.tsx` | `?view=memo` |
| 本棚 | `screens/react-bookshelf-prototype.tsx` | `?view=bookshelf` |
| 新規作成 | `screens/react-create-prototype.tsx` | `?view=create` |
| オンボーディング | `screens/react-onboarding-prototype.tsx`、`patterns/OnboardingFlow.tsx` | `?view=react-onboarding` |
| 設定・モーダル・共通部品 | `screens/react-supporting-prototype.tsx` | `?view=react-supporting` |

`?view=onboarding`はObsidianのダイアログ経路を確認する入口。`?view=react-onboarding`のページ表示とは区別する。ホームから新規作成までの7画面には`react-`付きの別名もある。

## 状態別の確認にはfixtureを使う

`fixture`でシードデータや失敗状態、`lang`で言語を指定する。たとえば`?view=organize&fixture=proposal-review`は整理案・保留・一括確認、`?view=bookshelf&fixture=book-operation-errors&lang=de`はドイツ語の本棚操作失敗を確認するための設定。利用できるfixtureは[`harness/index.ts`](../harness/index.ts)に記載されている。

画面名やデータ用語は[仕様のProduct map](../spec.md#4-product-map)と[Information model](../spec.md#3-information-model)、UIの設計方針は[DESIGN.md](../DESIGN.md)を参照する。

## 検証結果は作業日と対象を添えて記録する

検証条件は[AGENTS.md](../AGENTS.md#verification)に従う。UI Labの表示とtest-vaultへの配備、ネイティブObsidianの操作確認は別々に記録する。
