import type { Config, Word } from '../lib/types'
import type {
  FilterSelection,
  QuizCardRef,
  QuizDirection,
  QuizSession,
  Rng,
} from './types'
import { filterWords } from './filter'
import { isQuizEligible } from '../lib/schema'

export type DirectionChoice = QuizDirection | 'mix'

export interface BuildDeckOptions {
  direction: DirectionChoice
  filter?: FilterSelection
  rng?: Rng
  now?: number
}

/**
 * 絞り込み → クイズ対象（表裏そろい）抽出 → シャッフル → 方向割当 で
 * 新しい進行中セッションを作る。rng/now は seam（テストで差し替え）。
 */
export function buildDeck(
  words: Word[],
  config: Config,
  opts: BuildDeckOptions,
): QuizSession {
  const rng = opts.rng ?? Math.random
  const pool = filterWords(words, config, opts.filter ?? {}).filter((w) =>
    isQuizEligible(w, config),
  )
  const order = shuffle(pool, rng)
  const deck: QuizCardRef[] = order.map((w) => ({
    id: w.id,
    dir: pickDir(opts.direction, rng),
  }))
  return { createdAt: opts.now ?? Date.now(), deck, index: 0, results: {} }
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

function pickDir(choice: DirectionChoice, rng: Rng): QuizDirection {
  if (choice === 'mix') return rng() < 0.5 ? 'term->meaning' : 'meaning->term'
  return choice
}
