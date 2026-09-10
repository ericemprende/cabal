/**
 * Adjuntar la tarjeta al post de X como foto, en vez de depender de la tarjeta
 * del enlace.
 *
 * El intent de X (`x.com/intent/post`) solo acepta texto y URL: no puede llevar
 * una imagen. Hasta ahora la imagen viajaba como `og:image` del enlace, lo que
 * depende de que el rastreador de X la descargue a tiempo y de su caché, que ya
 * nos ha dejado varios posts sin imagen. Una foto adjunta no depende de nada de
 * eso: X la muestra siempre.
 *
 * Hay dos caminos, según el dispositivo:
 *  - Móvil: la Web Share API manda la imagen y el texto a la app de X de una vez.
 *  - Escritorio: se copia la imagen al portapapeles y se pega con Ctrl+V en el
 *    compositor de X, que la adjunta como foto.
 *
 * Solo corre en el navegador.
 */

/**
 * Ruta de la tarjeta en el mismo origen que la página. `ShareVariant.card` es
 * absoluta (apunta a cabal.army, porque la usa X); para descargarla desde el
 * navegador hace falta la ruta local, o en desarrollo iría a producción y el
 * CORS la bloquearía.
 */
export function sameOriginCardPath(absoluteUrl: string): string {
  const u = new URL(absoluteUrl)
  return `${u.pathname}${u.search}`
}

/** Descarga la tarjeta y la devuelve como `File`, listo para compartir o copiar. */
export async function fetchCardFile(absoluteUrl: string, handle: string): Promise<File> {
  const res = await fetch(sameOriginCardPath(absoluteUrl))
  if (!res.ok) throw new Error('No se pudo cargar la imagen')
  const blob = await res.blob()
  return new File([blob], `cabal-army-${handle}.jpg`, { type: blob.type || 'image/jpeg' })
}

/**
 * Si conviene usar el panel de compartir del sistema.
 *
 * No basta con que el navegador soporte compartir archivos: Chrome en Windows lo
 * soporta, pero abre el panel de Windows, donde X no suele aparecer, y eso es
 * peor que copiar y pegar. Por eso se exige además un puntero táctil, que es la
 * señal de estar en un móvil o una tablet, donde la app de X sí está en el panel.
 */
export function prefersNativeShare(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  if (!navigator.canShare || !window.matchMedia('(pointer: coarse)').matches) return false
  try {
    return navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })
  } catch {
    return false
  }
}

/** Si el navegador puede copiar imágenes al portapapeles. */
export function canCopyImages(): boolean {
  return (
    typeof window !== 'undefined' &&
    'ClipboardItem' in window &&
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard?.write
  )
}

/**
 * Convierte la imagen a PNG: el portapapeles de los navegadores solo admite
 * `image/png`, y la tarjeta se sirve en JPEG.
 */
async function toPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (png) => (png ? resolve(png) : reject(new Error('No se pudo preparar la imagen'))),
      'image/png'
    )
  )
}

/**
 * Copia la imagen al portapapeles.
 *
 * Al `ClipboardItem` se le pasa la promesa de la conversión, no el resultado:
 * Safari exige crear el item dentro del gesto del usuario y rechaza la escritura
 * si antes hay un `await`, pero sí acepta que el contenido llegue después.
 */
export function copyImage(file: Blob): Promise<void> {
  const item = new ClipboardItem({ 'image/png': toPng(file) })
  return navigator.clipboard.write([item])
}

/**
 * Abre el panel de compartir del sistema con la imagen y el texto.
 *
 * El enlace va dentro del texto y no en `url`: cuando se comparten archivos,
 * varias apps (X incluida) descartan el campo `url` y se quedarían sin enlace
 * de referido. Devuelve `false` si la persona cierra el panel sin compartir.
 */
export async function shareNative(file: File, text: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], text })
    return true
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return false
    throw e
  }
}

/** Guarda la imagen en el dispositivo, para adjuntarla a mano desde el selector de X. */
export function downloadImage(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Se libera después del clic: revocarla en el acto cancela la descarga en Safari
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
