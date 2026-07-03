# hiyolingo 技術設計書（アーキテクチャ）

> 大学受験生（妹）向けの英単語帳ツール。Notion を単語データの唯一の正とし、
> GitHub Pages 上の PWA で「辞書」と「クイズ」の2モードを提供する。
> **柔軟スキーマ（カラム増加に自動追従）／ NULL 寛容／ 拡張しやすさ**を最優先の設計原則とする。
>
> ※本ドキュメントは技術設計（アーキテクチャ）である。Google Labs の DESIGN.md（UI仕様＋linter）とは別物。

---

## 1. 目的とスコープ

- **利用者（閲覧）**：妹。PCなし、iPhone / iPad、ChatGPT **Plus** ユーザ。
- **管理者（開発・保守）**：あなた（Claude Max）。ツールの作成・アップデートを担当。
- **初期スコープ**：英単語のみ。ただし多言語・多カラムに拡張できる土台を最初から用意する。
- **非スコープ（今回入れない／後付け余地は残す）**：SRS（間隔反復・苦手優先出題）、スペルクイズ、学習統計。

---

## 2. 体験フロー

```
妹: 勉強中に覚えていない単語を発見
  │
  ▼
カスタムGPT「単語登録くん」(GPT Plus) に単語を伝える
  │  GPTが 意味/品詞/関連語/Tips 等を生成し…
  ▼  Action 経由で Notion API を叩いて書き込み（= enrichment 方式A）
Notion DB「英単語帳」  ← 単語データの唯一の正。iPhone/iPad どちらからでも閲覧・編集可
  │
  ▼  GitHub Actions（定期 + 手動）が Notion API で取得 → words.json 生成 → commit
リポジトリ (main): data/words.json
  │
  ▼  アプリが runtime に words.json を取得（アプリ再ビルド不要）
GitHub Pages: hiyolingo (PWA)
  ├─ 辞書モード（一覧・検索・詳細）
  └─ クイズモード（表裏カード・日英双方向・自己採点）
```

**設計上の要点**：`enrichment（GPT→Notion）` と `ツール本体（Notion→JSON→閲覧）` は疎結合。
enrichment の方式を将来変えても（A→B→C）、ツール本体は無改修。

---

## 3. 全体アーキテクチャ

| レイヤ | 実体 | 役割 | 費用 |
|---|---|---|---|
| 入力 | カスタムGPT + Notion Action | 単語を enrich して Notion に書き込む | 無料（Plus定額＋Notion API無料）|
| 正データ | Notion DB「英単語帳」 | 単語データの source of truth | 無料 |
| 同期 | GitHub Actions（cron + workflow_dispatch）| Notion → `words.json` → commit | 無料（public repo）|
| 配信 | GitHub Pages | 静的PWAのホスティング | 無料 |
| 閲覧 | フロント（Vite + React + TS）| 辞書・クイズ UI | 無料 |

**秘密情報の置き場所**：
- Notion 連携トークン（同期用）→ **GitHub Actions Secrets**（リポジトリには絶対にコミットしない）。
- Notion 連携トークン（GPT書き込み用）→ **OpenAI 側の GPT Action 設定**内。
- ⇒ リポジトリは **public でも安全**（トークンは一切含まれない）。

---

## 4. データモデル（★中核：柔軟スキーマ & NULL 寛容）

### 4.1 設計原則

1. **スキーマを固定しない。** アプリは「決め打ちのカラム」を前提にしない。
2. **カラムは自動追従。** Notion にプロパティを1つ足したら、同期→JSON→UI まで**コード改修なしで表示**される。
3. **NULL は一級市民。** 値が無いことを正常な状態として扱い、UIは空欄を賢く省略する。
4. **役割（role）だけを最小限マッピング。** 「どれが表／裏／検索対象か」だけを設定ファイルで指定し、それ以外は動的描画。

### 4.2 `data/words.json`（自動生成）

```jsonc
{
  "meta": {
    "generatedAt": "2026-07-03T09:00:00Z",
    "source": "notion",
    "count": 2,
    // 発見されたスキーマ。UIはこれを見て「存在するカラムだけ」を動的描画する
    "fields": [
      { "key": "英単語",   "type": "title" },
      { "key": "意味",     "type": "rich_text" },
      { "key": "品詞",     "type": "select" },
      { "key": "関連語",   "type": "multi_select" },
      { "key": "イディオム", "type": "rich_text" },   // 任意項目
      { "key": "例文",     "type": "rich_text" },
      { "key": "Tips",     "type": "rich_text" },
      { "key": "レベル",   "type": "number" }
    ],
    "warnings": []  // 未知の型など、正規化で問題があった項目を記録
  },
  "words": [
    {
      "id": "notion-page-id-1",
      "英単語": "ubiquitous",
      "意味": "どこにでもある、遍在する",
      "品詞": "形容詞",
      "関連語": ["omnipresent", "universal"],
      "例文": null,                 // まだ無い → UIはこの行を描画しない
      "Tips": "ubi-（どこでも）が語源。",
      "レベル": 3,
      "_updated": "2026-07-01T12:00:00Z"
    },
    {
      "id": "notion-page-id-2",
      "英単語": "candid",
      "意味": "率直な",
      // 品詞・関連語・例文・Tips・レベルすべて未入力 → 各行は自動で省略
      "_updated": "2026-07-02T08:00:00Z"
    }
  ]
}
```

### 4.3 Notion プロパティ → JSON 正規化ルール（カラム自動追従の肝）

同期スクリプトは Notion プロパティを**型に応じて汎用的に**プレーンな JSON 値へ変換する。
`switch(property.type)` で機械的に処理するため、**既知の型なら新カラムは無改修で流れる**。

| Notion 型 | JSON 表現 | NULL（未入力）|
|---|---|---|
| `title`, `rich_text` | 連結したプレーンテキスト（string）| `null` |
| `number` | number | `null` |
| `select`, `status` | 選択名（string）| `null` |
| `multi_select` | 選択名の配列（string[]）| `[]` または `null` |
| `checkbox` | boolean | `false` |
| `date` | ISO文字列（start）| `null` |
| `url`, `email`, `phone_number` | string | `null` |
| `people` | 名前の配列（string[]）| `[]` |
| `files` | URLの配列（string[]）| `[]` |
| `formula`, `rollup` | 内部の値を解決 | `null` |
| `relation` | ページID/タイトルの配列（v1では任意）| `[]` |
| **未知/新型** | best-effort で文字列化 + `meta.warnings` に記録 | `null` |

### 4.4 `data/config.json`（手動：役割マップ）

「どのカラムが表/裏/検索対象か」だけを人が指定する。**残りは全部 `meta.fields` から自動描画**。

```jsonc
{
  "termField": "英単語",      // クイズの表（お題）／将来のスペル答え
  "meaningField": "意味",     // クイズの裏（答え）
  "dictionary": {
    "primary": "英単語",       // カードの見出し
    "secondary": "意味",       // 見出しの下
    "searchFields": ["英単語", "意味", "関連語"],
    "hiddenFields": ["id", "_updated"]   // 詳細でも隠す内部項目
    // ここに挙げていないカラムは、詳細画面に「存在する分だけ」自動表示
  },
  "quiz": {
    "directions": ["term->meaning", "meaning->term"],  // 日英双方向
    "types": ["self-grade"]                            // 後で "spelling" 追加
  }
}
```

### 4.5 NULL / 未知カラムの描画ルール（UI 契約）

- **詳細・辞書**：値が `null` / `""` / `[]` の行は**描画しない**（空ラベルを出さない）。
- **未知カラム**：`config` に役割指定が無くても、`hiddenFields` でなければ詳細に**汎用表示**（型に応じてテキスト/チップ/リンク）。
- **クイズ**：`termField` か `meaningField` が欠けたカードは、その方向のクイズから**除外**。
  ただし辞書には出す。除外件数は UI に控えめに表示（「クイズ対象外: N件」）。
- **配列**：チップ（タグ）表示。空配列は非表示。

⇒ これで「カラムが増えても壊れない」「NULL が多くても自然に見える」を UI レベルで保証する。

---

## 5. 同期パイプライン（Notion → words.json）

### 5.1 `scripts/sync-notion.mjs`（Node, Actions から実行）

1. `NOTION_TOKEN`（Secrets）と `NOTION_DATABASE_ID` で DB を query（ページネーション対応）。
2. 各ページのプロパティを §4.3 のルールで正規化。
3. スキーマ（`meta.fields`）を全ページのプロパティ和集合から生成。
4. `data/words.json` を書き出し。差分があれば commit（無変更ならスキップ）。

### 5.2 `.github/workflows/sync.yml`

- **トリガ**：`schedule`（cron・既定15分ごと）＋ `workflow_dispatch`（手動）。
- **権限**：`contents: write`（`words.json` を commit するため）。
- **Secrets**：`NOTION_TOKEN`, `NOTION_DATABASE_ID`。

### 5.3 データ鮮度と「更新ボタン」の現実解（重要）

静的サイトは GitHub トークンを安全に持てないため、**アプリから即座に新規同期をトリガーはできない**。
実用上はこう割り切る：

- **cron を短め**（既定：15分ごと。最小5分）にして遅延を小さく保つ。
- **アプリの「更新」ボタン = 公開済み `words.json` の再取得（キャッシュバスト）**。
  → 直近の同期結果に即座に追いつく。
- どうしても即時反映したい時のために、**「GitHubで今すぐ同期」への外部リンク**（`workflow_dispatch` 実行画面）を補助的に置く（GitHubログインは要る）。

### 5.4 アプリへのデータ配信（再ビルド不要の分離）

- アプリは `words.json` を **runtime fetch**（ビルドに焼き込まない）。
- 取得元：`main` にコミットされた `data/words.json` を
  `raw.githubusercontent.com`（鮮度重視・CORS `*`）から取得。キャッシュはクエリでバスト。
  （速度重視なら jsDelivr CDN をフォールボールに）
- ⇒ **データ更新はアプリ再デプロイ不要**。sync が JSON を更新するだけで、次回ロード/更新ボタンで反映。
- アプリ本体（`deploy.yml`）は**コード変更時のみ**ビルド＆Pagesデプロイ。

---

## 6. フロントエンド設計

### 6.1 技術選定（推奨・要承認）

- **Vite + React + TypeScript**：拡張性重視。TS は動的レコードを `Record<string, FieldValue>` で扱いつつ、役割部分に型を付けられる。Claude での保守・機能追加とも相性良。
- **スタイル**：Tailwind CSS（モバイル反復が速い）。※素の CSS 変数でも可。
- **PWA**：`vite-plugin-pwa`（manifest + service worker、オフラインキャッシュ）。
- **代替案**：ビルド不要の素の HTML/JS。最短だが機能追加で破綻しやすい。「後々増やす」方針とは逆行するため非推奨。

### 6.2 モジュール構成（拡張前提）

```
src/
├─ main.tsx
├─ App.tsx                # ルーティング（辞書 / クイズ）
├─ lib/
│  ├─ data.ts             # words.json 取得・キャッシュ・型（WordsFile, Word, FieldMeta）
│  ├─ schema.ts           # config + meta.fields から「描画プラン」を構築
│  └─ render.ts           # 型別の値レンダラ（string/number/chips/link…）
├─ views/
│  ├─ Dictionary.tsx      # 一覧・検索・フィルタ・詳細
│  └─ Quiz.tsx            # 出題ループ（方式をプラガブルに）
├─ quiz/                  # ★クイズ形式を追加しやすいプラグイン境界
│  ├─ types.ts            # QuizMode インターフェース（出題・採点）
│  ├─ selfGrade.ts        # 自己採点（表裏めくり ○×）
│  └─ spelling.ts         # 後付け：スペル入力採点（雛形のみ）
└─ components/            # Card, Chip, SearchBar, FieldRow, ...
```

- **拡張点1（カラム）**：`schema.ts` が `meta.fields` を読むので、新カラムは自動でUIに出る。
- **拡張点2（クイズ形式）**：`quiz/types.ts` の `QuizMode` を実装すれば新形式を差し込める（スペル/4択/リスニング等）。
- **拡張点3（言語）**：`config.json` の `termField/meaningField` を差し替えれば他言語に転用可。

### 6.3 UI 2モード

- **辞書モード**：カード一覧（見出し=英単語 / 副=意味）、インクリメンタル検索（`searchFields`）、タグ/レベルでフィルタ、タップで詳細（存在するカラムを全部、NULLは省略）。
- **クイズモード**：表裏カード。方向トグル（英→日 / 日→英）。表を見て思い出す→タップで裏→「わかった/あやしい」で自己採点。1セッションの正答率を表示（永続はしない＝SRSは今回なし）。出題範囲はタグ/レベルで絞れる。

---

## 7. enrichment 方式A（カスタムGPT + Notion Action）

> 妹の入力体験の実体。詳細な OpenAPI と GPT 指示は別途 `docs/gpt-action.md` に切り出す（実装時）。

### 7.1 セットアップ手順（あなたが一度だけ）

1. **Notion 連携を作成** → 内部インテグレーション用トークンを取得。
2. **対象DBだけ**をそのインテグレーションに共有（最小権限）。
3. **カスタムGPTを作成**し、**Action** を追加：
   - サーバ：`https://api.notion.com`
   - 認証：API Key（`Authorization: Bearer <token>`）
   - 追加ヘッダ：`Notion-Version: 2022-06-28`
   - 操作（最小）：`POST /v1/pages`（DBに新規行を作成）。必要に応じ
     `POST /v1/databases/{id}/query`（重複チェック）、`PATCH /v1/pages/{id}`（更新）。
4. **GPTへの指示**：英単語を受け取り、意味/品詞/関連語/例文/Tips 等を生成し、
   DBのプロパティ名にマッピングして create を呼ぶ。項目が不明なら**空のまま**（NULL寛容）。
5. **共有**：GPTを**限定リンク**で妹にだけ共有。

### 7.2 セキュリティ注意

- Action にトークンを埋めて共有 = **そのリンクを知る人はそのDBに書ける**。
  → 家族内限定の私的リンク運用を前提とし、共有範囲を絞る。トークンは**対象DBのみ**に権限付与。
- 漏洩時はインテグレーションのトークンを**即ローテーション**すれば失効できる。

---

## 8. リポジトリ構成

```
hiyolingo/
├─ README.md
├─ docs/
│  ├─ DESIGN.md              # 本書
│  └─ gpt-action.md          # 方式Aの手順・OpenAPI（実装時に作成）
├─ data/
│  ├─ words.json             # 自動生成（sync がコミット）
│  └─ config.json            # 役割マップ（手動）
├─ scripts/
│  └─ sync-notion.mjs        # Notion API → words.json
├─ .github/workflows/
│  ├─ sync.yml               # cron + 手動：Notion→words.json→commit
│  └─ deploy.yml             # アプリのビルド & Pages デプロイ
├─ src/                      # フロント（§6.2）
├─ public/
│  ├─ manifest.webmanifest
│  └─ icons/
├─ index.html
├─ package.json
├─ vite.config.ts
└─ tsconfig.json
```

---

## 9. マイルストーン（状態: 2026-07-03 更新）

| # | 内容 | 状態 |
|---|---|---|
| **M0** | リポジトリ初期化・設計合意 | ✅ 完了 |
| **M1** | 辞書モード（一覧・検索・詳細、カラム自動追従・NULL寛容） | ✅ 完了 |
| **M2** | クイズモード（表裏・日英双方向/ミックス・自己採点） | ✅ 完了。**当初スコープ超**で「タグ/レベル絞り込み（config駆動）」「続きから再開（localStorage・同一端末）」「あやしいだけ再挑戦」も実装 |
| **Deploy/CI** | GitHub Pages 公開・push で自動デプロイ | ✅ 完了（https://kajisaden.github.io/hiyolingo/）|
| **PWA** | アイコン・manifest・インストール可能 | 🔶 一部（ひよこアイコン/manifest/standalone ✅、**オフラインSW 未**）|
| **M3** | 同期パイプライン＋enrichment方式A | 🔶 コード実装完了（normalize/build/sync-notion.mjs・sync.yml・data.ts切替・gpt-action.md、TDD）。**実データ疎通は未**（Notion DB＋Secrets 準備後に手動確認）|
| **M4** | PWA オフライン化（Service Worker） | ⬜ 未着手（`vite-plugin-pwa`）|
| 後 | スペルクイズ / SRS / 多言語 / 統計 / クロス端末再開 | ⬜ 各拡張点に追加 |

**現状の要点**：M3 の同期パイプライン＋手順書はコード実装完了（main にマージ済み・未push）。DEV=サンプル/PROD=raw の切替も実装済み。**実データはまだサンプル5語**で、Notion DB・Secrets 準備後に実同期で切替。
テストは vitest（`src/**/*.test.ts` ＋ `scripts/**/*.test.mjs`、ロジックはTDD）で **58 件 green**。M3設計は [`docs/specs/2026-07-03-m3-notion-sync-design.md`](specs/2026-07-03-m3-notion-sync-design.md)、実装計画は [`docs/superpowers/plans/2026-07-03-m3-notion-sync.md`](superpowers/plans/2026-07-03-m3-notion-sync.md)。引継ぎは [`docs/HANDOFF.md`](HANDOFF.md)。

---

## 10. 確定が必要な決定事項（Open Decisions）

1. **技術スタック**：Vite + React + TypeScript + Tailwind（推奨のまま進行）。
2. **リポジトリ公開設定**：public 想定（Actions無料無制限・トークンは含めない）。※既存リポジトリが public か private か要確認。
3. **リポジトリ**：GitHub 上に同名 `hiyolingo` を作成済み。**GitHubユーザ名（またはリポジトリURL）**が必要（remote接続・Pages URL・raw取得URL・base path確定のため）。base path は `/hiyolingo/`。
4. **Notion DB の初期カラム**（確定）：英単語 / 意味 / 品詞 / 関連語 / **イディオム（任意）** / 例文 / Tips / レベル / タグ。
5. **cron 頻度**：**15分ごとを既定**（public前提で無料。最小5分・実行遅延あり・60日休眠で自動無効化の性質に留意）。30分＋手動リンクも可。

---

## 11. 設計原則の要約（迷ったら立ち返る）

- **Notion が正、アプリは鏡。** 書き込みは Notion 側、アプリは読み取り専用。
- **スキーマは発見するもの、決め打ちしない。** `meta.fields` 駆動で動的描画。
- **NULL は正常。** 無い値は静かに省略。
- **疎結合。** enrichment / 同期 / 表示 を独立させ、片方の変更が他に波及しない。
- **拡張点を明示。** カラム・クイズ形式・言語の3軸で「足す場所」が決まっている。
