import { NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import { discordConfig } from '@/lib/discord'
import { handleDiscordInteraction, type DcInteraction } from '@/lib/discord-bot'

/**
 * POST /api/discord/interactions — comandos y botones del bot de Discord.
 *
 * Discord firma cada petición con la clave de la aplicación (Ed25519 sobre
 * "timestamp + cuerpo"); sin firma válida hay que responder 401, y de hecho
 * Discord comprueba justo eso antes de aceptar la URL en el portal. Por eso se
 * verifica sobre el cuerpo en crudo, antes de parsear el JSON.
 */
export async function POST(req: Request) {
  const cfg = await discordConfig()
  if (!cfg?.publicKey) return NextResponse.json({ error: 'not configured' }, { status: 404 })

  const signature = req.headers.get('x-signature-ed25519') ?? ''
  const timestamp = req.headers.get('x-signature-timestamp') ?? ''
  const raw = await req.text()
  if (!verify(cfg.publicKey, signature, timestamp, raw)) {
    return NextResponse.json({ error: 'invalid request signature' }, { status: 401 })
  }

  const interaction = safeParse(raw)
  if (!interaction) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  try {
    return NextResponse.json(await handleDiscordInteraction(cfg, interaction))
  } catch (e) {
    console.error('[discord] interaction', interaction.id, (e as Error).message)
    // Type 4 con texto: si no se responde algo, el usuario ve "la aplicación no responde"
    return NextResponse.json({
      type: 4,
      data: { content: 'Ahora mismo no he podido con eso. Inténtalo otra vez en un momento.', flags: 64 },
    })
  }
}

function verify(publicKey: string, signature: string, timestamp: string, body: string): boolean {
  if (!/^[0-9a-f]+$/i.test(signature) || !timestamp) return false
  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, 'hex'),
      Buffer.from(publicKey, 'hex')
    )
  } catch {
    return false
  }
}

function safeParse(raw: string): DcInteraction | null {
  try {
    const v = JSON.parse(raw) as DcInteraction
    return typeof v?.type === 'number' ? v : null
  } catch {
    return null
  }
}
