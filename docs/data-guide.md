# Seiton data guide for external agents

外部ツールが利用者のVault内のSeitonデータを直接操作するときの契約。Seiton専用ツールは不要で、Markdownとfrontmatterを扱う。

このリポジトリの開発作業ではなく、利用者のVaultを変更するときだけ読む。製品仕様は[`../spec.md`](../spec.md)を参照する。

## Safety sequence

1. 対象Vault、Seitonルート、対象フォルダを読み取り専用で確認する
2. 既存の`AGENTS.md`とSeiton設定を確認する
3. 10〜30件の小さな単位で変更案を作る
4. dry-runとして対象、変更前後、曖昧な項目を提示する
5. ユーザー承認後に適用する
6. frontmatter、リンク、移動先、件数を再読して確認する

明示的な依頼がない限り削除しない。整理では`status: archive`を優先する。既存の未知キー、本文、リンクを保持する。

## Common schema

```yaml
---
type: webclip
tags: [テック/AI]
sourceTags: [zenn]
lists: [調べたい]
status: inbox
created: 2026-08-24T10:00:00+09:00
source: https://example.com/article
---
```

### Required values

- `type`: `class` / `task` / `reading` / `idea` / `article` / `project` / `webclip` / `collection` / `memo` / `profile`
- `status`: `inbox` / `active` / `archive`
- `created`: ISO 8601

`source`はクリップ元URL。`tags`は内容、`sourceTags`は取得元・形式、`lists`は複数ノートを束ねるユーザー選択の集合を表す。`collection`は、作品や参照先などの項目を一つのノートへ継続して追記するタイプであり、`lists`とは使い分ける。既定の保存先は`<rootFolder>/collections/`。`bookCategory`は本棚の基幹カテゴリ、`bookSeries`は任意のシリーズ・テーマ名で、`type: reading`のノートだけに使用する。

### Compatibility window

現行実装は`sourceTags`の旧名として`baseTags`を使っている。`sourceTags`移行がロードマップ上で完了するまでは、既存ノートが使うキーを維持し、両方を同時に増殖させない。移行後は読込時に両方を受け付け、書込時に`sourceTags`へ統一する。

## File rules

- 基本ファイル名は`タイトル.md`
- `/ \ : * ? " < > |`を除去する
- 重複時は`タイトル 2.md`のように連番を付ける
- タイプ変更時は、設定されたタイプ別フォルダへ移動する
- ライブラリからのフォルダ作成・改名とノート移動は、同じタイプの保存領域内だけで行う
- タイプ別保存領域そのものは保護し、異なるタイプのノートを混在させない
- `type: reading`の新規作成・カテゴリ変更時は、設定された本棚フォルダの下に`bookCategory`と同名のカテゴリフォルダを作り、同じカテゴリ名を`tags`にも追加する
- 未選択タイプのフォルダを先回りして作らない
- 移動前に同名ファイルとリンク影響を確認する

## Supported operations

### Organize inbox

1. `status: inbox`だけを対象にする
2. 本文と元URLを確認し、少数の`tags`を主として提案する
3. 必要な場合だけ`lists`へ追加する
4. `type`は既存値を維持し、変更が必要な場合だけ明示的に変更する
5. タグ・リストだけを整理した場合は`status: active`へ変更するが、物理ファイルは未整理フォルダから移動しない
6. `type`を明示的に変更した場合だけ、承認後に`status: active`へ変更し、タイプ別フォルダへ移動する
7. 保存先プリセットを明示的に選んだ場合は、タイプ別フォルダ内の指定サブフォルダへ移動し、そのプリセットの既定タグを追加する。保存先未選択なら物理移動しない
8. 曖昧な分類は`inbox`のまま残す

未整理は異常状態ではない。全件整理を成功条件にしない。

### Tag existing folders

- ユーザーが指定したフォルダだけを対象にする
- 既存のObsidianタグと階層`親/子`を再利用する
- 大量の新規タグを一度に作らない
- タグエイリアスがある場合は正規名を使う
- タグ以外のfrontmatterを変更しない

### Lists and pinning

- 長期的な集合は`lists`へ追加する
- ピン留めはプラグイン設定の表示状態であり、frontmatterのリストとして捏造しない
- リスト名の新設は候補を示し、既存の近い名前を先に確認する

### Archive

- ノート単体のアーカイブは`status: archive`へ変更して`<rootFolder>/archive/<タイプ保存先名>/notes/`へ物理移動する。タイプ保存先からの相対階層、変更前のパス、変更前の`status`を記録し、Seitonのライブラリから復元する
- フォルダ文脈のアーカイブは、フォルダを`<rootFolder>/archive/<タイプ保存先名>/<元フォルダからの相対パス>`へ物理移動し、Seiton設定の`archiveFolderMoves`に元のパスと移動先を記録する。`archivedFolders`は各画面で除外する現在のVaultパスを保持する。ノートのfrontmatterや`status`は変更しない
- フォルダ文脈はタイプ別保存領域の配下であれば、授業・プロジェクト・テーマなど用途を問わずアーカイブできる
- 復元は記録済みの元パスへフォルダごと戻す。復元先に同名のファイルやフォルダがある場合は上書きせず停止する
- フォルダを復元しても、ノート単体の`status: archive`は解除しない
- Seiton UIからフォルダを改名する場合、ピン留め、フォルダショートカット、検索・リッチカードの保存先設定も新しいパスへ追従させる

### Organization proposal from an external AI

未整理ノートを整理するときは元ノートを書き換えず、次の形式のMarkdownを作成する。保存先はSeitonの表示言語に対応する`<rootFolder>/<整理案フォルダ>/`で、ファイル名は`YYYY-MM-DD.md`。同じ日付のファイルがあれば`YYYY-MM-DD-02.md`、`-03.md`のように連番を付ける。整理案フォルダはライブラリ・通常検索・フォルダアーカイブの対象外。

```yaml
---
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
      reason: "研究資料として関連ノートとまとめる"
  holds:
    - source: Seiton/inbox/unclear.md
      title: "判断を保留するノート"
      reason: "既存タイプに当てはめる根拠が足りない"
---
# 2026-09-24 の整理案

- organize-01: 研究資料として分類。タグとリストを追加。
```

- `source`はVault相対パスとし、`expected`には読み取った時点のメタデータを正確に記載する。対象は`status: inbox`のみ
- `version: 2`では、整理対象として確認した未整理ノートをすべて`operations`または`holds`の片方へ一度だけ記録する。件数はこの構造化データからSeitonが算出する。本文だけに件数や分類判断を書かない
- 各operationには短い`reason`を含める。`holds`の各項目には`source`と`reason`、任意で`title`を含める。既存タイプに自然に当てはまらない、または根拠が足りないノートは保留とし、無理にタイプを割り当てない
- `article`は利用者自身が執筆・構成する長文、`idea`は育てたい着想を表す。メールや画像などの形式だけを根拠にタイプを決めない
- `changes`には変更する項目だけを含める。`status`は必須で、`active`または`archive`。削除操作は作らない
- `destination`は結果タイプに対応する既存フォルダだけを指定する。フォルダを新規作成しない。保存先の変更が不要なら省略する。判断根拠が足りないノートはoperationから外し、理由を付けて`holds`へ記録する
- 既存ノートの本文、リンク、未知frontmatterキーを案や適用処理で書き換えない
- 判定できない項目はoperationに含めず、理由付きで`holds`へ記録する。Seitonの画面は整理案と保留を分けて表示し、整理件数・保留件数・確認時の対象件数を示す
- ユーザーはSeiton上で元の状態と変更案を確認し、1件ずつ、または選択した複数件を確認して反映する。反映直前に各元ノートの状態を再検証し、古い案や失敗があっても他の選択項目は独立して処理する。保留は反映されない
- `version: 1`の読み込みは後方互換で受け付ける。ただし本文にしかない保留や対象総数はSeitonが推定せず、画面で不明と表示する
- 適用結果は整理案ファイル内に記録される。元ノートの状態が提案後に変わっていた場合、Seitonは適用を拒否する

### Memo files

つぶやきは`<memosFolder>/YYYY-MM.md`へ追記する。

```markdown
---
type: memo
month: 2026-08
---
- 08:06 内容 #任意タグ
```

既存行の順序と不明な行を保持する。行内タグは任意で、無理に追加しない。つぶやきを独立ノートにする場合は元行を残し、必要なら作成先へのWikiリンクを追記する。

## Add a book from a title

書名だけで依頼された場合は次の順で情報を確認する。

1. 利用可能な書誌検索専用ツールまたはコネクター
2. 保存・表示・利用条件を確認できる公的・公開書誌API（Seiton内蔵はISBNならopenBD優先、Open Libraryが代替。書名検索はOpen Library）
3. 出版社・著者・図書館など信頼できるWeb情報
4. 一般Web検索

取得手段の規約を優先し、認証・課金・利用申請・creditが必要なら満たせないまま使用しない。Seiton本体が送信する項目と失敗時の扱いは[`privacy-and-network.md`](privacy-and-network.md)を参照する。

照合項目は書名、著者、出版社、出版年、ISBN。同名、翻訳違い、文庫・単行本・改訂版など複数候補が残る場合はユーザーへ確認する。情報を推測で埋めない。

確定後は次を行う。

1. ISBNからハイフンと空白を除き、ISBN-10は可能ならISBN-13へ正規化する
2. Vault内の`bookIsbn`と照合する
3. 同一ISBNがあれば新規作成せず既存ノートを報告する
4. 異なるISBNの近い書名は別版として警告する
5. `type: reading`のノートを作る

```yaml
---
type: reading
tags: []
sourceTags: []
lists: []
status: active
created: 2026-08-24T10:00:00+09:00
bookIsbn: "9784101010014"
bookAuthor: 著者名
bookPublisher: 出版社
bookPublished: 2024
bookFinished: 2026-08-24
bookRating:
---
```

本文には感想・要点を書ける見出しを残す。表紙パスや取得できなかった書誌項目を捏造しない。表紙と不足メタデータはSeiton側の補完処理へ任せる。

### Calil library lookup

カーリルの蔵書検索と国土地理院の住所検索は日本語UI限定で、日本国内の図書館を対象とする。カーリルAPIは任意設定で、APIキーがないVaultでもISBNから`https://calil.jp/book/<ISBN>`を開ける。APIキーと検索地域が設定されている場合は本棚から複数ISBNを一括検索できる。結果は短時間キャッシュされ、各ISBNの成功・蔵書なし・タイムアウト・失敗と確認日時を本棚の検索履歴で再確認できる。

## Generated `Seiton/AGENTS.md`

プラグインが生成するVault向けガイドには次を含める。

- スキーマバージョン
- 実際のSeitonルートと有効なタイプ別フォルダ
- 上記の安全手順、整理、タグ、アーカイブ、本登録の契約
- 追加検索フォルダは検索対象であり、自動変更対象ではないこと
- 既存`AGENTS.md`を上書きせず、更新案を比較して承認後に反映する手順

生成しない選択肢も維持する。

## Completion evidence

- 対象件数と変更件数
- 変更したファイルの一覧
- 曖昧なため変更しなかった項目
- frontmatterの再読結果
- 移動・リネーム後のリンクと重複確認
- 復旧方法または変更前diff
