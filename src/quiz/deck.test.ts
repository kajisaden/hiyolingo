import { describe, it, expect } from 'vitest'
import { buildDeck } from './deck'
import type { Config, Word } from '../lib/types'
import type { Rng } from './types'

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
  { id: '3', 英単語: 'c', 意味: 'う', タグ: ['難関大'], レベル: 1 },
  { id: 'no-meaning', 英単語: 'x' },
]

/** 固定シーケンスの乱数源（テスト用）。 */
function seqRng(seq: number[]): Rng {
  let i = 0
  return () => seq[i++ % seq.length]
}

describe('buildDeck', () => {
  it('クイズ対象（表裏そろい）だけをデッキにする', () => {
    const s = buildDeck(words, config, { direction: 'term->meaning' })
    expect(s.deck.map((c) => c.id).sort()).toEqual(['1', '2', '3'])
    expect(s.deck.every((c) => c.dir === 'term->meaning')).toBe(true)
    expect(s.index).toBe(0)
    expect(s.results).toEqual({})
  })

  it('filter で範囲を絞れる', () => {
    const s = buildDeck(words, config, {
      direction: 'meaning->term',
      filter: { タグ: ['熟語'] },
    })
    expect(s.deck.map((c) => c.id)).toEqual(['2'])
    expect(s.deck[0].dir).toBe('meaning->term')
  })

  it('mix は1枚ごとに rng で方向を決める', () => {
    const one: Word[] = [{ id: '1', 英単語: 'a', 意味: 'あ' }]
    expect(
      buildDeck(one, config, { direction: 'mix', rng: seqRng([0.9]) }).deck[0].dir,
    ).toBe('meaning->term')
    expect(
      buildDeck(one, config, { direction: 'mix', rng: seqRng([0.1]) }).deck[0].dir,
    ).toBe('term->meaning')
  })

  it('同じ rng 列なら順序は決定的', () => {
    const a = buildDeck(words, config, {
      direction: 'term->meaning',
      rng: seqRng([0.1, 0.5, 0.9]),
    })
    const b = buildDeck(words, config, {
      direction: 'term->meaning',
      rng: seqRng([0.1, 0.5, 0.9]),
    })
    expect(a.deck.map((c) => c.id)).toEqual(b.deck.map((c) => c.id))
  })

  it('createdAt は渡した now を使う', () => {
    const s = buildDeck(words, config, { direction: 'term->meaning', now: 12345 })
    expect(s.createdAt).toBe(12345)
  })
})
