// words.json の取得元URLを決める。
// DEV=アプリ同梱のサンプル、PROD=raw.githubusercontent.com の同期済みデータ。
const RAW_WORDS_URL =
  'https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/words.json'

export function buildWordsUrl(opts: {
  dev: boolean
  baseUrl: string
  bust?: boolean
  now?: number
}): string {
  const base = opts.dev ? `${opts.baseUrl}data/words.json` : RAW_WORDS_URL
  return opts.bust ? `${base}?t=${opts.now ?? 0}` : base
}
