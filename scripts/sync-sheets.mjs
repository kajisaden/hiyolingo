// 公開Googleスプレッドシート → data/words.json。
// 使い方: GOOGLE_SHEETS_ID=... GOOGLE_SHEETS_TAB=英語 node scripts/sync-sheets.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWordsFile, hasContentChanged } from './sheets/build.mjs'

const spreadsheetId = process.env.GOOGLE_SHEETS_ID
const sheetName = process.env.GOOGLE_SHEETS_TAB ?? '英語'
if (!spreadsheetId) {
  console.error('GOOGLE_SHEETS_ID を環境変数で指定してください。')
  process.exit(1)
}

const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`)
url.searchParams.set('tqx', 'out:csv')
url.searchParams.set('sheet', sheetName)
const response = await fetch(url, { redirect: 'follow' })
if (!response.ok) {
  throw new Error(`スプレッドシート取得に失敗: ${response.status} ${await response.text()}`)
}

const csv = await response.text()
if (/<!doctype html|<html/i.test(csv)) {
  throw new Error('CSVではなくHTMLが返されました。リンク共有が「リンクを知っている全員」になっているか確認してください。')
}

const here = dirname(fileURLToPath(import.meta.url))
const out = `${here}/../data/words.json`
let existing = null
try {
  existing = JSON.parse(await readFile(out, 'utf8'))
} catch {
  // 初回同期時は既存ファイルがなくてもよい。
}

const next = buildWordsFile({ csv, generatedAt: new Date().toISOString() })
if (!hasContentChanged(existing, next)) {
  console.log('変化なし。書き込みをスキップしました。')
  process.exit(0)
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
console.log(`更新しました: ${next.meta.count} 語`)
