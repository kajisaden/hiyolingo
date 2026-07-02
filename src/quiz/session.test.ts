import { describe, it, expect } from 'vitest'
import {
  currentCardRef,
  isComplete,
  gradeCurrent,
  summarize,
  reconcile,
  retryUnsure,
} from './session'
import type { QuizSession, Rng } from './types'
import type { Word } from '../lib/types'

function seqRng(seq: number[]): Rng {
  let i = 0
  return () => seq[i++ % seq.length]
}

function session(): QuizSession {
  return {
    createdAt: 0,
    deck: [
      { id: '1', dir: 'term->meaning' },
      { id: '2', dir: 'meaning->term' },
    ],
    index: 0,
    results: {},
  }
}

describe('currentCardRef / gradeCurrent / isComplete', () => {
  it('先頭カードを返す', () => {
    expect(currentCardRef(session())?.id).toBe('1')
    expect(isComplete(session())).toBe(false)
  })

  it('採点すると結果を記録して次へ進む（非破壊）', () => {
    const s0 = session()
    const s1 = gradeCurrent(s0, 'known')
    expect(s1.index).toBe(1)
    expect(s1.results).toEqual({ '1': 'known' })
    expect(currentCardRef(s1)?.id).toBe('2')
    // 元は不変
    expect(s0.index).toBe(0)
    expect(s0.results).toEqual({})
  })

  it('最後まで採点すると完了、現在カードは null', () => {
    const s = gradeCurrent(gradeCurrent(session(), 'known'), 'unsure')
    expect(s.index).toBe(2)
    expect(isComplete(s)).toBe(true)
    expect(currentCardRef(s)).toBeNull()
    expect(s.results).toEqual({ '1': 'known', '2': 'unsure' })
  })

  it('完了後の採点は何もしない', () => {
    const done = gradeCurrent(gradeCurrent(session(), 'known'), 'known')
    expect(gradeCurrent(done, 'unsure')).toEqual(done)
  })
})

describe('summarize', () => {
  it('正誤の集計と、あやしいID一覧（デッキ順）', () => {
    const s: QuizSession = {
      createdAt: 0,
      deck: [
        { id: '1', dir: 'term->meaning' },
        { id: '2', dir: 'term->meaning' },
        { id: '3', dir: 'term->meaning' },
      ],
      index: 3,
      results: { '1': 'known', '2': 'unsure', '3': 'unsure' },
    }
    expect(summarize(s)).toEqual({
      total: 3,
      known: 1,
      unsure: 2,
      unsureIds: ['2', '3'],
    })
  })
})

describe('reconcile（再開時に消えた単語を突合）', () => {
  const words: Word[] = [
    { id: '2', 英単語: 'b', 意味: 'い' },
    { id: '3', 英単語: 'c', 意味: 'う' },
  ]

  it('採点済みカードが消えたら index を詰める', () => {
    const s: QuizSession = {
      createdAt: 0,
      deck: [
        { id: '1', dir: 'term->meaning' },
        { id: '2', dir: 'term->meaning' },
        { id: '3', dir: 'term->meaning' },
      ],
      index: 2,
      results: { '1': 'known', '2': 'unsure' },
    }
    const r = reconcile(s, words)
    expect(r.deck.map((c) => c.id)).toEqual(['2', '3'])
    expect(r.index).toBe(1)
    expect(r.results).toEqual({ '2': 'unsure' })
    expect(currentCardRef(r)?.id).toBe('3')
  })

  it('未出題カードが消えても index は変わらない', () => {
    const s: QuizSession = {
      createdAt: 0,
      deck: [
        { id: '2', dir: 'term->meaning' },
        { id: '3', dir: 'term->meaning' },
        { id: 'gone', dir: 'term->meaning' },
      ],
      index: 1,
      results: { '2': 'known' },
    }
    const r = reconcile(s, words)
    expect(r.deck.map((c) => c.id)).toEqual(['2', '3'])
    expect(r.index).toBe(1)
  })
})

describe('retryUnsure（あやしいだけもう一回）', () => {
  it('あやしいカードだけで新セッション（方向は維持、結果はリセット）', () => {
    const s: QuizSession = {
      createdAt: 0,
      deck: [
        { id: '1', dir: 'term->meaning' },
        { id: '2', dir: 'meaning->term' },
        { id: '3', dir: 'term->meaning' },
      ],
      index: 3,
      results: { '1': 'known', '2': 'unsure', '3': 'unsure' },
    }
    const r = retryUnsure(s, { rng: seqRng([0]), now: 99 })
    expect(r.createdAt).toBe(99)
    expect(r.index).toBe(0)
    expect(r.results).toEqual({})
    expect(r.deck.map((c) => c.id).sort()).toEqual(['2', '3'])
    const dir = Object.fromEntries(r.deck.map((c) => [c.id, c.dir]))
    expect(dir['2']).toBe('meaning->term')
    expect(dir['3']).toBe('term->meaning')
  })
})
