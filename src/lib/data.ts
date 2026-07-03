import type { Config, WordsFile } from './types'
import { buildWordsUrl } from './wordsUrl'

// config（役割マップ）は同梱のまま。words のみ DEV/PROD で取得元を切替。
const base = import.meta.env.BASE_URL
const CONFIG_URL = `${base}data/config.json`

export async function loadData(
  bust = false,
): Promise<{ words: WordsFile; config: Config }> {
  const wordsUrl = buildWordsUrl({
    dev: import.meta.env.DEV,
    baseUrl: base,
    bust,
    now: Date.now(),
  })
  const configUrl = bust ? `${CONFIG_URL}?t=${Date.now()}` : CONFIG_URL
  const [wordsRes, configRes] = await Promise.all([
    fetch(wordsUrl, { cache: 'no-cache' }),
    fetch(configUrl, { cache: 'no-cache' }),
  ])
  if (!wordsRes.ok) throw new Error(`words.json の取得に失敗: ${wordsRes.status}`)
  if (!configRes.ok) throw new Error(`config.json の取得に失敗: ${configRes.status}`)
  const words = (await wordsRes.json()) as WordsFile
  const config = (await configRes.json()) as Config
  return { words, config }
}
