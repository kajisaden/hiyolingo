import type { QuizSession, StorageLike } from './types'

// バージョンをキーに含め、将来フォーマットが変わっても衝突しないようにする。
export const QUIZ_KEY = 'hiyolingo.quiz.session.v1'

export function saveSession(storage: StorageLike, session: QuizSession): void {
  storage.setItem(QUIZ_KEY, JSON.stringify(session))
}

export function loadSession(storage: StorageLike): QuizSession | null {
  const raw = storage.getItem(QUIZ_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isQuizSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearSession(storage: StorageLike): void {
  storage.removeItem(QUIZ_KEY)
}

function isQuizSession(x: unknown): x is QuizSession {
  if (typeof x !== 'object' || x === null) return false
  const s = x as Record<string, unknown>
  return (
    Array.isArray(s.deck) &&
    typeof s.index === 'number' &&
    typeof s.results === 'object' &&
    s.results !== null
  )
}
