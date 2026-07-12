import { describe, it, expect } from 'vitest'
import { saveSession, loadSession, clearSession, QUIZ_KEY } from './storage'
import type { QuizSession, StorageLike } from './types'

function memStorage(): StorageLike {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => {
      m.set(k, v)
    },
    removeItem: (k) => {
      m.delete(k)
    },
  }
}

const sample: QuizSession = {
  createdAt: 1,
  deck: [{ id: '1', dir: 'term->meaning' }],
  index: 0,
  results: {},
}

describe('quiz storage', () => {
  it('保存→読込でラウンドトリップする', () => {
    const s = memStorage()
    saveSession(s, sample)
    expect(loadSession(s)).toEqual(sample)
  })

  it('何も無ければ null', () => {
    expect(loadSession(memStorage())).toBeNull()
  })

  it('壊れたJSONは例外を投げず null', () => {
    const s = memStorage()
    s.setItem(`${QUIZ_KEY}.english`, '{not json')
    expect(loadSession(s)).toBeNull()
  })

  it('形が違うデータは null', () => {
    const s = memStorage()
    s.setItem(`${QUIZ_KEY}.english`, JSON.stringify({ foo: 1 }))
    expect(loadSession(s)).toBeNull()
  })

  it('clear で消える', () => {
    const s = memStorage()
    saveSession(s, sample)
    clearSession(s)
    expect(loadSession(s)).toBeNull()
  })

  it('教科ごとにセッションを分離する', () => {
    const s = memStorage()
    saveSession(s, sample, 'english')
    expect(loadSession(s, 'kobun')).toBeNull()
    expect(loadSession(s, 'english')).toEqual(sample)
  })
})
