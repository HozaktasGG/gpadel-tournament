// Generates PWA icons + iOS launch screens from public/smashpadel_logo.png.
// Usage: node scripts/generate-pwa-assets.mjs
import sharp from 'sharp'
import fs from 'fs'

const SRC = 'public/smashpadel_logo.png'
const BRAND = '#1a3d2e' // icon background (theme-color)
const LAUNCH_BG = '#0a1f19' // app background

// Circular crop of the round badge (drops the white square corners).
async function badge(size) {
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`)
  return sharp(SRC).resize(size, size).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

async function icon(out, size, scale, bg = BRAND) {
  const inner = Math.round(size * scale)
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: await badge(inner), gravity: 'center' }])
    .png()
    .toFile(out)
  console.log('✓', out)
}

fs.mkdirSync('public/splash', { recursive: true })

await icon('public/apple-touch-icon.png', 180, 0.84)
await icon('public/icon-192.png', 192, 0.84)
await icon('public/icon-512.png', 512, 0.84)
// Maskable: keep the badge inside the 80% safe zone.
await icon('public/icon-maskable-512.png', 512, 0.66)

// iOS launch screens (portrait, device pixels) for iPhone 14 and newer.
export const SPLASH = [
  { w: 1170, h: 2532, dw: 390, dh: 844, r: 3 }, // 14, 13, 12
  { w: 1284, h: 2778, dw: 428, dh: 926, r: 3 }, // 14 Plus
  { w: 1179, h: 2556, dw: 393, dh: 852, r: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 1290, h: 2796, dw: 430, dh: 932, r: 3 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { w: 1206, h: 2622, dw: 402, dh: 874, r: 3 }, // 16 Pro, 17, 17 Pro
  { w: 1320, h: 2868, dw: 440, dh: 956, r: 3 }, // 16 Pro Max, 17 Pro Max
  { w: 1260, h: 2736, dw: 420, dh: 912, r: 3 }, // iPhone Air
]
for (const s of SPLASH) {
  const out = `public/splash/launch-${s.w}x${s.h}.png`
  await sharp({ create: { width: s.w, height: s.h, channels: 4, background: LAUNCH_BG } })
    .composite([{ input: await badge(Math.round(s.w * 0.32)), gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log('✓', out)
}
