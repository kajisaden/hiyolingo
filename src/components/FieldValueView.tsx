import type { FieldMeta, FieldValue } from '../lib/types'

/** 型に応じて値を描画する汎用レンダラ。未知の列でも best-effort で表示する。 */
export function FieldValueView({
  field,
  value,
}: {
  field: FieldMeta
  value: FieldValue | undefined
}) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span
            key={i}
            className="rounded-full bg-slate-200 px-2 py-0.5 text-sm dark:bg-slate-700"
          >
            {v}
          </span>
        ))}
      </div>
    )
  }
  if (field.type === 'url' && typeof value === 'string') {
    return (
      <a
        href={value}
        className="break-all text-blue-600 underline"
        target="_blank"
        rel="noreferrer"
      >
        {value}
      </a>
    )
  }
  if (typeof value === 'boolean') {
    return <span>{value ? '✓' : '—'}</span>
  }
  return <span className="whitespace-pre-wrap">{String(value)}</span>
}
