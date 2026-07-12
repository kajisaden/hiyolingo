// スプレッドシートの値を正規化したあとの、アプリ内でのデータ型。
// スキーマは固定しない：meta.fields（発見された列）を見て動的描画する。

export type FieldType =
  | 'title'
  | 'rich_text'
  | 'number'
  | 'select'
  | 'status'
  | 'multi_select'
  | 'checkbox'
  | 'date'
  | 'url'
  | 'email'
  | 'phone_number'
  | 'people'
  | 'files'
  | 'formula'
  | 'rollup'
  | 'relation'
  | 'unknown'

/** 正規化後の値。NULL 寛容のため null を許容する。 */
export type FieldValue = string | number | boolean | string[] | null

export interface FieldMeta {
  key: string
  type: FieldType
}

export interface WordsMeta {
  generatedAt: string
  source: string
  subject?: string
  count: number
  /** 発見された列。UIはこの順序・型に従って描画する。 */
  fields: FieldMeta[]
  warnings?: string[]
}

export interface Subject {
  id: 'english' | 'kobun'
  label: string
  dataFile: string
  config: Config
}

export interface Word {
  id: string
  [key: string]: FieldValue | undefined
}

export interface WordsFile {
  meta: WordsMeta
  words: Word[]
}

export interface Config {
  /** クイズの表（お題）／将来のスペル答え */
  termField: string
  /** クイズの裏（答え） */
  meaningField: string
  dictionary: {
    primary: string
    secondary: string
    searchFields: string[]
    hiddenFields: string[]
  }
  quiz: {
    directions: Array<'term->meaning' | 'meaning->term'>
    types: string[]
    /** 絞り込み対象カラム。カラム駆動で拡張可能（UIは当面この配列の先頭数個だけ出す）。 */
    filterFields?: string[]
  }
}
