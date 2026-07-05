# enrichment 方式A セットアップ手順（カスタムGPT ＋ Notion Action）

> 妹が単語を言うと、カスタムGPT が意味などを生成して Notion に登録する仕組み。
> あなた（管理者）が一度だけ設定する。関連: [`docs/specs/2026-07-03-m3-notion-sync-design.md`](specs/2026-07-03-m3-notion-sync-design.md)

> **状況（2026-07-04）**: 手順1〜3（DB作成・インテグレーション・Secrets）は完了。実データ疎通も確認済み（Notion に入れた語が sync で `data/words.json` に反映）。残るは **手順4〜6（妹用カスタムGPTのAction設定）** のみ。

## 1. Notion の「英語」DB（作成済み）

最上位ページ **Hiyolingo** 配下に、教科別DBの1つ目として **「英語」DB** を作成済み。今後 `古文`・`世界史` などを兄弟DBとして追加していく構成。

- **database_id**: `81206d9d3f0847c09780edb5ce8f44c5`（GitHub Secrets `NOTION_DATABASE_ID` / GPT Action の `database_id` に使う固定値）

列（種類）:

| 列名 | Notion の種類 | 役割 |
|---|---|---|
| 英単語 | タイトル | カードの表（必須） |
| 意味 | テキスト | カードの裏 |
| 品詞 | セレクト | 名詞/動詞/形容詞… |
| 関連語 | マルチセレクト | 似た語 |
| イディオム | テキスト | 熟語（任意） |
| 例文 | テキスト | 使い方 |
| Tips | テキスト | 覚え方・語源 |
| レベル | 数値 | 難易度（クイズ絞り込み） |
| タグ | マルチセレクト | 分類（クイズ絞り込み） |

> ⚠️ 列名は変えない・DBを作り直さない（アプリの設定がこの名前を参照）。列の追加は自由。DB名自体は同期に無関係（`NOTION_DATABASE_ID` で特定するため）。

## 2. インテグレーション（合鍵）を作り、DBに共有（完了済み）

1. Notion の「My integrations」で内部インテグレーション `Hiyolingo` を作成 → **Internal Integration Token** を控える（権限は Read + Insert のみ / ユーザー情報なし）。
2. **Hiyolingo** ページで **Connections → `Hiyolingo` を追加**（配下の「英語」DBに継承）。※ClaudeCode 接続は外し、この DB は Hiyolingo 接続のみに分離済み。
3. DB の **ID** = `81206d9d3f0847c09780edb5ce8f44c5`。

## 3. GitHub Secrets に登録（完了済み）

リポジトリ → Settings → Secrets and variables → Actions:
- `NOTION_TOKEN` = `Hiyolingo` インテグレーションのトークン ✅ 登録済み
- `NOTION_DATABASE_ID` = `81206d9d3f0847c09780edb5ce8f44c5` ✅ 登録済み

## 4. カスタムGPT に Notion Action を設定（書き込み用）

ChatGPT（あなたの Plus）で GPT を新規作成 → **Configure → Actions → Create new action**。

- **Authentication:** API Key / `Bearer` / トークン＝インテグレーションのトークン
- **Schema（貼り付け）:** 下記。`Notion-Version` ヘッダはスキーマ内に固定値で埋め込む（ChatGPTのカスタムヘッダ欄は不安定なため）。

> ⚠️ **重要：`properties` は自由形式（`type: object`）にしない。** それだと ChatGPT が中身のJSONを空のまま送り、**タイトルも含め全項目が空の行**が登録される（GPT Actionの既知の弱点）。下のように**各項目の形を明示**すると確実に埋まる。

```yaml
openapi: 3.1.0
info:
  title: Notion 単語登録
  version: '1.0.0'
servers:
  - url: https://api.notion.com
paths:
  /v1/pages:
    post:
      operationId: createWord
      summary: 英語DBに1語を登録
      parameters:
        - name: Notion-Version
          in: header
          required: true
          schema:
            type: string
            enum: ['2022-06-28']
            default: '2022-06-28'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [parent, properties]
              properties:
                parent:
                  type: object
                  required: [database_id]
                  properties:
                    database_id:
                      type: string
                      default: '81206d9d3f0847c09780edb5ce8f44c5'
                properties:
                  type: object
                  properties:
                    英単語:
                      type: object
                      properties:
                        title:
                          type: array
                          items:
                            type: object
                            properties:
                              text:
                                type: object
                                properties:
                                  content: { type: string }
                    意味:
                      type: object
                      properties:
                        rich_text:
                          type: array
                          items:
                            type: object
                            properties:
                              text:
                                type: object
                                properties:
                                  content: { type: string }
                    品詞:
                      type: object
                      properties:
                        select:
                          type: object
                          properties:
                            name: { type: string }
                    関連語:
                      type: object
                      properties:
                        multi_select:
                          type: array
                          items:
                            type: object
                            properties:
                              name: { type: string }
                    イディオム:
                      type: object
                      properties:
                        rich_text:
                          type: array
                          items:
                            type: object
                            properties:
                              text:
                                type: object
                                properties:
                                  content: { type: string }
                    例文:
                      type: object
                      properties:
                        rich_text:
                          type: array
                          items:
                            type: object
                            properties:
                              text:
                                type: object
                                properties:
                                  content: { type: string }
                    Tips:
                      type: object
                      properties:
                        rich_text:
                          type: array
                          items:
                            type: object
                            properties:
                              text:
                                type: object
                                properties:
                                  content: { type: string }
                    レベル:
                      type: object
                      properties:
                        number: { type: number }
                    タグ:
                      type: object
                      properties:
                        multi_select:
                          type: array
                          items:
                            type: object
                            properties:
                              name: { type: string }
      responses:
        '200':
          description: 作成成功
```

## 5. GPT への指示文（Instructions に貼る）

```
あなたは英単語登録アシスタントです。ユーザーが英単語を1つ言ったら、
その単語について次を日本語中心に生成し、createWord アクションで Notion に1行登録してください。
- 意味 / 品詞（名詞・動詞・形容詞など1つ）/ 関連語（数語）/ イディオム（任意）/ 例文 / Tips（覚え方・語源）/ レベル（1〜5の目安）/ タグ（任意）
不明な項目は空のままにし、無理に埋めないでください。
createWord の body は必ず次の形にします（database_id は下記固定値）:

{
  "parent": { "database_id": "81206d9d3f0847c09780edb5ce8f44c5" },
  "properties": {
    "英単語": { "title": [{ "text": { "content": "<単語>" } }] },
    "意味":   { "rich_text": [{ "text": { "content": "<意味>" } }] },
    "品詞":   { "select": { "name": "<品詞>" } },
    "関連語": { "multi_select": [{ "name": "<語1>" }, { "name": "<語2>" }] },
    "イディオム": { "rich_text": [{ "text": { "content": "<イディオム>" } }] },
    "例文":   { "rich_text": [{ "text": { "content": "<例文>" } }] },
    "Tips":   { "rich_text": [{ "text": { "content": "<Tips>" } }] },
    "レベル": { "number": <1-5> },
    "タグ":   { "multi_select": [{ "name": "<タグ>" }] }
  }
}

値が無い項目は properties から省いてください（空文字を入れない）。
登録後は「登録しました」と、登録内容の要約を短く返します。
```

> select / multi_select は新しい選択肢を Notion が自動追加するので、事前準備は不要。

## 6. 妹に渡す
- GPT を「リンクを知っている人」で共有し、**妹だけに私的に**渡す。
- （任意）「英語」DB を妹に**ゲスト共有**すると、iPad から直接閲覧・編集も可能。

## 7. セキュリティ
- GPT のリンクを知る人はこの DB に書ける → **家族内だけの私的リンク**運用。
- トークンは「英語」DB（Hiyolingo配下）だけに権限を絞る。
- 漏洩時は Notion でトークンを再発行すれば古いトークンは即失効。GitHub Secrets と GPT Action の両方を更新する。
- **合鍵の本数:** まずは1本（読み書き兼用）で開始し、より厳密にするなら「読む用（Secrets）」と「書く用（GPT）」で2本に分ける。

## 8. 方式②：Notionの未成形単語を一括成形（2026-07-05 追加・動作確認済み）

「Notionに単語だけ（英単語のタイトルだけ）書き溜め → GPTに『未成形を埋めて』→ 意味・例文などを一括で埋める」流れ。既存行を**更新**するので重複を作らない。方式Aの `createWord` は残したまま、Action を2つ追加する。

**前提（重要）**
- インテグレーションの権限は **Read content ＋ Insert content ＋ Update content の3つすべて必須**（更新にはUpdate、DB検索にはReadが要る）。
- **GPTのAction認証トークンは、上記3権限を持つ正しいインテグレーションのものを貼る。** 古い/別トークンだと `createWord`(挿入)は通っても `findUnformatted`(読み取り=DBクエリ)が **403** になる。403が出たらまずトークンを貼り直す。
- `findUnformatted` は**フィルタを付けず全行取得**し、GPT側で「意味が空」の行を選別する（sync と同じプレーンな `/query`＝安定）。Notionのフィルタ付きだと不安定だった。

**Action（3つ）**：`createWord`（新規・方式A）/ `findUnformatted`（`POST /v1/databases/<DB_ID>/query`・全行取得）/ `updateWord`（`PATCH /v1/pages/{page_id}`・既存行に書き込み）。スキーマは `openapi 3.1.0`、各operationに `Notion-Version: 2022-06-28` を header param（enum+default）で固定、`properties` は `$ref: '#/components/schemas/WordProps'` で明示（自由形式 `type: object` だと空送信されるため不可）。`database_id`＝`81206d9d3f0847c09780edb5ce8f44c5`。

**GPT Instructions のB（一括成形）**
1. `findUnformatted` を `{ "page_size": 100 }` で呼ぶ（全行取得）。
2. results から「`properties.意味.rich_text` が空」かつ「`英単語` に語がある」行だけ対象（先頭10件まで）。
3. 各行：`page_id` = 要素の `id`、単語 = `英単語` の title。意味/品詞/関連語/イディオム/例文/Tips/レベル/タグ を生成し `updateWord`（body `{ "properties": {…} }`、更新時は `英単語` を入れない）。
4. 終えたら「N語を成形しました」。0件なら「未成形はありません」。10件超は10件だけ→再実行を促す。

> 反映タイミング：GPT↔Notion は即時。アプリ表示は sync 経由で最大15分。
