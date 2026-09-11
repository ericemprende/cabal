import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { isCid } from '@/lib/remote-image'

/**
 * Copia local de las imágenes de IPFS que se muestran en la app (ver
 * lib/remote-image para el porqué).
 *
 * Seguridad: solo se pide un CID, nunca una URL, y siempre a esta lista fija
 * de pasarelas. Así el endpoint no puede usarse para hacer que el servidor
 * descargue direcciones arbitrarias (SSRF).
 */

/**
 * Pasarelas a las que se pide en paralelo; gana la primera que devuelve una
 * imagen. Ninguna es fiable por separado: pinata a veces agota el tiempo
 * buscando fuera de su red y las demás devuelven 429 con frecuencia, pero es
 * raro que fallen todas a la vez.
 */
const GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/',
  'https://nftstorage.link/ipfs/',
]

/** Tiempo máximo por pasarela. En el servidor se puede esperar más que en el navegador. */
const TIMEOUT_MS = 15_000
/** Por encima de esto no es un logo ni un banner, y no se descarga. */
const MAX_BYTES = 20 * 1024 * 1024
/** Lado máximo de la copia. Da para un banner a pantalla completa. */
const MAX_SIDE = 1500

/** Carpeta de la copia. Vive en el volumen persistente (ver docker-compose). */
const DIR = path.join(process.cwd(), 'upload', 'img', 'ipfs')

/**
 * Descargas en curso por CID. Si varias personas abren a la vez un launch cuya
 * imagen aún no está copiada, todas esperan a la misma descarga en vez de
 * lanzar cinco peticiones a las pasarelas cada una.
 */
const inFlight = new Map<string, Promise<Buffer | null>>()

async function fromGateway(gateway: string, cid: string, signal: AbortSignal): Promise<Buffer> {
  const res = await fetch(`${gateway}${cid}`, { signal, redirect: 'follow' })
  if (!res.ok) throw new Error(`${gateway} → ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  // Las pasarelas devuelven sus errores en texto o HTML con código 200 a veces
  if (type && !type.startsWith('image/') && !type.includes('octet-stream')) {
    throw new Error(`${gateway} → ${type}`)
  }
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) throw new Error(`${gateway} → demasiado grande`)
  const body = Buffer.from(await res.arrayBuffer())
  if (body.length > MAX_BYTES) throw new Error(`${gateway} → demasiado grande`)
  return body
}

async function download(cid: string): Promise<Buffer | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const raw = await Promise.any(GATEWAYS.map((g) => fromGateway(g, cid, controller.signal)))
    // Ya hay ganadora: se cancelan las descargas que sigan en marcha
    controller.abort()
    // Reducir y normalizar a WebP. Si sharp no la entiende, no era una imagen.
    return await sharp(raw, { animated: false })
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * La imagen del CID en WebP, desde la copia local o descargándola. Devuelve
 * null si ninguna pasarela la sirve; en ese caso no se guarda nada y se
 * volverá a intentar en la siguiente petición.
 */
export async function getIpfsImage(cid: string): Promise<Buffer | null> {
  if (!isCid(cid)) return null
  const file = path.join(DIR, `${cid}.webp`)

  try {
    return await readFile(file)
  } catch {
    // Aún no está copiada
  }

  const pending = inFlight.get(cid)
  if (pending) return pending

  const job = (async () => {
    const image = await download(cid)
    if (image) {
      try {
        await mkdir(DIR, { recursive: true })
        await writeFile(file, image)
      } catch {
        // Sin permisos de escritura se sirve igualmente desde memoria
      }
    }
    return image
  })().finally(() => inFlight.delete(cid))

  inFlight.set(cid, job)
  return job
}
