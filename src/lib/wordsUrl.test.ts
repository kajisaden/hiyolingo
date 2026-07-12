import { describe, it, expect } from 'vitest'
import { buildWordsUrl } from './wordsUrl'

describe('buildWordsUrl', () => {
  it('DEVは同梱サンプルを指す', () => {
    expect(buildWordsUrl({ dev: true, baseUrl: '/hiyolingo/' })).toBe('/hiyolingo/data/words.json')
  })
  it('教科ごとのデータファイルを指定できる', () => {
    expect(buildWordsUrl({ dev: false, baseUrl: '/', file: 'kobun.json' })).toBe(
      'https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/kobun.json',
    )
  })
  it('PRODはraw取得', () => {
    expect(buildWordsUrl({ dev: false, baseUrl: '/hiyolingo/' })).toBe(
      'https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/words.json',
    )
  })
  it('bust時は?t=を付ける', () => {
    expect(buildWordsUrl({ dev: false, baseUrl: '/hiyolingo/', bust: true, now: 123 })).toBe(
      'https://raw.githubusercontent.com/kajisaden/hiyolingo/main/data/words.json?t=123',
    )
  })
})
