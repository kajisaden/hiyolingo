import type { Config, FieldValue, Word } from '../lib/types'
import type { FilterSelection } from './types'
import { isEmpty } from '../lib/schema'

/**
 * filterFields ごとに、データ中に存在する値を重複なく列挙する。
 * カラム駆動なので、config.quiz.filterFields に足すだけで任意カラムに拡張できる。
 */
export function availableFilters(
  words: Word[],
  config: Config,
): Record<string, Array<string | number>> {
  const fields = config.quiz.filterFields ?? []
  const result: Record<string, Array<string | number>> = {}
  for (const field of fields) {
    const values = new Set<string | number>()
    for (const w of words) {
      const v = w[field]
      if (isEmpty(v)) continue
      if (Array.isArray(v)) {
        for (const item of v) values.add(item)
      } else if (typeof v === 'string' || typeof v === 'number') {
        values.add(v)
      }
    }
    result[field] = sortValues([...values])
  }
  return result
}

function sortValues(
  vals: Array<string | number>,
): Array<string | number> {
  return vals.sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    const sa = String(a)
    const sb = String(b)
    return sa < sb ? -1 : sa > sb ? 1 : 0
  })
}

/**
 * 選択に一致する単語だけを返す。制約のあるフィールドは AND、
 * multi_select（配列）は「いずれか一致」、空値の単語は制約フィールドで除外。
 */
export function filterWords(
  words: Word[],
  _config: Config,
  selection: FilterSelection,
): Word[] {
  const constraints = Object.entries(selection).filter(
    ([, sel]) => sel.length > 0,
  )
  if (constraints.length === 0) return words
  return words.filter((w) =>
    constraints.every(([field, sel]) => valueMatches(w[field], sel)),
  )
}

function valueMatches(
  value: FieldValue | undefined,
  selected: Array<string | number>,
): boolean {
  if (isEmpty(value)) return false
  if (Array.isArray(value)) return value.some((v) => selected.includes(v))
  if (typeof value === 'string' || typeof value === 'number') {
    return selected.includes(value)
  }
  return false
}
