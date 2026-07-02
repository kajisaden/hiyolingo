import type { Config, WordsFile } from './types'

// M1: public/data から取得（Vite が base 配下で配信）。
// M3 で words.json の取得元を raw.githubusercontent.com（sync がコミットする
// リポジトリ直下の data/words.json）へ差し替える。config はアプリ側で保持し続ける。
const base = import.meta.env.BASE_URL
const WORDS_URL = `${base}data/words.json`
const CONFIG_URL = `${base}data/config.json`

export async function loadData(
  bust = false,
): Promise<{ words: WordsFile; config: Config }> {
  const q = bust ? `?t=${Date.now()}` : ''
  const [wordsRes, configRes] = await Promise.all([
    fetch(WORDS_URL + q, { cache: 'no-cache' }),
    fetch(CONFIG_URL + q, { cache: 'no-cache' }),
  ])
  if (!wordsRes.ok) throw new Error(`words.json の取得に失敗: ${wordsRes.status}`)
  if (!configRes.ok) throw new Error(`config.json の取得に失敗: ${configRes.status}`)
  const words = (await wordsRes.json()) as WordsFile
  const config = (await configRes.json()) as Config
  return { words, config }
}
