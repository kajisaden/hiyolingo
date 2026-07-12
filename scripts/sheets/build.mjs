const INTERNAL_COLUMNS = new Set(['id', '成形状態'])
const MULTI_VALUE_COLUMNS = new Set(['タグ', '品詞', '関連語'])
const NUMBER_COLUMNS = new Set(['レベル'])

export function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        value += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(value)
      value = ''
    } else if (char === '\n') {
      row.push(value.replace(/\r$/, ''))
      rows.push(row)
      row = []
      value = ''
    } else {
      value += char
    }
  }

  if (value !== '' || row.length > 0) {
    row.push(value.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows
}

function fieldType(key, titleField) {
  if (key === titleField) return 'title'
  if (MULTI_VALUE_COLUMNS.has(key)) return 'multi_select'
  if (NUMBER_COLUMNS.has(key)) return 'number'
  return 'rich_text'
}

function normalizeCell(key, raw) {
  const value = raw?.trim() ?? ''
  if (MULTI_VALUE_COLUMNS.has(key)) {
    return value === '' ? [] : value.split(/[；;]/).map((item) => item.trim()).filter(Boolean)
  }
  if (NUMBER_COLUMNS.has(key)) {
    if (value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  return value === '' ? null : value
}

export function buildWordsFile({ csv, generatedAt, titleField = '英単語', subject = 'english' }) {
  const [headers = [], ...rows] = parseCsv(csv)
  const columns = headers.map((key, index) => ({ key: key.trim(), index }))
  const title = columns.find((column) => column.key === titleField)
  if (!title) throw new Error(`「${titleField}」列が見つかりません。`)

  const fields = columns
    .filter(({ key }) => key !== '' && !INTERNAL_COLUMNS.has(key))
    .map(({ key }) => ({ key, type: fieldType(key, titleField) }))
  const warnings = []
  const words = []

  rows.forEach((row, rowIndex) => {
    const term = row[title.index]?.trim()
    if (!term) return
    const idColumn = columns.find((column) => column.key === 'id')
    const id = idColumn ? row[idColumn.index]?.trim() : ''
    const record = { id: id || `sheet-row-${rowIndex + 2}` }
    if (!id) warnings.push(`${term}: id が空のため行番号から仮IDを生成しました`)

    for (const { key, index } of columns) {
      if (key === '' || INTERNAL_COLUMNS.has(key)) continue
      record[key] = normalizeCell(key, row[index])
    }
    words.push(record)
  })

  words.sort((a, b) => a.id.localeCompare(b.id))
  return {
    meta: {
      generatedAt,
      source: 'google-sheets',
      subject,
      count: words.length,
      fields,
      warnings: [...new Set(warnings)],
    },
    words,
  }
}

function stableStringify(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.keys(item).sort().reduce((result, key) => {
        result[key] = item[key]
        return result
      }, {})
    }
    return item
  })
}

export function hasContentChanged(oldFile, newFile) {
  if (oldFile == null) return true
  const strip = (file) => stableStringify({ ...file, meta: { ...file.meta, generatedAt: null } })
  return strip(oldFile) !== strip(newFile)
}
