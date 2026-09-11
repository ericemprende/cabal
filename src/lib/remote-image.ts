/**
 * Imágenes de tokens alojadas en IPFS.
 *
 * pump.fun (y buena parte de los proyectos de Solana) guarda el logo y el banner
 * como `https://ipfs.io/ipfs/<cid>`. Las pasarelas IPFS públicas no aguantan
 * tráfico real desde navegadores: ipfs.io, dweb.link, w3s.link y nftstorage
 * responden 429 en cuanto hay volumen, y las que sí contestan tardan segundos y
 * sirven el original a tamaño completo (el banner de un token pesaba 1,86 MB).
 * El resultado eran logos y banners rotos en toda la app.
 *
 * Por eso esas imágenes se sirven a través de /api/img/ipfs/<cid>: el servidor
 * las descarga una vez, las reduce y las guarda. Como el contenido de un CID no
 * cambia nunca, la copia vale para siempre.
 *
 * Este módulo no toca red ni disco: lo usan tanto el servidor como el navegador.
 */

/** CIDv0 (Qm…, base58) o CIDv1 en base32 (b…, el que usa pump.fun). */
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/

export function isCid(value: string): boolean {
  return CID_RE.test(value)
}

/**
 * El CID de una URL de IPFS, o null si no lo es. Reconoce los tres formatos
 * habituales: `ipfs://<cid>`, `https://<pasarela>/ipfs/<cid>` y
 * `https://<cid>.ipfs.<pasarela>/`.
 *
 * Solo se aceptan URLs que apuntan al CID en sí, sin subruta: un
 * `/ipfs/<cid>/foto.png` apunta a un archivo dentro de una carpeta y no se
 * puede servir pidiendo solo el CID.
 */
export function ipfsCid(url: string | null | undefined): string | null {
  if (!url) return null
  const value = url.trim()

  const scheme = /^ipfs:\/\/(?:ipfs\/)?([^/?#]+)\/?$/i.exec(value)
  if (scheme) return isCid(scheme[1]) ? scheme[1] : null

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  const pathForm = /^\/ipfs\/([^/]+)\/?$/.exec(parsed.pathname)
  if (pathForm) return isCid(pathForm[1]) ? pathForm[1] : null

  const subdomain = /^([^.]+)\.ipfs\./i.exec(parsed.hostname)
  if (subdomain && (parsed.pathname === '/' || parsed.pathname === '')) {
    return isCid(subdomain[1]) ? subdomain[1] : null
  }
  return null
}

/**
 * La URL con la que hay que pintar una imagen: las de IPFS pasan por la copia
 * del servidor y el resto se deja tal cual. Es un paso sin coste, pensado para
 * aplicarse justo al renderizar, así cubre también los launches guardados antes.
 */
export function displayImageUrl<T extends string | null | undefined>(url: T): T | string {
  const cid = ipfsCid(url)
  return cid ? `/api/img/ipfs/${cid}` : url
}
