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
- ✅ **M3（実データ接続）＝push済み・本番稼働**。同期パイプライン（normalize/build/sync-notion.mjs・sync.yml）、取得元切替（DEV=サンプル/PROD=raw、`data.ts`）、手順書 `docs/gpt-action.md`。**実データ疎通確認済み(2026-07-04)**：Notion「英語」DB（Hiyolingo配下 / `database_id=81206d9d3f0847c09780edb5ce8f44c5`）→ `sync.yml`（cron15分＋手動）→ `data/words.json`。Secrets（`NOTION_TOKEN`/`NOTION_DATABASE_ID`）登録済み。残り：妹用カスタムGPTのAction設定（`docs/gpt-action.md` 手順4〜6）。
- テスト **58件 green**（vitest、`src/**` ＋ `scripts/**`）、型チェッククリーン、ビルドOK。本番URLでの実描画・コンソールエラー0は M2 まで確認済み。

---

## 2. すぐ動かす

```bash
npm install
npm run dev         # 開発サーバ（http://localhost:5173/hiyolingo/）
npm test            # vitest（ロジックのユニットテスト 58件、src/** ＋ scripts/**）
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
  lib/         data.ts(取得・DEV/PROD切替) / wordsUrl.ts(取得URL・TDD) / schema.ts / types.ts
  views/       Dictionary.tsx / Quiz.tsx
  quiz/        filter.ts / deck.ts / session.ts / storage.ts（＋各 *.test.ts）/ types.ts   ← M2ロジック(TDD)
  components/  FieldValueView.tsx（型別レンダラ）
scripts/
  notion/      normalize.mjs / build.mjs（＋各 *.test.mjs）  ← M3同期の純粋ロジック(TDD)
  sync-notion.mjs（Notion→data/words.json のIO層）/ gen-icons.mjs
public/
  data/        config.json（役割マップ＋filterFields）/ words.json（★開発用サンプル）
  icon.svg / icon-maskable.svg / *.png / manifest.webmanifest
data/          words.json（★本番データ。sync が上書き。PROD は raw で取得）
.github/workflows/  deploy.yml / sync.yml（cron15分＋手動でNotion同期）
docs/          DESIGN.md（技術設計の正）/ HANDOFF.md（本書）/ gpt-action.md（enrichment手順）
  specs/              2026-07-03-m3-notion-sync-design.md（M3設計）
  superpowers/plans/  2026-07-03-m3-notion-sync.md（M3実装計画）
```

---

## 4. 動かし方の要点・地雷（gotchas）

- **base path は `/hiyolingo/`**（`vite.config.ts`）。プロジェクトページのため。HTML内の絶対パスも `/hiyolingo/...`。
- **words 取得は DEV/PROD で切替済み**（M3）：DEV=`${BASE_URL}data/words.json`（`public/data` の同梱サンプル）、PROD=`raw.githubusercontent.com/kajisaden/hiyolingo/main/data/words.json`。ロジックは `src/lib/wordsUrl.ts`（`buildWordsUrl`）、配線は `src/lib/data.ts`。config は同梱のまま（`public/data/config.json`）。
- **自動デプロイ**：`main` へ push → `deploy.yml` がビルド→Pages公開。`data/**`・`docs/**`・`README.md` だけの変更では**再デプロイしない**（`paths-ignore`）。
- **GitHub Pages 障害の履歴**：2026-07-02 に Pages デプロイ障害があり、`deploy-pages` が `deployment_queued` のまま10分でタイムアウト→失敗した。復旧後に成功。対策として **`deploy-pages` の timeout を 30分**に延長済み。※GitHub Status のコンポーネント名は **`Pages`**（`GitHub Pages` ではない）。監視スクリプトを書くなら注意。
- **sharp** は devDependency（アイコン生成専用）。ビルド自体には不要だが `npm ci` で入る。
- **CRLF 警告**（`LF will be replaced by CRLF`）は Windows の autocrlf によるもので**無害**。
- **テスト**：vitest、`environment: node`、対象 `src/**/*.test.ts` ＋ `scripts/**/*.test.mjs`（M3で拡張・`vite.config.ts`）。**ロジックは TDD 必須**（ユーザー方針、RED→GREEN厳守）。**UI は chrome-devtools MCP でブラウザ駆動**して確認する運用。
- **クイズ再開の保存キー**：`localStorage` の `hiyolingo.quiz.session.v1`。

---

## 5. 設計の核（詳細は DESIGN.md）

- **Notion=正、アプリ=読み取り専用の鏡**。静的サイトは Notion に**書き込めない**（トークンがソースに露出するため）。
- **スキーマ非固定**：`words.json` の `meta.fields`（発見された列）駆動で動的描画。**NULL は静かに省略**。
- **enrichment 方式A**：ChatGPT **Plus** ではコネクタ/MCP の**書き込みは不可**（読み取り専用）。よって「単語→項目自動生成→Notion書込」は**カスタムGPT＋Notion Action（`POST /v1/pages`）**で行う（DESIGN §7）。
- **クイズ絞り込み**は `config.quiz.filterFields` 駆動 → **任意カラムに拡張可**（UIは当面タグ/レベルのみ）。
- **続きから再開は同一端末（localStorage）**。iPhone↔iPad のクロス端末再開は、無料枠サーバーレス（Cloudflare Workers 等）追加が必要（＝読み取り専用の制約ゆえ）。

---

## 6. M3 実データ疎通（✅完了）＋残り

**M3 は push 済みで本番稼働**（`scripts/notion/normalize.mjs`・`build.mjs`、`scripts/sync-notion.mjs`、`.github/workflows/sync.yml`、`src/lib/wordsUrl.ts`＋`data.ts` 切替、`docs/gpt-action.md`）。手順の詳細は **`docs/gpt-action.md`**、実装計画は `docs/superpowers/plans/2026-07-03-m3-notion-sync.md`。

**完了済み（2026-07-04）**
- Notion 最上位「Hiyolingo」ページ配下に教科別DBの1つ目「英語」DB作成（`database_id=81206d9d3f0847c09780edb5ce8f44c5`、9列）。※DB は聖域（列名変更・作り直しをしない。列の追加は可）。今後 古文・世界史 等を兄弟DBで追加。
- 内部インテグレーション `Hiyolingo`（Read+Insertのみ）作成 → 「英語」DBに共有（ClaudeCode接続は外し分離）。
- GitHub Secrets `NOTION_TOKEN` / `NOTION_DATABASE_ID` 登録。
- **疎通確認済み**：Notion に「apple」入力 → `gh workflow run sync.yml` → `data/words.json` に反映（source:notion）をコミットで確認。以降は cron15分＋手動で自動同期（sync が `data/words.json` を更新するだけでアプリ反映・再ビルド不要）。

**残り**
- カスタムGPT に Notion Action（`POST /v1/pages`）を設定 → 妹に限定リンク共有（`docs/gpt-action.md` 手順4〜6）。

**所有モデル（確定）**：Notion DB＝ユーザー所有・妹にゲスト共有。妹は ChatGPT Plus で共有GPTから書き込み、PWAで閲覧。hiyolingo 用の合鍵は「英語」DB（Hiyolingo配下）だけに絞る（全権整理用の合鍵とは別・DBは聖域）。

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
- **main は origin より先行・未 push**（M3 一式：設計/計画/実装）。push は**ユーザー指示待ち**。push すると `data.ts` 等のコード変更で **Pages 再デプロイが走る**点に注意。
- 主要コミット（新しい順・抜粋）: `M3 予約キーガード等（最終レビュー対応）` → `M3 gpt-action.md` → `M3 sync.yml` → `M3 data取得元切替` → `M3 sync-notion.mjs` → `M3 build/差分` → `M3 normalize` → `docs: M3実装計画` → `docs: M3設計書` → `M2 クイズモード` …
- M3 実装は feature ブランチ `m3-notion-sync` で TDD＋レビュー → main に ff マージ・ブランチ削除済み。
- 進捗台帳（scratch・untracked）: `.superpowers/sdd/progress.md`。
