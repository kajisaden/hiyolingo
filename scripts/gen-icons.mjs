// SVG マスターから PWA/favicon 用の PNG 一式を書き出す。
// 使い方: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const icon = readFileSync(join(pub, 'icon.svg'))
const maskable = readFileSync(join(pub, 'icon-maskable.svg'))

const jobs = [
  [icon, 'pwa-192x192.png', 192],
  [icon, 'pwa-512x512.png', 512],
  [icon, 'apple-touch-icon.png', 180],
  [icon, 'favicon-32x32.png', 32],
  [icon, 'favicon-16x16.png', 16],
  [maskable, 'maskable-512x512.png', 512],
]

for (const [buf, name, size] of jobs) {
  await sharp(buf, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(pub, name))
  console.log('wrote', name, `${size}x${size}`)
}
