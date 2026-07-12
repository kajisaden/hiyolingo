// 公開Googleスプレッドシート → data/words.json。
// 使い方: GOOGLE_SHEETS_ID=... node scripts/sync-sheets.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWordsFile, hasContentChanged } from './sheets/build.mjs'

const spreadsheetId = process.env.GOOGLE_SHEETS_ID
if (!spreadsheetId) {
  console.error('GOOGLE_SHEETS_ID を環境変数で指定してください。')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const subjects = [
  { id: 'english', tab: '英語', titleField: '英単語', output: 'words.json' },
  { id: 'kobun', tab: '古文', titleField: '古文単語', output: 'kobun.json' },
]

async function fetchCsv(tab) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`)
  url.searchParams.set('tqx', 'out:csv')
  url.searchParams.set('sheet', tab)
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${tab}タブの取得に失敗: ${response.status} ${await response.text()}`)
  const csv = await response.text()
  if (/<!doctype html|<html/i.test(csv)) {
    throw new Error('CSVではなくHTMLが返されました。リンク共有設定を確認してください。')
  }
  return csv
}

let changed = 0
for (const subject of subjects) {
  const out = `${here}/../data/${subject.output}`
  let existing = null
  try { existing = JSON.parse(await readFile(out, 'utf8')) } catch { /* 初回はなくてよい */ }
  const csv = await fetchCsv(subject.tab)
  const next = buildWordsFile({
    csv,
    generatedAt: new Date().toISOString(),
    titleField: subject.titleField,
    subject: subject.id,
  })
  if (!hasContentChanged(existing, next)) {
    console.log(`${subject.tab}: 変化なし`)
    continue
  }
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(`${subject.tab}: ${next.meta.count}語を更新`)
  changed += 1
}
console.log(`同期完了: ${changed}教科を更新`)
