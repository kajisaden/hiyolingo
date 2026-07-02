import { describe, it, expect } from 'vitest'
import {
  isEmpty,
  visibleDetailFields,
  matchesQuery,
  isQuizEligible,
} from './schema'
import type { Config, FieldMeta, Word } from './types'

const fields: FieldMeta[] = [
  { key: '英単語', type: 'title' },
  { key: '意味', type: 'rich_text' },
  { key: '関連語', type: 'multi_select' },
  { key: '例文', type: 'rich_text' },
  { key: '_updated', type: 'date' },
]

const config: Config = {
  termField: '英単語',
  meaningField: '意味',
  dictionary: {
    primary: '英単語',
    secondary: '意味',
    searchFields: ['英単語', '意味', '関連語'],
    hiddenFields: ['id', '_updated'],
  },
  quiz: { directions: ['term->meaning', 'meaning->term'], types: ['self-grade'] },
}

describe('isEmpty（NULL 寛容の判定）', () => {
  it('null / undefined / 空文字 / 空白 / 空配列 は空', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('   ')).toBe(true)
    expect(isEmpty([])).toBe(true)
  })
  it('0 と false は「値あり」', () => {
    expect(isEmpty(0)).toBe(false)
    expect(isEmpty(false)).toBe(false)
  })
})

describe('visibleDetailFields', () => {
  const word: Word = {
    id: 'x',
    英単語: 'candid',
    意味: '率直な',
    関連語: [],
    例文: null,
    _updated: '2026-07-02',
  }
  it('空フィールドと hiddenFields を除外し、列順を保つ', () => {
    const keys = visibleDetailFields(word, fields, config).map((f) => f.key)
    expect(keys).toEqual(['英単語', '意味'])
  })
})

describe('matchesQuery', () => {
  const word: Word = {
    id: 'x',
    英単語: 'ubiquitous',
    意味: 'どこにでもある',
    関連語: ['omnipresent'],
  }
  it('空クエリは全ヒット', () => {
    expect(matchesQuery(word, '', config)).toBe(true)
  })
  it('大小無視で部分一致', () => {
    expect(matchesQuery(word, 'UBIQ', config)).toBe(true)
  })
  it('配列フィールドも検索対象', () => {
    expect(matchesQuery(word, 'omni', config)).toBe(true)
  })
  it('該当しなければヒットしない', () => {
    expect(matchesQuery(word, 'zzz', config)).toBe(false)
  })
})

describe('isQuizEligible', () => {
  it('表裏そろえば対象', () => {
    expect(isQuizEligible({ id: 'x', 英単語: 'a', 意味: 'b' }, config)).toBe(true)
  })
  it('裏が無ければ対象外', () => {
    expect(isQuizEligible({ id: 'x', 英単語: 'a' }, config)).toBe(false)
  })
})
