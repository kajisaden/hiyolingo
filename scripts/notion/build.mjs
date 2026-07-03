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
    // id / _updated は内部予約キー。同名の列があっても上書きせず warning に記録する。
    if (key === 'id' || key === '_updated') {
      warnings.push(`${key}: 予約キーと同名の列は無視しました`)
      continue
    }
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
  // Notion のクエリはページ順を保証しないため、id 昇順で決定化する
  // （内容不変なのに順序差で差分検知されるのを防ぐ）。
  words.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return {
    meta: { generatedAt, source: 'notion', count: words.length, fields, warnings: [...warningSet] },
    words,
  }
}

// オブジェクトのキーを再帰的にソートして安定な文字列化を行う（キー順に依存しない比較のため）。
function stableStringify(value) {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce((acc, k) => {
          acc[k] = v[k]
          return acc
        }, {})
    }
    return v
  })
}

// meta.generatedAt を除いた内容が変わったか。変化時 true。キー順には依存しない。
export function hasContentChanged(oldFile, newFile) {
  if (oldFile == null) return true
  const strip = (f) => stableStringify({ ...f, meta: { ...f.meta, generatedAt: null } })
  return strip(oldFile) !== strip(newFile)
}
