#!/usr/bin/env node
// Iconos de la PWA (y de las tiendas el día de mañana) a partir del logo.
//   bun run icons:pwa
//
// - icon-192 / icon-512: los que pide el manifiesto.
// - maskable-512: con margen del 20% y fondo sólido, para que Android pueda
//   recortarlo en círculo sin comerse el logo.
// - play-512: el mismo maskable, que es el formato del icono de Google Play.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'public/cabal-logo.png'
const OUT = 'public/icons'
const BG = '#0a0b08'

await mkdir(OUT, { recursive: true })

for (const size of [192, 512]) {
  await sharp(SRC).resize(size, size, { fit: 'contain', background: BG }).png().toFile(`${OUT}/icon-${size}.png`)
}

for (const [name, size] of [['maskable-512', 512], ['play-512', 512]]) {
  const inner = Math.round(size * 0.6)
  const logo = await sharp(SRC).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(`${OUT}/${name}.png`)
}

console.log('iconos listos en', OUT)
