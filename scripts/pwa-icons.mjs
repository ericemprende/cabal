#!/usr/bin/env node
// Todos los iconos de Cabal a partir de un solo archivo maestro:
//   bun run icons:pwa
//
// Maestro: public/cabal-logo.png (cuadrado, fondo negro, el logo ocupando
// casi todo). Si cambia el logo, se reemplaza ese archivo y se vuelve a
// ejecutar esto: no hay que tocar ningún icono a mano.
//
// Qué sale:
//   src/app/icon.png          favicon del navegador
//   src/app/apple-icon.png    icono de iPhone (sin transparencia, la exige Apple)
//   public/icons/icon-192     manifiesto de la PWA
//   public/icons/icon-512     manifiesto de la PWA
//   public/icons/maskable-512 Android lo recorta en círculo: el logo va más pequeño
//   public/icons/play-512     ficha de Google Play
//   public/cabal-logo.webp    logo suelto para la interfaz, con fondo transparente
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'public/cabal-logo.png'
const OUT = 'public/icons'
const BG = '#0a0b08'

await mkdir(OUT, { recursive: true })

/** El icono tal cual, a un tamaño. */
const plain = (size, file) =>
  sharp(SRC).resize(size, size, { fit: 'cover' }).png().toFile(file)

await plain(192, `${OUT}/icon-192.png`)
await plain(512, `${OUT}/icon-512.png`)
await plain(512, 'src/app/icon.png')
// Apple no admite transparencia en su icono: se aplana sobre el fondo de la marca
await sharp(SRC).resize(180, 180, { fit: 'cover' }).flatten({ background: BG }).png().toFile('src/app/apple-icon.png')

// Maskable: Android recorta un círculo, así que el logo se mete dentro del 80%
// central sobre el fondo de la marca. El de Play usa la misma composición.
const size = 512
const inner = Math.round(size * 0.78)
const logo = await sharp(SRC).resize(inner, inner, { fit: 'cover' }).toBuffer()
for (const name of ['maskable-512', 'play-512']) {
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(`${OUT}/${name}.png`)
}

// Logo suelto para la interfaz (barra de tokens, ranking): ahí va sobre fondos
// oscuros distintos, así que el negro del maestro se vuelve transparente.
// La opacidad sale del brillo de cada píxel: el logo blanco queda entero y el
// fondo desaparece.
{
  const lado = 192
  const { data, info } = await sharp(SRC).resize(lado, lado, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const rgba = Buffer.alloc(lado * lado * 4)
  for (let p = 0; p < lado * lado; p++) {
    const r = data[p * info.channels]
    const g = data[p * info.channels + 1]
    const b = data[p * info.channels + 2]
    const brillo = Math.max(r, g, b)
    // Por debajo de 12 es fondo; el resto sube rápido para no dejar halo gris
    const alpha = brillo <= 12 ? 0 : Math.min(255, Math.round((brillo - 12) * 1.3))
    rgba[p * 4] = r
    rgba[p * 4 + 1] = g
    rgba[p * 4 + 2] = b
    rgba[p * 4 + 3] = alpha
  }
  await sharp(rgba, { raw: { width: lado, height: lado, channels: 4 } })
    .webp({ quality: 92 })
    .toFile('public/cabal-logo.webp')
}

console.log('iconos regenerados desde', SRC)
