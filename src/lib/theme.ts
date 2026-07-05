// 画面テーマ（自動 / ライト / ダーク）。
// 'auto' は OS 設定に追従。localStorage に保存し、Tailwind は class ベースの dark:（.dark）で反映する。
export type ThemePref = 'auto' | 'light' | 'dark'
export type Resolved = 'light' | 'dark'

const KEY = 'hiyolingo-theme'
const ORDER: ThemePref[] = ['auto', 'light', 'dark']

/** トグル用：自動 → ライト → ダーク → 自動 と巡回する。 */
export function nextPref(pref: ThemePref): ThemePref {
  return ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]
}

/** 設定と OS の暗色希望から、実際に適用する色を決める。 */
export function resolveTheme(pref: ThemePref, prefersDark: boolean): Resolved {
  if (pref === 'light') return 'light'
  if (pref === 'dark') return 'dark'
  return prefersDark ? 'dark' : 'light'
}

type Readable = Pick<Storage, 'getItem'>
type Writable = Pick<Storage, 'setItem' | 'removeItem'>

/** 保存済みの設定を読む（未設定・不正値は 'auto'）。 */
export function readPref(store: Readable): ThemePref {
  const v = store.getItem(KEY)
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
}

/** 設定を保存する（'auto' はキー削除＝既定に戻す）。 */
export function savePref(pref: ThemePref, store: Writable): void {
  if (pref === 'auto') store.removeItem(KEY)
  else store.setItem(KEY, pref)
}

/** OS が暗色を希望しているか。 */
export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

/** 解決済みの色を <html> に反映（.dark クラス＋color-scheme）。 */
export function applyResolved(
  resolved: Resolved,
  root: HTMLElement = document.documentElement,
): void {
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}
