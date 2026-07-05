// カードから該当単語の Notion ページを開くためのURLを作る。
// Notion ページid（32桁hex・ダッシュ有無どちらでも）→ https://www.notion.so/<32桁>
// サンプルデータのid（"sample-1" 等）や空 → null（＝リンクを出さない）。
export function notionPageUrl(id: string | null | undefined): string | null {
  if (!id) return null
  const hex = id.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) return null
  return `https://www.notion.so/${hex}`
}
