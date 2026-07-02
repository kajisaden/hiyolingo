// M2 クイズの型定義（宣言のみ）。ロジックは filter.ts / deck.ts / session.ts でTDD。

export type QuizDirection = 'term->meaning' | 'meaning->term'

export type Verdict = 'known' | 'unsure'

/** 出題1枚分の参照（単語IDと、その回の出題方向）。 */
export interface QuizCardRef {
  id: string
  dir: QuizDirection
}

/** 進行中セッションの状態（localStorageに保存して「続きから再開」する対象）。 */
export interface QuizSession {
  createdAt: number
  deck: QuizCardRef[]
  index: number
  results: Record<string, Verdict>
}

/** 絞り込みの選択状態。フィールド名 → 選択値の配列。空配列/未指定はそのフィールド無制約。 */
export type FilterSelection = Record<string, Array<string | number>>

/** 乱数源（テストで差し替え可能にするための seam）。 */
export type Rng = () => number

/** localStorage 互換の最小インターフェース（テストで差し替え可能に）。 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
