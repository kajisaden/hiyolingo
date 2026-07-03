import { describe, it, expect } from 'vitest'
import { buildFields, normalizePage, buildWordsFile, hasContentChanged } from './build.mjs'

describe('buildFields', () => {
  it('DBプロパティから key/type の配列を作る', () => {
    expect(buildFields({ 英単語: { type: 'title' }, レベル: { type: 'number' } })).toEqual([
      { key: '英単語', type: 'title' },
      { key: 'レベル', type: 'number' },
    ])
  })
})

describe('normalizePage', () => {
  it('ページを id/値/_updated のレコードにする', () => {
    const page = {
      id: 'p1',
      last_edited_time: '2026-07-01T00:00:00.000Z',
      properties: {
        英単語: { type: 'title', title: [{ plain_text: 'candid' }] },
        意味: { type: 'rich_text', rich_text: [] },
      },
    }
    expect(normalizePage(page).record).toEqual({
      id: 'p1',
      英単語: 'candid',
      意味: null,
      _updated: '2026-07-01T00:00:00.000Z',
    })
  })
})

describe('buildWordsFile', () => {
  it('meta と words を組み立てる', () => {
    const database = { properties: { 英単語: { type: 'title' } } }
    const pages = [
      { id: 'p1', last_edited_time: 't', properties: { 英単語: { type: 'title', title: [{ plain_text: 'a' }] } } },
    ]
    const file = buildWordsFile({ database, pages, generatedAt: 'GEN' })
    expect(file.meta.generatedAt).toBe('GEN')
    expect(file.meta.source).toBe('notion')
    expect(file.meta.count).toBe(1)
    expect(file.meta.fields).toEqual([{ key: '英単語', type: 'title' }])
    expect(file.words[0].英単語).toBe('a')
  })
})

describe('hasContentChanged', () => {
  it('generatedAt だけの違いは変化なし', () => {
    const a = { meta: { generatedAt: 'X', count: 1 }, words: [{ id: 'p1' }] }
    const b = { meta: { generatedAt: 'Y', count: 1 }, words: [{ id: 'p1' }] }
    expect(hasContentChanged(a, b)).toBe(false)
  })
  it('words が変われば変化あり', () => {
    const a = { meta: { generatedAt: 'X', count: 1 }, words: [{ id: 'p1' }] }
    const b = { meta: { generatedAt: 'X', count: 1 }, words: [{ id: 'p2' }] }
    expect(hasContentChanged(a, b)).toBe(true)
  })
  it('既存が無ければ変化あり', () => {
    expect(hasContentChanged(null, { meta: {}, words: [] })).toBe(true)
  })
})
