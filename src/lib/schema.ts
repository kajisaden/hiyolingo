import type { Config, FieldMeta, FieldValue, Word } from './types'

/**
 * 値が「空（NULL 寛容の対象）」かどうか。
 * null / undefined / 空文字 / 空配列 を空とみなす。
 * 数値の 0 と boolean の false は「値あり」として扱う。
 */
export function isEmpty(value: FieldValue | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * 詳細画面に出すフィールドを順序つきで決める。
 * - hiddenFields は除外
 * - 空の値は除外（NULL 省略）
 * - meta.fields の順序を尊重（＝Notion の列順に自動追従）
 */
export function visibleDetailFields(
  word: Word,
  fields: FieldMeta[],
  config: Config,
): FieldMeta[] {
  const hidden = new Set(config.dictionary.hiddenFields)
  return fields.filter((f) => !hidden.has(f.key) && !isEmpty(word[f.key]))
}

/**
 * 検索。searchFields のいずれかに query を含めばヒット。
 * 大小文字は無視。配列フィールドも連結して対象にする。
 */
export function matchesQuery(word: Word, query: string, config: Config): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return config.dictionary.searchFields.some((key) => {
    const v = word[key]
    if (isEmpty(v)) return false
    const text = Array.isArray(v) ? v.join(' ') : String(v)
    return text.toLowerCase().includes(q)
  })
}

/**
 * クイズ対象か。表・裏の両方が存在するカードのみ対象。
 * どちらかが欠ければその方向のクイズから除外する（辞書には出す）。
 */
export function isQuizEligible(word: Word, config: Config): boolean {
  return !isEmpty(word[config.termField]) && !isEmpty(word[config.meaningField])
}
