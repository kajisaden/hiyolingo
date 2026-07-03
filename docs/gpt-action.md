# enrichment 方式A セットアップ手順（カスタムGPT ＋ Notion Action）

> 妹が単語を言うと、カスタムGPT が意味などを生成して Notion に登録する仕組み。
> あなた（管理者）が一度だけ設定する。関連: [`docs/specs/2026-07-03-m3-notion-sync-design.md`](specs/2026-07-03-m3-notion-sync-design.md)

## 1. Notion に「英単語帳」DB を作る（列＝種類）

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

> ⚠️ 列名は変えない・DBを作り直さない（アプリの設定がこの名前を参照）。列の追加は自由。

## 2. インテグレーション（合鍵）を作り、DBに共有

1. Notion の「My integrations」で内部インテグレーションを作成 → **Internal Integration Token** を控える。
2. 「英単語帳」DB のページで **Connections → 作ったインテグレーションを追加**（この DB だけに権限）。
3. DB の **ID** を控える（DB を開いた URL の `notion.so/xxxx?v=...` の `xxxx` 32桁）。

## 3. GitHub Secrets に登録（同期用）

リポジトリ → Settings → Secrets and variables → Actions → New repository secret:
- `NOTION_TOKEN` = インテグレーションのトークン
- `NOTION_DATABASE_ID` = DB の ID

## 4. カスタムGPT に Notion Action を設定（書き込み用）

ChatGPT（あなたの Plus）で GPT を新規作成 → **Configure → Actions → Create new action**。

- **Authentication:** API Key / `Bearer` / トークン＝インテグレーションのトークン
- **Schema（貼り付け）:**

```yaml
openapi: 3.1.0
info: { title: Notion 単語登録, version: '1.0.0' }
servers:
  - url: https://api.notion.com
paths:
  /v1/pages:
    post:
      operationId: createWord
      summary: 英単語帳DBに1語を登録
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
                    database_id: { type: string }
                properties: { type: object }
      responses:
        '200': { description: 作成成功 }
```

- **追加ヘッダ:** Actions の各リクエストに `Notion-Version: 2022-06-28` が乗るよう、ChatGPT の Action 設定で Custom Header を追加する。

## 5. GPT への指示文（Instructions に貼る）

```
あなたは英単語登録アシスタントです。ユーザーが英単語を1つ言ったら、
その単語について次を日本語中心に生成し、createWord アクションで Notion に1行登録してください。
- 意味 / 品詞（名詞・動詞・形容詞など1つ）/ 関連語（数語）/ 例文 / Tips（覚え方・語源）/ レベル（1〜5の目安）/ タグ（任意）
不明な項目は空のままにし、無理に埋めないでください。
createWord の body は必ず次の形にします（database_id は下記固定値）:

{
  "parent": { "database_id": "<あなたのDB_ID>" },
  "properties": {
    "英単語": { "title": [{ "text": { "content": "<単語>" } }] },
    "意味":   { "rich_text": [{ "text": { "content": "<意味>" } }] },
    "品詞":   { "select": { "name": "<品詞>" } },
    "関連語": { "multi_select": [{ "name": "<語1>" }, { "name": "<語2>" }] },
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
- （任意）「英単語帳」DB を妹に**ゲスト共有**すると、iPad から直接閲覧・編集も可能。

## 7. セキュリティ
- GPT のリンクを知る人はこの DB に書ける → **家族内だけの私的リンク**運用。
- トークンは「英単語帳」DB だけに権限を絞る。
- 漏洩時は Notion でトークンを再発行すれば古いトークンは即失効。GitHub Secrets と GPT Action の両方を更新する。
- **合鍵の本数:** まずは1本（読み書き兼用）で開始し、より厳密にするなら「読む用（Secrets）」と「書く用（GPT）」で2本に分ける。
