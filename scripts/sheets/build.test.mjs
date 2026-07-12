import { describe, expect, it } from 'vitest'
import { buildWordsFile, hasContentChanged, parseCsv } from './build.mjs'

describe('parseCsv', () => {
  it('カンマ・改行・引用符を含むセルを解析する', () => {
    expect(parseCsv('a,b\n"x,y","line1\nline2"\n"say ""hi""",z')).toEqual([
      ['a', 'b'],
      ['x,y', 'line1\nline2'],
      ['say "hi"', 'z'],
    ])
  })
})

describe('buildWordsFile', () => {
  it('スプレッドシートの行をアプリ用データへ変換する', () => {
    const csv = [
      'id,英単語,タグ,レベル,例文,品詞,意味,関連語,成形状態',
      'eng-000001,apple,名詞；頻出,1,"I eat an apple.（私はりんごを食べる。）",名詞,りんご,fruit；cider,成形済み',
    ].join('\n')
    const file = buildWordsFile({ csv, generatedAt: 'GEN' })
    expect(file.meta.source).toBe('google-sheets')
    expect(file.meta.count).toBe(1)
    expect(file.meta.fields.map(({ key }) => key)).toEqual([
      '英単語', 'タグ', 'レベル', '例文', '品詞', '意味', '関連語',
    ])
    expect(file.words[0]).toMatchObject({
      id: 'eng-000001',
      英単語: 'apple',
      タグ: ['名詞', '頻出'],
      レベル: 1,
      品詞: ['名詞'],
      関連語: ['fruit', 'cider'],
    })
  })

  it('英単語が空の行は除外し、空セルを安全に扱う', () => {
    const file = buildWordsFile({
      csv: 'id,英単語,意味,レベル\neng-1,word,,\neng-2,,,',
      generatedAt: 'GEN',
    })
    expect(file.words).toEqual([{ id: 'eng-1', 英単語: 'word', 意味: null, レベル: null }])
  })
})

describe('hasContentChanged', () => {
  it('生成日時だけの違いは変更とみなさない', () => {
    const a = { meta: { generatedAt: 'A' }, words: [{ id: '1' }] }
    const b = { meta: { generatedAt: 'B' }, words: [{ id: '1' }] }
    expect(hasContentChanged(a, b)).toBe(false)
  })
})
