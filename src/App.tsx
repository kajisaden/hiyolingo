import { useEffect, useState, type ReactNode } from 'react'
import type { Config, WordsFile } from './lib/types'
import { loadData } from './lib/data'
import {
  applyResolved,
  nextPref,
  readPref,
  resolveTheme,
  savePref,
  type ThemePref,
} from './lib/theme'
import { Dictionary } from './views/Dictionary'
import { Quiz } from './views/Quiz'

type Tab = 'dict' | 'quiz'

export default function App() {
  const [tab, setTab] = useState<Tab>('dict')
  const [state, setState] = useState<{ words: WordsFile; config: Config } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh(bust = false) {
    setLoading(true)
    setError(null)
    try {
      setState(await loadData(bust))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh(false)
  }, [])

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <h1 className="text-lg font-bold">hiyolingo</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href={`${import.meta.env.BASE_URL}guide.html`}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            🐣 使い方
          </a>
          <button
            onClick={() => void refresh(true)}
            disabled={loading}
            title="GitHub上の最新データを取り直します（Notionの変更は最大15分で反映）"
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
          >
            {loading ? '取得中…' : '↻ 最新を取得'}
          </button>
        </div>
      </header>

      <nav className="flex border-b border-slate-200 dark:border-slate-700">
        <TabButton active={tab === 'dict'} onClick={() => setTab('dict')}>
          辞書
        </TabButton>
        <TabButton active={tab === 'quiz'} onClick={() => setTab('quiz')}>
          クイズ
        </TabButton>
      </nav>

      {error && <p className="p-4 text-red-600">読み込みエラー: {error}</p>}
      {!state && !error && (
        <p className="p-4 text-slate-500">読み込み中…</p>
      )}

      {state && tab === 'dict' && (
        <Dictionary data={state.words} config={state.config} />
      )}
      {state && tab === 'quiz' && (
        <Quiz data={state.words} config={state.config} />
      )}

      {state && (
        <footer className="p-4 text-center text-xs text-slate-400">
          <p>{state.words.meta.count} 語 / 生成: {state.words.meta.generatedAt}</p>
          <p className="mt-1">
            Notionでの追加・削除は最大15分でアプリに反映されます
          </p>
        </footer>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-center text-sm font-medium ${
        active
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

/** 画面の色トグル：自動 → ライト → ダーク を巡回。設定は localStorage に保存。 */
function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => readPref(localStorage))

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => applyResolved(resolveTheme(pref, mq.matches))
    apply()
    savePref(pref, localStorage)
    // 自動のときだけ OS の変更に追従する
    if (pref === 'auto') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [pref])

  const icon = pref === 'auto' ? '🖥️' : pref === 'light' ? '☀️' : '🌙'
  const name = pref === 'auto' ? '自動' : pref === 'light' ? 'ライト' : 'ダーク'

  return (
    <button
      onClick={() => setPref(nextPref(pref))}
      title={`画面の色：${name}（押すと 自動→ライト→ダーク）`}
      aria-label={`画面の色を切り替え。今：${name}`}
      className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600"
    >
      {icon}
    </button>
  )
}
