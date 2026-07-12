import type { Subject, WordsFile } from './types'
import { buildWordsUrl } from './wordsUrl'

// config（役割マップ）は同梱のまま。words のみ DEV/PROD で取得元を切替。
const base = import.meta.env.BASE_URL
export async function loadData(
  subject: Subject,
  bust = false,
): Promise<WordsFile> {
  const wordsUrl = buildWordsUrl({
    dev: import.meta.env.DEV,
    baseUrl: base,
    bust,
    now: Date.now(),
    file: subject.dataFile,
  })
  const wordsRes = await fetch(wordsUrl, { cache: 'no-cache' })
  if (!wordsRes.ok) throw new Error(`words.json の取得に失敗: ${wordsRes.status}`)
  return (await wordsRes.json()) as WordsFile
}
