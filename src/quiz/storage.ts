import type { QuizSession, StorageLike } from './types'

// バージョンをキーに含め、将来フォーマットが変わっても衝突しないようにする。
export const QUIZ_KEY = 'hiyolingo.quiz.session.v1'
const keyFor = (subject = 'english') => `${QUIZ_KEY}.${subject}`

export function saveSession(storage: StorageLike, session: QuizSession, subject = 'english'): void {
  storage.setItem(keyFor(subject), JSON.stringify(session))
}

export function loadSession(storage: StorageLike, subject = 'english'): QuizSession | null {
  const raw = storage.getItem(keyFor(subject))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isQuizSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearSession(storage: StorageLike, subject = 'english'): void {
  storage.removeItem(keyFor(subject))
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
