# hiyolingo

大学受験生向けの英単語帳ツール。**Notion を単語データの唯一の正**とし、**GitHub Pages 上の PWA**で
「辞書」と「クイズ」の2モードを提供する。カラム増加に自動追従し、NULL を寛容に扱う設計。

- 📐 設計書：[`docs/DESIGN.md`](docs/DESIGN.md)

## 概要

```
妹: カスタムGPTに単語を伝える → GPTが意味/関連語/Tips等を埋めて Notion に書き込み
  → GitHub Actions が Notion → words.json に同期
  → GitHub Pages の PWA で 辞書 / クイズ 閲覧（iPhone / iPad）
```

- **閲覧**：妹（PCなし・iPhone/iPad・ChatGPT Plus）
- **保守**：管理者（Claude で開発）
- **費用**：従量課金なし（GitHub Pages / Actions / Notion API は無料枠、GPT Plus は定額）

詳細・データモデル・拡張方針は設計書を参照。
