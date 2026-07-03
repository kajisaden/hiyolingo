# M3 実データ接続（Notion同期＋enrichment）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notion DB「英単語帳」を読み取り、`data/words.json` を自動生成・配信して、hiyolingo の辞書/クイズを実データで動かす。

**Architecture:** 「Notion プロパティ→プレーンJSON の正規化」を純粋関数として分離し TDD で固める。IO 層（Notion API 呼び出し・ページネーション・差分書き込み）を薄く被せ、GitHub Actions（cron 15分＋手動）で定期実行。アプリは DEV=同梱サンプル / PROD=raw取得 で words.json を runtime fetch する（再ビルド不要）。enrichment（GPT→Notion 書き込み）は手順書 `docs/gpt-action.md` として提供し、コード本体とは疎結合。

**Tech Stack:** Node 20（ESM・グローバル `fetch`）、vitest（`environment: node`）、Vite + React + TypeScript、GitHub Actions、Notion API（`Notion-Version: 2022-06-28`）。

**設計の正:** [`docs/specs/2026-07-03-m3-notion-sync-design.md`](../../specs/2026-07-03-m3-notion-sync-design.md)（本計画はこの spec を実装に落としたもの）

## Global Constraints

- ユーザーとのやり取り・ツールの description・コード内コメントは**日本語**。
- **ロジックは TDD 必須**（RED→GREEN 厳守）。テストは vitest、`environment: node`。
- **各タスク末尾でローカル commit する。push はしない**（公開反映はユーザーの明示指示があってから）。
- base path は `/hiyolingo/`。raw 取得元は `https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/words.json`。
- **新規 runtime 依存を足さない**（Notion SDK 不使用・グローバル `fetch` を使う）。sync スクリプトは `.mjs`（既存 `scripts/gen-icons.mjs` に倣う）。
- **英単語帳 DB は聖域**：`英単語 / 意味 / 品詞 / 関連語 / イディオム / 例文 / Tips / レベル / タグ` の列名変更・削除・DB作り直しをしない（設定がこの名前を参照）。列の**追加**は自動追従で可。
- 秘密情報（Notion トークン等）をコード・コミットに**絶対に含めない**（GitHub Secrets のみ）。

---

## ファイル構成

| ファイル | 役割 | 区分 |
|---|---|---|
| `scripts/notion/normalize.mjs` | 1プロパティ値の型別変換（純粋関数） | 新規 |
| `scripts/notion/normalize.test.mjs` | normalize のテスト | 新規 |
| `scripts/notion/build.mjs` | fields生成・ページ正規化・words.json組立・差分判定（純粋関数） | 新規 |
| `scripts/notion/build.test.mjs` | build のテスト | 新規 |
| `scripts/sync-notion.mjs` | Notion API 呼び出し＋差分書き込み（IO層） | 新規 |
| `vite.config.ts` | vitest の `include` に scripts テストを追加 | 変更 |
| `src/lib/wordsUrl.ts` | words.json 取得URLの決定（純粋関数） | 新規 |
| `src/lib/wordsUrl.test.ts` | wordsUrl のテスト | 新規 |
| `src/lib/data.ts` | 取得元を DEV/PROD で切替 | 変更 |
| `data/words.json` | 本番データ（初回は sample のコピー、以降 sync が上書き） | 新規 |
| `.github/workflows/sync.yml` | cron 15分＋手動で sync 実行→差分commit | 新規 |
| `docs/gpt-action.md` | enrichment 方式A のセットアップ手順書 | 新規 |

**依存関係:** Task 1 → Task 2 →（Task 3, Task 5）。Task 4・Task 6 は独立。Task 3 の疎通確認と Task 5 の実行はユーザーの Notion 準備＋Secrets 登録が前提。

---

## Task 1: プロパティ値の正規化（normalize.mjs）

Notion の1プロパティ値を、型に応じてプレーンな JSON 値へ変換する純粋関数。空欄は `null`（配列系は `[]`、checkbox は `false`）、未対応型は `null`＋warning。

**Files:**
- Create: `scripts/notion/normalize.mjs`
- Test: `scripts/notion/normalize.test.mjs`
- Modify: `vite.config.ts`（vitest の `include`）

**Interfaces:**
- Produces: `normalizeValue(prop) => { value, warning }`（`value` はプレーン値、`warning` は未対応型のとき文字列・通常は `null`）

- [ ] **Step 1: vitest が scripts のテストを拾うよう include を拡張**

`vite.config.ts` の `test.include` を変更：

```ts
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
```

- [ ] **Step 2: 失敗するテストを書く**

`scripts/notion/normalize.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { normalizeValue } from './normalize.mjs'

describe('normalizeValue', () => {
  it('title を連結テキストにする', () => {
    expect(
      normalizeValue({ type: 'title', title: [{ plain_text: 'ubi' }, { plain_text: 'quitous' }] }).value,
    ).toBe('ubiquitous')
  })
  it('空の rich_text は null', () => {
    expect(normalizeValue({ type: 'rich_text', rich_text: [] }).value).toBeNull()
  })
  it('number をそのまま返す', () => {
    expect(normalizeValue({ type: 'number', number: 3 }).value).toBe(3)
  })
  it('未入力の number は null', () => {
    expect(normalizeValue({ type: 'number', number: null }).value).toBeNull()
  })
  it('select は選択名', () => {
    expect(normalizeValue({ type: 'select', select: { name: '形容詞' } }).value).toBe('形容詞')
  })
  it('未選択の select は null', () => {
    expect(normalizeValue({ type: 'select', select: null }).value).toBeNull()
  })
  it('multi_select は名前の配列', () => {
    expect(
      normalizeValue({ type: 'multi_select', multi_select: [{ name: 'a' }, { name: 'b' }] }).value,
    ).toEqual(['a', 'b'])
  })
  it('空の multi_select は空配列', () => {
    expect(normalizeValue({ type: 'multi_select', multi_select: [] }).value).toEqual([])
  })
  it('checkbox は真偽値', () => {
    expect(normalizeValue({ type: 'checkbox', checkbox: true }).value).toBe(true)
  })
  it('date は start（ISO文字列）', () => {
    expect(normalizeValue({ type: 'date', date: { start: '2026-07-01' } }).value).toBe('2026-07-01')
  })
  it('未対応型は null＋warning', () => {
    const r = normalizeValue({ type: 'mystery_type' })
    expect(r.value).toBeNull()
    expect(r.warning).toContain('未対応')
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npm test -- scripts/notion/normalize.test.mjs`
Expected: FAIL（`normalizeValue` が未定義 / モジュールが見つからない）

- [ ] **Step 4: 最小実装を書く**

`scripts/notion/normalize.mjs`:

```js
// Notion プロパティ値 → プレーンJSON への正規化（純粋関数・IOなし）。
// 空欄は null（配列系は []、checkbox は false）、未対応型は null＋warning。

// リッチテキスト/タイトルの配列を連結。空なら null。
function joinRichText(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const text = arr.map((t) => t?.plain_text ?? '').join('')
  return text.length > 0 ? text : null
}

function resolveFormula(formula) {
  if (formula == null) return null
  switch (formula.type) {
    case 'string':
      return formula.string ?? null
    case 'number':
      return formula.number ?? null
    case 'boolean':
      return formula.boolean === true
    case 'date':
      return formula.date?.start ?? null
    default:
      return null
  }
}

// 1つの Notion プロパティ値を型に応じて変換する。
// 戻り値: { value, warning }（warning は未対応型のときのみ文字列）
export function normalizeValue(prop) {
  if (prop == null || typeof prop !== 'object') return { value: null, warning: null }
  switch (prop.type) {
    case 'title':
      return { value: joinRichText(prop.title), warning: null }
    case 'rich_text':
      return { value: joinRichText(prop.rich_text), warning: null }
    case 'number':
      return { value: prop.number ?? null, warning: null }
    case 'select':
      return { value: prop.select?.name ?? null, warning: null }
    case 'status':
      return { value: prop.status?.name ?? null, warning: null }
    case 'multi_select':
      return { value: (prop.multi_select ?? []).map((o) => o.name), warning: null }
    case 'checkbox':
      return { value: prop.checkbox === true, warning: null }
    case 'date':
      return { value: prop.date?.start ?? null, warning: null }
    case 'url':
      return { value: prop.url ?? null, warning: null }
    case 'email':
      return { value: prop.email ?? null, warning: null }
    case 'phone_number':
      return { value: prop.phone_number ?? null, warning: null }
    case 'people':
      return {
        value: (prop.people ?? []).map((p) => p.name ?? null).filter((n) => n != null),
        warning: null,
      }
    case 'files':
      return {
        value: (prop.files ?? [])
          .map((f) => f.file?.url ?? f.external?.url ?? null)
          .filter((u) => u != null),
        warning: null,
      }
    case 'formula':
      return { value: resolveFormula(prop.formula), warning: null }
    case 'relation':
      return { value: (prop.relation ?? []).map((r) => r.id), warning: null }
    default:
      return { value: null, warning: `未対応のプロパティ型: ${prop.type}` }
  }
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- scripts/notion/normalize.test.mjs`
Expected: PASS（11 件）

- [ ] **Step 6: 既存テストが壊れていないことを確認**

Run: `npm test`
Expected: PASS（既存 34 件 ＋ 新規 11 件）

- [ ] **Step 7: commit**

```bash
git add scripts/notion/normalize.mjs scripts/notion/normalize.test.mjs vite.config.ts
git commit -m "M3: Notionプロパティ正規化(normalizeValue)をTDDで追加"
```

---

## Task 2: words.json 組立と差分判定（build.mjs）

DB スキーマから `meta.fields` を作り、全ページを正規化して `words.json` の中身を組み立てる。`meta.generatedAt` を除いた内容比較で差分を判定する。

**Files:**
- Create: `scripts/notion/build.mjs`
- Test: `scripts/notion/build.test.mjs`

**Interfaces:**
- Consumes: `normalizeValue`（Task 1）
- Produces:
  - `buildFields(databaseProperties) => [{ key, type }]`
  - `normalizePage(page) => { record, warnings }`
  - `buildWordsFile({ database, pages, generatedAt }) => { meta, words }`
  - `hasContentChanged(oldFile, newFile) => boolean`（generatedAt を除いて比較・変化時 true）

- [ ] **Step 1: 失敗するテストを書く**

`scripts/notion/build.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { buildFields, normalizePage, buildWordsFile, hasContentChanged } from './build.mjs'

describe('buildFields', () => {
  it('DBプロパティから key/type の配列を作る', () => {
    expect(buildFields({ 英単語: { type: 'title' }, レベル: { type: 'number' } })).toEqual([
      { key: '英単語', type: 'title' },
      { key: 'レベル', type: 'number' },
    ])
  })
})

describe('normalizePage', () => {
  it('ページを id/値/_updated のレコードにする', () => {
    const page = {
      id: 'p1',
      last_edited_time: '2026-07-01T00:00:00.000Z',
      properties: {
        英単語: { type: 'title', title: [{ plain_text: 'candid' }] },
        意味: { type: 'rich_text', rich_text: [] },
      },
    }
    expect(normalizePage(page).record).toEqual({
      id: 'p1',
      英単語: 'candid',
      意味: null,
      _updated: '2026-07-01T00:00:00.000Z',
    })
  })
})

describe('buildWordsFile', () => {
  it('meta と words を組み立てる', () => {
    const database = { properties: { 英単語: { type: 'title' } } }
    const pages = [
      { id: 'p1', last_edited_time: 't', properties: { 英単語: { type: 'title', title: [{ plain_text: 'a' }] } } },
    ]
    const file = buildWordsFile({ database, pages, generatedAt: 'GEN' })
    expect(file.meta.generatedAt).toBe('GEN')
    expect(file.meta.source).toBe('notion')
    expect(file.meta.count).toBe(1)
    expect(file.meta.fields).toEqual([{ key: '英単語', type: 'title' }])
    expect(file.words[0].英単語).toBe('a')
  })
})

describe('hasContentChanged', () => {
  it('generatedAt だけの違いは変化なし', () => {
    const a = { meta: { generatedAt: 'X', count: 1 }, words: [{ id: 'p1' }] }
    const b = { meta: { generatedAt: 'Y', count: 1 }, words: [{ id: 'p1' }] }
    expect(hasContentChanged(a, b)).toBe(false)
  })
  it('words が変われば変化あり', () => {
    const a = { meta: { generatedAt: 'X', count: 1 }, words: [{ id: 'p1' }] }
    const b = { meta: { generatedAt: 'X', count: 1 }, words: [{ id: 'p2' }] }
    expect(hasContentChanged(a, b)).toBe(true)
  })
  it('既存が無ければ変化あり', () => {
    expect(hasContentChanged(null, { meta: {}, words: [] })).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- scripts/notion/build.test.mjs`
Expected: FAIL（`build.mjs` が見つからない）

- [ ] **Step 3: 最小実装を書く**

`scripts/notion/build.mjs`:

```js
import { normalizeValue } from './normalize.mjs'

// DB スキーマ（database.properties = { 列名: { type, ... } }）から
// meta.fields を作る。順序は Object のキー順（＝DBの列順）。
export function buildFields(databaseProperties) {
  return Object.entries(databaseProperties ?? {}).map(([key, prop]) => ({
    key,
    type: prop?.type ?? 'unknown',
  }))
}

// 1ページを正規化して { record, warnings } を返す。
export function normalizePage(page) {
  const record = { id: page.id }
  const warnings = []
  for (const [key, prop] of Object.entries(page.properties ?? {})) {
    const { value, warning } = normalizeValue(prop)
    record[key] = value
    if (warning) warnings.push(`${key}: ${warning}`)
  }
  record._updated = page.last_edited_time ?? null
  return { record, warnings }
}

// DB スキーマと全ページから words.json の中身を組み立てる。
// generatedAt はテストの決定性のため引数で受け取る。
export function buildWordsFile({ database, pages, generatedAt }) {
  const fields = buildFields(database.properties)
  const words = []
  const warningSet = new Set()
  for (const page of pages) {
    const { record, warnings } = normalizePage(page)
    words.push(record)
    warnings.forEach((w) => warningSet.add(w))
  }
  return {
    meta: { generatedAt, source: 'notion', count: words.length, fields, warnings: [...warningSet] },
    words,
  }
}

// meta.generatedAt を除いた内容が変わったか。変化時 true。
export function hasContentChanged(oldFile, newFile) {
  if (oldFile == null) return true
  const strip = (f) => JSON.stringify({ ...f, meta: { ...f.meta, generatedAt: null } })
  return strip(oldFile) !== strip(newFile)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- scripts/notion/build.test.mjs`
Expected: PASS（6 件）

- [ ] **Step 5: 全テストを確認**

Run: `npm test`
Expected: PASS（既存 ＋ Task1 ＋ Task2）

- [ ] **Step 6: commit**

```bash
git add scripts/notion/build.mjs scripts/notion/build.test.mjs
git commit -m "M3: words.json組立と差分判定(buildWordsFile/hasContentChanged)をTDDで追加"
```

---

## Task 3: Notion同期スクリプト（sync-notion.mjs / IO層）

Notion API を呼び（ページネーションで全件取得）、Task 1・2 の純粋関数で組み立て、`data/words.json` を**差分があるときだけ**書き込む。

**Files:**
- Create: `scripts/sync-notion.mjs`

**Interfaces:**
- Consumes: `buildWordsFile`, `hasContentChanged`（Task 2）
- 環境変数: `NOTION_TOKEN`, `NOTION_DATABASE_ID`

> **検証はユーザーの Notion 準備が前提**（DB 作成＋インテグレーション＋トークン）。それまでは実行できないため、この Task の「疎通確認」は Notion 準備後に手動で行う（下記 Step 3）。

- [ ] **Step 1: スクリプトを書く**

`scripts/sync-notion.mjs`:

```js
// Notion API → data/words.json。GitHub Actions / ローカルから実行。
// 使い方: NOTION_TOKEN=... NOTION_DATABASE_ID=... node scripts/sync-notion.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWordsFile, hasContentChanged } from './notion/build.mjs'

const NOTION_VERSION = '2022-06-28'
const API = 'https://api.notion.com/v1'

const token = process.env.NOTION_TOKEN
const databaseId = process.env.NOTION_DATABASE_ID
if (!token || !databaseId) {
  console.error('NOTION_TOKEN と NOTION_DATABASE_ID を環境変数で指定してください。')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
}

async function fetchDatabase(id) {
  const res = await fetch(`${API}/databases/${id}`, { headers })
  if (!res.ok) throw new Error(`DB取得に失敗: ${res.status} ${await res.text()}`)
  return res.json()
}

// ページネーション（has_more / next_cursor）で全ページ取得。
async function fetchAllPages(id) {
  const pages = []
  let cursor
  do {
    const body = cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }
    const res = await fetch(`${API}/databases/${id}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`クエリに失敗: ${res.status} ${await res.text()}`)
    const data = await res.json()
    pages.push(...data.results)
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)
  return pages
}

async function readExisting(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const OUT = `${here}/../data/words.json`

const database = await fetchDatabase(databaseId)
const pages = await fetchAllPages(databaseId)
const newFile = buildWordsFile({ database, pages, generatedAt: new Date().toISOString() })
const existing = await readExisting(OUT)

// 内容が変わらないなら書き込まない（generatedAt だけの差分で
// git が毎回変化を検知しないようにするため）。
if (!hasContentChanged(existing, newFile)) {
  console.log('変化なし。書き込みをスキップしました。')
  process.exit(0)
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(newFile, null, 2) + '\n', 'utf8')
console.log(`更新しました: ${newFile.meta.count} 語`)
```

- [ ] **Step 2: 構文が壊れていないことを確認（credなしでの早期終了）**

Run: `node scripts/sync-notion.mjs`
Expected: 「NOTION_TOKEN と NOTION_DATABASE_ID を…」と表示され exit 1（構文エラーが無いことの確認）

- [ ] **Step 3: 【Notion準備後・手動】実データで疎通確認**

前提: ユーザーが `docs/gpt-action.md`（Task 6）に沿って DB 作成＋インテグレーション＋トークン取得済み。あなたの Notion に手で 2〜3 語入れておく。

Run（PowerShell 例）:
```powershell
$env:NOTION_TOKEN="ntn_xxx"; $env:NOTION_DATABASE_ID="xxxxxxxx"; node scripts/sync-notion.mjs
```
Expected: `更新しました: N 語` と表示され、`data/words.json` が生成される。**もう一度実行**すると `変化なし。書き込みをスキップしました。` になる（差分判定の確認）。生成 JSON の `meta.fields` と `words` が spec §4.2 の形になっているか目視。

- [ ] **Step 4: commit**

```bash
git add scripts/sync-notion.mjs
git commit -m "M3: Notion同期スクリプト(sync-notion.mjs)を追加"
```

---

## Task 4: アプリの取得元切替（DEV=サンプル / PROD=raw）＋初期化

words.json の取得元 URL を DEV/PROD で切り替える。切替時の 404 を避けるため、初回 `data/words.json`（リポジトリ直下）を sample のコピーで用意する。config は同梱のまま。

**Files:**
- Create: `src/lib/wordsUrl.ts`, `src/lib/wordsUrl.test.ts`
- Modify: `src/lib/data.ts`
- Create: `data/words.json`（sample のコピー）

**Interfaces:**
- Produces: `buildWordsUrl({ dev, baseUrl, bust?, now? }) => string`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/wordsUrl.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildWordsUrl } from './wordsUrl'

describe('buildWordsUrl', () => {
  it('DEVは同梱サンプルを指す', () => {
    expect(buildWordsUrl({ dev: true, baseUrl: '/hiyolingo/' })).toBe('/hiyolingo/data/words.json')
  })
  it('PRODはraw取得', () => {
    expect(buildWordsUrl({ dev: false, baseUrl: '/hiyolingo/' })).toBe(
      'https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/words.json',
    )
  })
  it('bust時は?t=を付ける', () => {
    expect(buildWordsUrl({ dev: false, baseUrl: '/hiyolingo/', bust: true, now: 123 })).toBe(
      'https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/words.json?t=123',
    )
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/lib/wordsUrl.test.ts`
Expected: FAIL（`wordsUrl` が見つからない）

- [ ] **Step 3: 最小実装を書く**

`src/lib/wordsUrl.ts`:

```ts
// words.json の取得元URLを決める。
// DEV=アプリ同梱のサンプル、PROD=raw.githubusercontent.com の同期済みデータ。
const RAW_WORDS_URL =
  'https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/words.json'

export function buildWordsUrl(opts: {
  dev: boolean
  baseUrl: string
  bust?: boolean
  now?: number
}): string {
  const base = opts.dev ? `${opts.baseUrl}data/words.json` : RAW_WORDS_URL
  return opts.bust ? `${base}?t=${opts.now ?? 0}` : base
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/lib/wordsUrl.test.ts`
Expected: PASS（3 件）

- [ ] **Step 5: data.ts を新ヘルパーで配線**

`src/lib/data.ts` を次の内容に置き換える（config は従来どおり同梱・words のみ切替）：

```ts
import type { Config, WordsFile } from './types'
import { buildWordsUrl } from './wordsUrl'

// config（役割マップ）は同梱のまま。words のみ DEV/PROD で取得元を切替。
const base = import.meta.env.BASE_URL
const CONFIG_URL = `${base}data/config.json`

export async function loadData(
  bust = false,
): Promise<{ words: WordsFile; config: Config }> {
  const wordsUrl = buildWordsUrl({
    dev: import.meta.env.DEV,
    baseUrl: base,
    bust,
    now: Date.now(),
  })
  const configUrl = bust ? `${CONFIG_URL}?t=${Date.now()}` : CONFIG_URL
  const [wordsRes, configRes] = await Promise.all([
    fetch(wordsUrl, { cache: 'no-cache' }),
    fetch(configUrl, { cache: 'no-cache' }),
  ])
  if (!wordsRes.ok) throw new Error(`words.json の取得に失敗: ${wordsRes.status}`)
  if (!configRes.ok) throw new Error(`config.json の取得に失敗: ${configRes.status}`)
  const words = (await wordsRes.json()) as WordsFile
  const config = (await configRes.json()) as Config
  return { words, config }
}
```

- [ ] **Step 6: 初期化ファイルを作る（404回避）**

Run（Git Bash / PowerShell 共通で動くよう2コマンド）:
```bash
mkdir -p data
cp public/data/words.json data/words.json
```
（PowerShell なら `New-Item -ItemType Directory -Force data; Copy-Item public/data/words.json data/words.json`）
これで PROD の raw 取得が初回から 404 にならない。以降は sync が上書き。

- [ ] **Step 7: 型チェックと全テスト**

Run: `npm run typecheck && npm test`
Expected: 型エラー0・全テスト PASS

- [ ] **Step 8: 【手動】DEV 実機確認**

Run: `npm run dev` → `http://localhost:5173/hiyolingo/` を開く。
Expected: 辞書/クイズがサンプル5語で従来どおり表示（DEV は同梱サンプルを見るため挙動不変）。コンソールエラー0。

- [ ] **Step 9: commit**

```bash
git add src/lib/wordsUrl.ts src/lib/wordsUrl.test.ts src/lib/data.ts data/words.json
git commit -m "M3: words取得元をDEV=サンプル/PROD=rawに切替＋初期data/words.json"
```

---

## Task 5: 同期ワークフロー（sync.yml）

cron 15分＋手動で `sync-notion.mjs` を実行し、`data/words.json` に差分があればコミット＆push する。

**Files:**
- Create: `.github/workflows/sync.yml`

> **前提:** GitHub Secrets に `NOTION_TOKEN` / `NOTION_DATABASE_ID` が登録済み（ユーザー作業・手順は `docs/gpt-action.md`）。

- [ ] **Step 1: ワークフローを書く**

`.github/workflows/sync.yml`:

```yaml
name: Sync Notion → words.json

# cron は15分ごと＋手動実行。※public リポジトリの schedule は
# 60日間コミットが無いと自動停止する仕様。長期間変化が無い場合は
# 時々「Run workflow」を手動実行して回避する。
on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Notion を同期
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
        run: node scripts/sync-notion.mjs
      - name: 差分があればコミット
        run: |
          if [ -n "$(git status --porcelain data/words.json)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add data/words.json
            git commit -m "data: Notion同期でwords.jsonを更新"
            git push
          else
            echo "変化なし。コミットしません。"
          fi
```

> **deploy.yml との関係:** `deploy.yml` は `paths-ignore: data/**` 済みなので、この `data/words.json` の commit では**アプリの再デプロイは走らない**（設計どおり）。アプリは raw から次回ロード/更新ボタンで新データを取得する。

- [ ] **Step 2: YAML の妥当性を目視確認**

`on.schedule.cron`・`permissions.contents: write`・Secrets 参照・差分コミットのガードがあることを確認。

- [ ] **Step 3: commit**

```bash
git add .github/workflows/sync.yml
git commit -m "M3: Notion同期ワークフロー(sync.yml, cron15分＋手動)"
```

- [ ] **Step 4: 【Secrets登録後・手動】実行確認**

ユーザーが Secrets 登録後、push してから GitHub の Actions 画面で「Sync Notion → words.json」を **Run workflow** で手動実行。
Expected: 成功し、DB に語があれば `data/words.json` が更新コミットされる。2回目は「変化なし」。

---

## Task 6: enrichment 手順書（docs/gpt-action.md）

ユーザーが一度だけ行う手順書。Notion DB 作成／インテグレーション／Secrets 登録／カスタムGPT の Action 設定（貼れる OpenAPI＋指示文）／共有／セキュリティ。**コードでなく文書**（TDD 対象外）。

**Files:**
- Create: `docs/gpt-action.md`

- [ ] **Step 1: 手順書を書く**

`docs/gpt-action.md`（下記内容で作成）:

````markdown
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

- **追加ヘッダ:** Actions の「Available actions」→ 各アクションの設定、またはスキーマの各リクエストに `Notion-Version: 2022-06-28` が乗るようにする（ChatGPT の Action 設定で Custom Header を追加）。

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
````

- [ ] **Step 2: リンク切れ・整合性の目視確認**

DB 列名が spec §4.2 / config.json（`termField=英単語`, `meaningField=意味`, `filterFields=[タグ,レベル]`）と一致していることを確認。

- [ ] **Step 3: commit**

```bash
git add docs/gpt-action.md
git commit -m "M3: enrichment方式Aの手順書(docs/gpt-action.md)"
```

---

## 実装順のまとめ

1. **Task 1 → 2**（正規化コア・TDD／Notion 不要）— ここで品質を固める。
2. **Task 4**（アプリ切替＋初期化／Notion 不要）— DEV 実機で挙動不変を確認。
3. **Task 6**（手順書）— ユーザーの Notion 整理・セットアップのガイドになる。
4. **Task 3**（sync IO）— Notion 準備後にローカルで疎通確認。
5. **Task 5**（workflow）— Secrets 登録後に Actions で実行確認。

Task 3・5 の「実データ確認」だけがユーザーの Notion 準備＋Secrets 登録に依存する。それ以外（1・2・4・6）は先行して完了できる。
