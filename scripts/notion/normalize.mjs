// Notion プロパティ値 → プレーンJSON への正規化（純粋関数・IOなし）。
// 空欄は null（配列系は []、checkbox は false）、未対応型は null＋warning。

// リッチテキスト/タイトルの配列を連結。空なら null。
function joinRichText(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const text = arr.map((t) => t?.plain_text ?? '').join('')
  return text.length > 0 ? text : null
}

function resolveFormula(formula) {
  if (formula == null) return null
  switch (formula.type) {
    case 'string':
      return formula.string ?? null
    case 'number':
      return formula.number ?? null
    case 'boolean':
      return formula.boolean === true
    case 'date':
      return formula.date?.start ?? null
    default:
      return null
  }
}

// 1つの Notion プロパティ値を型に応じて変換する。
// 戻り値: { value, warning }（warning は未対応型のときのみ文字列）
export function normalizeValue(prop) {
  if (prop == null || typeof prop !== 'object') return { value: null, warning: null }
  switch (prop.type) {
    case 'title':
      return { value: joinRichText(prop.title), warning: null }
    case 'rich_text':
      return { value: joinRichText(prop.rich_text), warning: null }
    case 'number':
      return { value: prop.number ?? null, warning: null }
    case 'select':
      return { value: prop.select?.name ?? null, warning: null }
    case 'status':
      return { value: prop.status?.name ?? null, warning: null }
    case 'multi_select':
      return { value: (prop.multi_select ?? []).map((o) => o.name), warning: null }
    case 'checkbox':
      return { value: prop.checkbox === true, warning: null }
    case 'date':
      return { value: prop.date?.start ?? null, warning: null }
    case 'url':
      return { value: prop.url ?? null, warning: null }
    case 'email':
      return { value: prop.email ?? null, warning: null }
    case 'phone_number':
      return { value: prop.phone_number ?? null, warning: null }
    case 'people':
      return {
        value: (prop.people ?? []).map((p) => p.name ?? null).filter((n) => n != null),
        warning: null,
      }
    case 'files':
      return {
        value: (prop.files ?? [])
          .map((f) => f.file?.url ?? f.external?.url ?? null)
          .filter((u) => u != null),
        warning: null,
      }
    case 'formula':
      return { value: resolveFormula(prop.formula), warning: null }
    case 'relation':
      return { value: (prop.relation ?? []).map((r) => r.id), warning: null }
    default:
      return { value: null, warning: `未対応のプロパティ型: ${prop.type}` }
  }
}
