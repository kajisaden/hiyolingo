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
