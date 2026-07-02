import { describe, it, expect } from 'vitest'
import { availableFilters, filterWords } from './filter'
import type { Config, Word } from '../lib/types'

const config: Config = {
  termField: '英単語',
  meaningField: '意味',
  dictionary: {
    primary: '英単語',
    secondary: '意味',
    searchFields: ['英単語'],
    hiddenFields: ['id'],
  },
  quiz: {
    directions: ['term->meaning', 'meaning->term'],
    types: ['self-grade'],
    filterFields: ['タグ', 'レベル'],
  },
}

const words: Word[] = [
  { id: '1', 英単語: 'a', 意味: 'あ', タグ: ['難関大'], レベル: 3 },
  { id: '2', 英単語: 'b', 意味: 'い', タグ: ['熟語'], レベル: 1 },
  { id: '3', 英単語: 'c', 意味: 'う', タグ: ['難関大', '熟語'], レベル: 1 },
  { id: '4', 英単語: 'd', 意味: 'え', タグ: [], レベル: null },
]

describe('availableFilters', () => {
  it('filterFields ごとに、存在する値を重複なく列挙する（空値は除外）', () => {
    const f = availableFilters(words, config)
    expect(f['タグ']).toEqual(['熟語', '難関大'])
    expect(f['レベル']).toEqual([1, 3])
  })

  it('filterFields 未指定なら空オブジェクト', () => {
    const noFilter: Config = {
      ...config,
      quiz: { ...config.quiz, filterFields: undefined },
    }
    expect(availableFilters(words, noFilter)).toEqual({})
  })
})

describe('filterWords', () => {
  it('選択なしなら全件', () => {
    expect(filterWords(words, config, {}).map((w) => w.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })

  it('タグ選択：いずれか一致（multi_select）', () => {
    expect(filterWords(words, config, { タグ: ['熟語'] }).map((w) => w.id)).toEqual([
      '2',
      '3',
    ])
  })

  it('複数フィールドは AND', () => {
    expect(
      filterWords(words, config, { タグ: ['難関大'], レベル: [1] }).map((w) => w.id),
    ).toEqual(['3'])
  })

  it('制約フィールドが空値の単語は除外', () => {
    expect(
      filterWords(words, config, { タグ: ['難関大'] }).map((w) => w.id),
    ).toEqual(['1', '3'])
  })

  it('空配列の選択はそのフィールドを無制約として扱う', () => {
    expect(filterWords(words, config, { タグ: [] }).map((w) => w.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })
})
