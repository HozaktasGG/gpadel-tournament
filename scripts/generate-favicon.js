const sharp = require('sharp')

async function run() {
  const src = 'public/smashpadel_logo.png'

  await sharp(src).resize(32, 32).png().toFile('public/favicon.ico')
  console.log('✓ public/favicon.ico')

  await sharp(src).resize(192, 192).png().toFile('public/icon-192.png')
  console.log('✓ public/icon-192.png')

  await sharp(src).resize(512, 512).png().toFile('public/icon-512.png')
  console.log('✓ public/icon-512.png')

  await sharp(src).resize(180, 180).png().toFile('public/apple-touch-icon.png')
  console.log('✓ public/apple-touch-icon.png')
}

run()
