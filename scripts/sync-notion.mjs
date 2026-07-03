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
