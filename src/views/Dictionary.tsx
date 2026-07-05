import { useMemo, useState } from 'react'
import type { Config, WordsFile } from '../lib/types'
import { matchesQuery, visibleDetailFields } from '../lib/schema'
import { notionPageUrl } from '../lib/notionUrl'
import { FieldValueView } from '../components/FieldValueView'

/** 辞書モード：一覧・検索・タップで詳細（存在する列だけ表示）。 */
export function Dictionary({
  data,
  config,
}: {
  data: WordsFile
  config: Config
}) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const results = useMemo(
    () => data.words.filter((w) => matchesQuery(w, query, config)),
    [data.words, query, config],
  )

  return (
    <div className="mx-auto max-w-2xl p-4">
      <input
        type="search"
        name="search"
        aria-label="単語を検索"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="検索（英単語・意味・関連語・イディオム）"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800"
      />
      <p className="mt-2 text-sm text-slate-500">{results.length} 件</p>

      <ul className="mt-2 space-y-2">
        {results.map((w) => {
          const primary = w[config.dictionary.primary]
          const secondary = w[config.dictionary.secondary]
          const open = openId === w.id
          const detail = visibleDetailFields(w, data.meta.fields, config)
          const notionUrl = notionPageUrl(w.id)
          return (
            <li
              key={w.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
            >
              <button
                onClick={() => setOpenId(open ? null : w.id)}
                className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="text-lg font-semibold">
                  {String(primary ?? '—')}
                </span>
                <span className="shrink-0 text-slate-500">
                  {secondary != null ? String(secondary) : ''}
                </span>
              </button>
              {open && (
                <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
                  <dl>
                    {detail.map((f) => (
                      <div
                        key={f.key}
                        className="grid grid-cols-[5.5rem_1fr] gap-3 py-1"
                      >
                        <dt className="text-sm text-slate-500">{f.key}</dt>
                        <dd className="min-w-0">
                          <FieldValueView field={f} value={w[f.key]} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {notionUrl && (
                    <a
                      href={notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      🔗 Notion で開く（編集・削除）
                    </a>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
