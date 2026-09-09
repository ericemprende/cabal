import sharp from 'sharp'

/*
 * Pasa el arte del hero a WebP con alpha: recorta el margen transparente
 * sobrante (para que la caja del layout coincida con el dibujo) y comprime.
 *
 * Uso: node scripts/prep-home-art.mjs
 */
async function run(src, out) {
  const before = await sharp(src).metadata()
  const r = await sharp(src)
    .ensureAlpha()
    .trim({ threshold: 1 })
    .webp({ quality: 90, effort: 6, alphaQuality: 100 })
    .toFile(out)
  console.log(`${out}  ${before.width}x${before.height} -> ${r.width}x${r.height}  ${(r.size / 1024).toFixed(0)} KB`)
}

await run('imagen home.png', 'public/home-squad.webp')
await run('fondo home.png', 'public/home-mockup-bg.webp')
