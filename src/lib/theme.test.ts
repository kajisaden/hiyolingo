import { describe, it, expect } from 'vitest'
import { nextPref, resolveTheme, readPref, savePref } from './theme'

describe('nextPref', () => {
  it('自動→ライト→ダーク→自動 と巡回する', () => {
    expect(nextPref('auto')).toBe('light')
    expect(nextPref('light')).toBe('dark')
    expect(nextPref('dark')).toBe('auto')
  })
})

describe('resolveTheme', () => {
  it('ライト/ダーク指定はOSに関係なくその色', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('自動はOSの希望に従う', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
  })
})

describe('readPref', () => {
  const store = (v: string | null) => ({ getItem: () => v })
  it('保存値を読む', () => {
    expect(readPref(store('dark'))).toBe('dark')
    expect(readPref(store('light'))).toBe('light')
    expect(readPref(store('auto'))).toBe('auto')
  })
  it('未設定・不正値は auto', () => {
    expect(readPref(store(null))).toBe('auto')
    expect(readPref(store('weird'))).toBe('auto')
  })
})

describe('savePref', () => {
  it('auto はキー削除、それ以外は保存', () => {
    const calls: string[] = []
    const store = {
      setItem: (_k: string, v: string) => calls.push('set:' + v),
      removeItem: () => calls.push('remove'),
    }
    savePref('dark', store)
    savePref('auto', store)
    expect(calls).toEqual(['set:dark', 'remove'])
  })
})
