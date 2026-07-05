import { describe, it, expect } from 'vitest'
import { notionPageUrl } from './notionUrl'

describe('notionPageUrl', () => {
  it('ダッシュ付きUUIDを32桁URLにする', () => {
    expect(notionPageUrl('3939cbb5-a954-809f-a537-d535532bd97f')).toBe(
      'https://www.notion.so/3939cbb5a954809fa537d535532bd97f',
    )
  })

  it('ダッシュ無し32桁もそのまま使える', () => {
    expect(notionPageUrl('3939cbb5a954809fa537d535532bd97f')).toBe(
      'https://www.notion.so/3939cbb5a954809fa537d535532bd97f',
    )
  })

  it('大文字は小文字化して受け付ける', () => {
    expect(notionPageUrl('3939CBB5-A954-809F-A537-D535532BD97F')).toBe(
      'https://www.notion.so/3939cbb5a954809fa537d535532bd97f',
    )
  })

  it('サンプルidは null（リンクを出さない）', () => {
    expect(notionPageUrl('sample-1')).toBeNull()
  })

  it('空・null・undefined は null', () => {
    expect(notionPageUrl('')).toBeNull()
    expect(notionPageUrl(null)).toBeNull()
    expect(notionPageUrl(undefined)).toBeNull()
  })

  it('桁数不足や非hexは null', () => {
    expect(notionPageUrl('abc')).toBeNull()
    expect(notionPageUrl('zzzzcbb5-a954-809f-a537-d535532bd97f')).toBeNull()
  })
})
