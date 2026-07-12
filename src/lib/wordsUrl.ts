// words.json の取得元URLを決める。
// DEV=アプリ同梱のサンプル、PROD=raw.githubusercontent.com の同期済みデータ。
const RAW_DATA_BASE = 'https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/'

export function buildWordsUrl(opts: {
  dev: boolean
  baseUrl: string
  bust?: boolean
  now?: number
  file?: string
}): string {
  const file = opts.file ?? 'words.json'
  const base = opts.dev ? `${opts.baseUrl}data/${file}` : `${RAW_DATA_BASE}${file}`
  return opts.bust ? `${base}?t=${opts.now ?? 0}` : base
}
