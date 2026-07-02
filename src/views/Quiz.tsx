import { useEffect, useMemo, useState } from 'react'
import type { Config, WordsFile } from '../lib/types'
import type { FilterSelection, QuizSession, StorageLike } from '../quiz/types'
import { buildDeck, type DirectionChoice } from '../quiz/deck'
import { availableFilters } from '../quiz/filter'
import {
  currentCardRef,
  gradeCurrent,
  isComplete,
  reconcile,
  retryUnsure,
  summarize,
} from '../quiz/session'
import { clearSession, loadSession, saveSession } from '../quiz/storage'
import { visibleDetailFields } from '../lib/schema'
import { FieldValueView } from '../components/FieldValueView'

const storage: StorageLike | undefined =
  typeof window !== 'undefined' ? window.localStorage : undefined

const DIRECTIONS: { value: DirectionChoice; label: string }[] = [
  { value: 'term->meaning', label: '英 → 日' },
  { value: 'meaning->term', label: '日 → 英' },
  { value: 'mix', label: 'ミックス' },
]

type Phase = 'setup' | 'playing' | 'results'

export function Quiz({ data, config }: { data: WordsFile; config: Config }) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [session, setSession] = useState<QuizSession | null>(null)
  const [resumable, setResumable] = useState<QuizSession | null>(null)
  const [showBack, setShowBack] = useState(false)

  const [direction, setDirection] = useState<DirectionChoice>('term->meaning')
  const [selection, setSelection] = useState<FilterSelection>({})

  const wordsById = useMemo(
    () => new Map(data.words.map((w) => [w.id, w])),
    [data.words],
  )
  const filters = useMemo(
    () => availableFilters(data.words, config),
    [data.words, config],
  )

  // 起動時：未完のセッションがあれば「続きから」を提示（現在の単語一覧で突合）
  useEffect(() => {
    if (!storage) return
    const saved = loadSession(storage)
    if (!saved) return
    const rec = reconcile(saved, data.words)
    if (rec.deck.length > 0 && !isComplete(rec)) setResumable(rec)
    else clearSession(storage)
  }, [data.words])

  function persist(s: QuizSession) {
    if (storage) saveSession(storage, s)
  }

  function start() {
    const s = buildDeck(data.words, config, { direction, filter: selection })
    if (s.deck.length === 0) return
    persist(s)
    setSession(s)
    setResumable(null)
    setShowBack(false)
    setPhase('playing')
  }

  function resume() {
    if (!resumable) return
    persist(resumable)
    setSession(resumable)
    setResumable(null)
    setShowBack(false)
    setPhase('playing')
  }

  function discardResume() {
    if (storage) clearSession(storage)
    setResumable(null)
  }

  function grade(verdict: 'known' | 'unsure') {
    if (!session) return
    const next = gradeCurrent(session, verdict)
    persist(next)
    setSession(next)
    setShowBack(false)
    if (isComplete(next)) setPhase('results')
  }

  function retry() {
    if (!session) return
    const r = retryUnsure(session)
    if (r.deck.length === 0) return
    persist(r)
    setSession(r)
    setShowBack(false)
    setPhase('playing')
  }

  function restart() {
    if (storage) clearSession(storage)
    setSession(null)
    setPhase('setup')
  }

  function toggleFilter(field: string, value: string | number) {
    setSelection((prev) => {
      const cur = prev[field] ?? []
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value]
      return { ...prev, [field]: next }
    })
  }

  // ---- 画面 ----

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-2xl p-4">
        {resumable && (
          <div className="mb-4 rounded-xl border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950">
            <p className="text-sm">
              前回の続きがあります（{resumable.index}/{resumable.deck.length} 問目）。
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={resume}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                続きから
              </button>
              <button
                onClick={discardResume}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                最初から（破棄）
              </button>
            </div>
          </div>
        )}

        <h2 className="text-base font-semibold">出題の方向</h2>
        <div className="mt-2 flex gap-2">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDirection(d.value)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
                direction === d.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {Object.entries(filters).map(([field, values]) =>
          values.length === 0 ? null : (
            <div key={field} className="mt-4">
              <h2 className="text-base font-semibold">{field}で絞り込み</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {values.map((v) => {
                  const on = (selection[field] ?? []).includes(v)
                  return (
                    <button
                      key={String(v)}
                      onClick={() => toggleFilter(field, v)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        on
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {String(v)}
                    </button>
                  )
                })}
              </div>
            </div>
          ),
        )}

        <button
          onClick={start}
          className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white"
        >
          クイズを始める
        </button>
      </div>
    )
  }

  if (phase === 'playing' && session) {
    const card = currentCardRef(session)
    const word = card ? wordsById.get(card.id) : undefined
    if (!card || !word) {
      return <p className="p-8 text-center text-slate-500">カードがありません。</p>
    }
    const frontField =
      card.dir === 'term->meaning' ? config.termField : config.meaningField
    const backField =
      card.dir === 'term->meaning' ? config.meaningField : config.termField
    const supporting = visibleDetailFields(word, data.meta.fields, config).filter(
      (f) => f.key !== frontField && f.key !== backField,
    )

    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-slate-500">
          {session.index + 1} / {session.deck.length}
          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-700">
            {frontField} → {backField}
          </span>
        </p>

        <button
          onClick={() => setShowBack(true)}
          className="mt-3 min-h-56 w-full rounded-2xl border border-slate-200 bg-white p-6 text-left dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="text-2xl font-bold">
            {String(word[frontField] ?? '—')}
          </div>

          {showBack ? (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
              <div className="text-xl text-blue-700 dark:text-blue-300">
                {String(word[backField] ?? '—')}
              </div>
              <dl className="mt-3">
                {supporting.map((f) => (
                  <div key={f.key} className="grid grid-cols-[5rem_1fr] gap-3 py-1">
                    <dt className="text-sm text-slate-500">{f.key}</dt>
                    <dd className="min-w-0">
                      <FieldValueView field={f} value={word[f.key]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">タップで答えを表示</div>
          )}
        </button>

        {showBack && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => grade('unsure')}
              className="rounded-xl border-2 border-amber-400 py-3 font-semibold text-amber-700 dark:text-amber-300"
            >
              あやしい
            </button>
            <button
              onClick={() => grade('known')}
              className="rounded-xl border-2 border-emerald-500 py-3 font-semibold text-emerald-700 dark:text-emerald-300"
            >
              わかった
            </button>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'results' && session) {
    const sum = summarize(session)
    return (
      <div className="mx-auto max-w-2xl p-4">
        <h2 className="text-lg font-bold">結果</h2>
        <p className="mt-2 text-3xl font-bold">
          {sum.known}
          <span className="text-lg font-normal text-slate-500"> / {sum.total} わかった</span>
        </p>

        {sum.unsureIds.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              あやしい（{sum.unsure}）
            </h3>
            <ul className="mt-2 space-y-1">
              {sum.unsureIds.map((id) => {
                const w = wordsById.get(id)
                return (
                  <li key={id} className="text-sm">
                    {String(w?.[config.termField] ?? id)}
                    <span className="text-slate-400">
                      {' '}
                      — {String(w?.[config.meaningField] ?? '')}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {sum.unsure > 0 && (
            <button
              onClick={retry}
              className="w-full rounded-xl bg-amber-500 py-3 font-semibold text-white"
            >
              あやしいだけもう一回（{sum.unsure}問）
            </button>
          )}
          <button
            onClick={restart}
            className="w-full rounded-xl border border-slate-300 py-3 font-semibold dark:border-slate-600"
          >
            最初から
          </button>
        </div>
      </div>
    )
  }

  return null
}
