# hiyolingo 引継ぎ（Claude Code セッション間ハンドオフ）

最終更新: 2026-07-03

> 次に担当する Claude Code へ。まず本書 → [`docs/DESIGN.md`](DESIGN.md)（設計の正）の順に読むこと。
> ユーザーとのやり取りは**日本語**。ツール呼び出しの description も日本語（ユーザーの憲法）。

---

## 0. これは何

大学受験生（ユーザーの妹）向けの**英単語帳ツール**。Notion を単語データの唯一の正とし、GitHub Pages 上の
**PWA**で「辞書」と「クイズ」を提供する。設計原則は**カラム自動追従／NULL寛容／拡張性**。詳細は DESIGN.md。

- 公開URL（Live）: **https://kajisaden.github.io/hiyolingo/**
- リポジトリ: https://github.com/kajisaden/hiyolingo （public, `main`）
- 閲覧者=妹（PCなし・iPhone/iPad・ChatGPT **Plus**）／保守=ユーザー（Claude で開発）

---

## 1. 現在地

- ✅ **M0/M1/M2 完了**、**GitHub Pages 自動デプロイ完了**、**PWA 一部**（アイコン/manifest/installable。オフラインSWは未）
- ⬜ **次の大物は M3（実データ接続）**。今はデータが**サンプル5語**（`public/data/words.json`）。
- テスト **34件 green**（vitest）、型チェッククリーン、本番URLで実描画・コンソールエラー0を確認済み。

---

## 2. すぐ動かす

```bash
npm install
npm run dev         # 開発サーバ（http://localhost:5173/hiyolingo/）
npm test            # vitest（ロジックのユニットテスト 34件）
npm run typecheck   # tsc --noEmit
npm run build       # 本番ビルド → dist/
npm run preview     # dist を配信（--port 4173 等）
node scripts/gen-icons.mjs   # SVG→PNG アイコン再生成（sharp 使用）
```

- `gh` は **kajisaden** で認証済み（scope: repo, workflow）。git remote 設定済み。
- **push すると自動デプロイ**（後述）。commit/push は**ユーザーの指示があってから**行うこと。

---

## 3. リポジトリ構成（要点）

```
src/
  lib/         data.ts(取得) / schema.ts(NULL判定・表示・検索・クイズ対象) / types.ts / (render は components)
  views/       Dictionary.tsx / Quiz.tsx
  quiz/        filter.ts / deck.ts / session.ts / storage.ts（＋各 *.test.ts）/ types.ts   ← M2ロジック(TDD)
  components/  FieldValueView.tsx（型別レンダラ）
public/
  data/        config.json（役割マップ＋filterFields）/ words.json（★サンプル）
  icon.svg / icon-maskable.svg / *.png / manifest.webmanifest
scripts/gen-icons.mjs
.github/workflows/deploy.yml
docs/DESIGN.md（設計の正）/ HANDOFF.md（本書）
```

---

## 4. 動かし方の要点・地雷（gotchas）

- **base path は `/hiyolingo/`**（`vite.config.ts`）。プロジェクトページのため。HTML内の絶対パスも `/hiyolingo/...`。
- **データ取得は現状“同一オリジン”** `${import.meta.env.BASE_URL}data/words.json`（＝`public/data`）。
  M3 で **Notion 同期データへ切替**予定。切替点は **`src/lib/data.ts` の URL 定数1箇所**（DESIGN §5.4）。
- **自動デプロイ**：`main` へ push → `deploy.yml` がビルド→Pages公開。`data/**`・`docs/**`・`README.md` だけの変更では**再デプロイしない**（`paths-ignore`）。
- **GitHub Pages 障害の履歴**：2026-07-02 に Pages デプロイ障害があり、`deploy-pages` が `deployment_queued` のまま10分でタイムアウト→失敗した。復旧後に成功。対策として **`deploy-pages` の timeout を 30分**に延長済み。※GitHub Status のコンポーネント名は **`Pages`**（`GitHub Pages` ではない）。監視スクリプトを書くなら注意。
- **sharp** は devDependency（アイコン生成専用）。ビルド自体には不要だが `npm ci` で入る。
- **CRLF 警告**（`LF will be replaced by CRLF`）は Windows の autocrlf によるもので**無害**。
- **テスト**：vitest、`environment: node`、対象 `src/**/*.test.ts`。**ロジックは TDD 必須**（ユーザー方針、RED→GREEN厳守）。**UI は chrome-devtools MCP でブラウザ駆動**して確認する運用。
- **クイズ再開の保存キー**：`localStorage` の `hiyolingo.quiz.session.v1`。

---

## 5. 設計の核（詳細は DESIGN.md）

- **Notion=正、アプリ=読み取り専用の鏡**。静的サイトは Notion に**書き込めない**（トークンがソースに露出するため）。
- **スキーマ非固定**：`words.json` の `meta.fields`（発見された列）駆動で動的描画。**NULL は静かに省略**。
- **enrichment 方式A**：ChatGPT **Plus** ではコネクタ/MCP の**書き込みは不可**（読み取り専用）。よって「単語→項目自動生成→Notion書込」は**カスタムGPT＋Notion Action（`POST /v1/pages`）**で行う（DESIGN §7）。
- **クイズ絞り込み**は `config.quiz.filterFields` 駆動 → **任意カラムに拡張可**（UIは当面タグ/レベルのみ）。
- **続きから再開は同一端末（localStorage）**。iPhone↔iPad のクロス端末再開は、無料枠サーバーレス（Cloudflare Workers 等）追加が必要（＝読み取り専用の制約ゆえ）。

---

## 6. 次にやる：M3（実データ接続）— 段取り

**ユーザー側の準備（対話で確認してから着手）**
- Notion に「英単語帳」DB を作成。列：`英単語 / 意味 / 品詞 / 関連語 / イディオム(任意) / 例文 / Tips / レベル / タグ`。
- Notion 内部インテグレーション作成 → 対象DBを共有 → トークン取得。
- GitHub Secrets に `NOTION_TOKEN` と `NOTION_DATABASE_ID` を登録。

**実装（TDDで）**
1. `scripts/sync-notion.mjs`：Notion API（クエリ/ページネーション）→ **§4.3 の型正規化** → `words.json` 生成 → 差分あれば commit。
2. `.github/workflows/sync.yml`：`schedule`（**cron 15分**）＋`workflow_dispatch`、`permissions: contents:write`、Secrets 参照。
3. **データ取得元の切替**：`public/data/words.json`（サンプル）→ 同期が更新するデータへ。DESIGN §5.4 は「リポジトリ直下 `data/` に commit → アプリは `raw.githubusercontent.com` から runtime 取得（キャッシュバスト）」。`src/lib/data.ts` を変更。
4. 「↻ 同期」ボタンの実挙動確認（今は JSON 再取得。即時同期は GitHub の workflow_dispatch へのリンク等、任意）。

**enrichment 方式A（別途、ユーザー主体でセットアップ）**
- カスタムGPT に Action（`https://api.notion.com`、Bearer トークン、`Notion-Version` ヘッダ、`POST /v1/pages`）。
- GPT へ「英単語→意味/品詞/関連語/イディオム/例文/Tips を生成し、不明は空のまま Notion に create」を指示。
- **private リンクで妹にだけ共有**。トークンは対象DBのみに権限。漏洩時はローテーション。手順は `docs/gpt-action.md`（未作成）に切り出す予定。

---

## 7. その後の候補（拡張点は3軸：カラム・クイズ形式・言語）

- **M4 オフラインSW**：`vite-plugin-pwa` 追加（アプリシェル＋words.json をキャッシュ）。
- **スペルクイズ**：`src/quiz/` に新モード（`types` で分岐、答えは `termField` をタイプ）。
- **SRS（苦手優先）**：永続が要る → クロス端末と同様サーバーレス検討（今回は非採用）。
- **クロス端末の再開/進捗**：Cloudflare Workers 等の書込先を1枚追加。
- **多言語**：`config` の `termField`/`meaningField` 差し替えで転用可能。

---

## 8. ユーザーの進め方・好み（重要）

- **日本語**でやり取り（憲法）。ツールの description も日本語。
- **スキルは自動発火させない**。有益なら**提案→承認→実行**。**TDD は採用済み**（ロジックは RED→GREEN 厳守）。
- **対話先行**で設計を固めてから実装する流れを好む（intent 合わせを重視）。
- **デザイン品質**を気にする（アイコンは studying chick → 最終は羽なしのひよこで確定）。
- **commit/push はユーザーの指示で**。勝手に push しない。作業ツリーを汚さない。
- **ローマ字入力時**は、回答前にプロンプトを漢字かな交じりに直して引用表示する（本セッションでは該当なし）。
- グローバル設定（`~/.claude/CLAUDE.md`）に Obsidian 運用や各種ルールあり。必要時に参照。

---

## 9. 直近の git 状態（本書コミット時点）

- ブランチ `main` / origin = `https://github.com/kajisaden/hiyolingo`（public）
- 主要コミット（新しい順）: `M2 クイズモード` → `CI deploy timeout` → `CI Pages deploy` → `アイコン/PWA` → `M1 辞書`
- デプロイは成功済み、Live 反映済み。
