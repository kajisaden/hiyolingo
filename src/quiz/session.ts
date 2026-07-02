import type { QuizCardRef, QuizSession, Rng, Verdict } from './types'
import type { Word } from '../lib/types'
import { shuffle } from './deck'

/** 現在のカード。完了していれば null。 */
export function currentCardRef(session: QuizSession): QuizCardRef | null {
  return session.index < session.deck.length ? session.deck[session.index] : null
}

export function isComplete(session: QuizSession): boolean {
  return session.index >= session.deck.length
}

/** 現在カードを採点して次へ進む（非破壊）。完了後は何もしない。 */
export function gradeCurrent(
  session: QuizSession,
  verdict: Verdict,
): QuizSession {
  const card = currentCardRef(session)
  if (!card) return session
  return {
    ...session,
    index: session.index + 1,
    results: { ...session.results, [card.id]: verdict },
  }
}

export interface QuizSummary {
  total: number
  known: number
  unsure: number
  unsureIds: string[]
}

export function summarize(session: QuizSession): QuizSummary {
  const unsureIds = session.deck
    .filter((c) => session.results[c.id] === 'unsure')
    .map((c) => c.id)
  const known = session.deck.filter(
    (c) => session.results[c.id] === 'known',
  ).length
  return {
    total: session.deck.length,
    known,
    unsure: unsureIds.length,
    unsureIds,
  }
}

/**
 * 再開時に、保存デッキを現在の単語一覧と突合する。
 * 消えた単語をデッキから除去し、採点済みが消えた分だけ index を詰める。
 */
export function reconcile(session: QuizSession, words: Word[]): QuizSession {
  const valid = new Set(words.map((w) => w.id))
  const newDeck: QuizCardRef[] = []
  let removedBeforeIndex = 0
  session.deck.forEach((c, i) => {
    if (valid.has(c.id)) newDeck.push(c)
    else if (i < session.index) removedBeforeIndex++
  })
  const newResults: Record<string, Verdict> = {}
  for (const c of newDeck) {
    if (c.id in session.results) newResults[c.id] = session.results[c.id]
  }
  const newIndex = Math.min(session.index - removedBeforeIndex, newDeck.length)
  return { ...session, deck: newDeck, results: newResults, index: newIndex }
}

export interface RetryOptions {
  rng?: Rng
  now?: number
}

/** 「あやしい」だけで新セッションを作る（方向は維持・シャッフル・結果リセット）。 */
export function retryUnsure(
  session: QuizSession,
  opts: RetryOptions = {},
): QuizSession {
  const unsure = session.deck.filter((c) => session.results[c.id] === 'unsure')
  const deck = shuffle(unsure, opts.rng ?? Math.random)
  return { createdAt: opts.now ?? Date.now(), deck, index: 0, results: {} }
}
