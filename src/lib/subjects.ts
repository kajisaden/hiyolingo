import type { Subject } from './types'

export const SUBJECTS: Subject[] = [
  {
    id: 'english', label: '英語', dataFile: 'words.json',
    config: {
      termField: '英単語', meaningField: '意味',
      dictionary: { primary: '英単語', secondary: '意味', searchFields: ['英単語', '意味', '関連語', 'イディオム'], hiddenFields: ['id', '_updated'] },
      quiz: { directions: ['term->meaning', 'meaning->term'], types: ['self-grade'], filterFields: ['タグ', 'レベル'] },
    },
  },
  {
    id: 'kobun', label: '古文', dataFile: 'kobun.json',
    config: {
      termField: '古文単語', meaningField: '意味',
      dictionary: { primary: '古文単語', secondary: '意味', searchFields: ['古文単語', '読み', '意味', '関連語'], hiddenFields: ['id', '_updated'] },
      quiz: { directions: ['term->meaning', 'meaning->term'], types: ['self-grade'], filterFields: ['タグ', 'レベル'] },
    },
  },
]
