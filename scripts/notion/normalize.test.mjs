import { describe, it, expect } from 'vitest'
import { normalizeValue } from './normalize.mjs'

describe('normalizeValue', () => {
  it('title を連結テキストにする', () => {
    expect(
      normalizeValue({ type: 'title', title: [{ plain_text: 'ubi' }, { plain_text: 'quitous' }] }).value,
    ).toBe('ubiquitous')
  })
  it('空の rich_text は null', () => {
    expect(normalizeValue({ type: 'rich_text', rich_text: [] }).value).toBeNull()
  })
  it('number をそのまま返す', () => {
    expect(normalizeValue({ type: 'number', number: 3 }).value).toBe(3)
  })
  it('未入力の number は null', () => {
    expect(normalizeValue({ type: 'number', number: null }).value).toBeNull()
  })
  it('select は選択名', () => {
    expect(normalizeValue({ type: 'select', select: { name: '形容詞' } }).value).toBe('形容詞')
  })
  it('未選択の select は null', () => {
    expect(normalizeValue({ type: 'select', select: null }).value).toBeNull()
  })
  it('multi_select は名前の配列', () => {
    expect(
      normalizeValue({ type: 'multi_select', multi_select: [{ name: 'a' }, { name: 'b' }] }).value,
    ).toEqual(['a', 'b'])
  })
  it('空の multi_select は空配列', () => {
    expect(normalizeValue({ type: 'multi_select', multi_select: [] }).value).toEqual([])
  })
  it('checkbox は真偽値', () => {
    expect(normalizeValue({ type: 'checkbox', checkbox: true }).value).toBe(true)
  })
  it('date は start（ISO文字列）', () => {
    expect(normalizeValue({ type: 'date', date: { start: '2026-07-01' } }).value).toBe('2026-07-01')
  })
  it('未対応型は null＋warning', () => {
    const r = normalizeValue({ type: 'mystery_type' })
    expect(r.value).toBeNull()
    expect(r.warning).toContain('未対応')
  })
})
