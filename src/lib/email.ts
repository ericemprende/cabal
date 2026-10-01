/**
 * Correo transaccional (códigos de seguridad).
 *
 * Proveedor según la clave que exista (la primera gana):
 *  - BREVO_API_KEY   → Brevo: 300 correos/día gratis, sin caducidad
 *  - RESEND_API_KEY  → Resend: 3.000/mes gratis con tope de 100/día
 * Remitente en EMAIL_FROM ("Cabal <no-reply@cabal.army>"); el dominio tiene que
 * estar verificado en el proveedor o los correos acaban en spam o rebotan.
 *
 * Sin proveedor, en desarrollo el correo se imprime en la consola del servidor
 * (así se prueban los códigos en local); en producción se lanza un error, para
 * no dar por enviado un código que nunca llegará.
 */

export type EmailProvider = 'brevo' | 'resend'

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('El envío de correos no está configurado')
  }
}

type Sender = { name: string; email: string }

function parseFrom(raw: string | undefined): Sender | null {
  const v = raw?.trim()
  if (!v) return null
  const m = v.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/)
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim() || 'Cabal', email: m[2] }
  return /^[^\s@]+@[^\s@]+$/.test(v) ? { name: 'Cabal', email: v } : null
}

export function emailConfig(): { provider: EmailProvider; key: string; from: Sender } | null {
  const from = parseFrom(process.env.EMAIL_FROM)
  if (!from) return null
  const brevo = process.env.BREVO_API_KEY?.trim()
  if (brevo) return { provider: 'brevo', key: brevo, from }
  const resend = process.env.RESEND_API_KEY?.trim()
  if (resend) return { provider: 'resend', key: resend, from }
  return null
}

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  /** Cabeceras extra (p. ej. List-Unsubscribe en los correos masivos). */
  headers?: Record<string, string>
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const cfg = emailConfig()
  if (!cfg) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email:dev] → ${msg.to} · ${msg.subject}\n${msg.text}\n`)
      return
    }
    throw new EmailNotConfiguredError()
  }

  const res =
    cfg.provider === 'brevo'
      ? await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': cfg.key, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            sender: cfg.from,
            to: [{ email: msg.to }],
            subject: msg.subject,
            htmlContent: msg.html,
            textContent: msg.text,
            ...(msg.headers ? { headers: msg.headers } : {}),
          }),
          signal: AbortSignal.timeout(15_000),
        })
      : await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${cfg.from.name} <${cfg.from.email}>`,
            to: [msg.to],
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
            ...(msg.headers ? { headers: msg.headers } : {}),
          }),
          signal: AbortSignal.timeout(15_000),
        })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${cfg.provider} rechazó el correo (${res.status}): ${detail.slice(0, 200)}`)
  }
}

// ---------- Plantillas ----------

export type CodePurpose = 'verify_email' | 'login' | 'two_factor' | 'reset_password'

const COPY: Record<CodePurpose, { subject: string; intro: string; outro: string }> = {
  verify_email: {
    subject: 'Tu código para verificar el correo · Cabal',
    intro: 'Usa este código para verificar tu correo en Cabal:',
    outro: 'Si no has sido tú, ignora este mensaje: nadie podrá usar tu correo sin este código.',
  },
  login: {
    subject: 'Tu código para entrar en Cabal',
    intro: 'Alguien está iniciando sesión en tu cuenta de Cabal. Si eres tú, usa este código:',
    outro: 'Si no has sido tú, alguien conoce tu contraseña: cámbiala cuanto antes. Sin este código no puede entrar.',
  },
  two_factor: {
    subject: 'Tu código de seguridad · Cabal',
    intro: 'Usa este código para cambiar la verificación en dos pasos de tu cuenta de Cabal:',
    outro: 'Si no has sido tú, ignora este mensaje y revisa tu cuenta.',
  },
  reset_password: {
    subject: 'Tu código para cambiar la contraseña · Cabal',
    intro: 'Alguien pidió cambiar la contraseña de tu cuenta de Cabal. Si eres tú, usa este código:',
    outro: 'Si no has sido tú, ignora este mensaje: tu contraseña sigue igual y nadie puede cambiarla sin este código.',
  },
}

export function codeEmail(code: string, purpose: CodePurpose): { subject: string; html: string; text: string } {
  const c = COPY[purpose]
  const text = `${c.intro}\n\n${code}\n\nCaduca en 10 minutos.\n\n${c.outro}\n\n— Cabal · cabal.army`
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#0a0b08;font-family:Arial,Helvetica,sans-serif;color:#e8ebe2">
  <div style="max-width:440px;margin:0 auto;background:#121410;border:1px solid #2a2e24;border-radius:16px;padding:28px">
    <p style="margin:0 0 18px;font-size:13px;font-weight:bold;letter-spacing:2px;color:#8FA83F">CABAL</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.5">${c.intro}</p>
    <p style="margin:0 0 18px;font-size:34px;font-weight:bold;letter-spacing:8px;color:#cddc8f;font-family:'Courier New',monospace">${code}</p>
    <p style="margin:0 0 18px;font-size:13px;color:#9aa08e">Caduca en 10 minutos.</p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7c8272">${c.outro}</p>
  </div>
</body></html>`
  return { subject: c.subject, html, text }
}

/**
 * Aviso Premium de que un launch está a punto de salir. `minutes` es el
 * umbral que se cruzó (10, 5…), no el tiempo exacto que falta.
 */
export function launchAlertEmail(
  launch: { name: string; ticker: string | null },
  minutes: number,
  appUrl: string
): { subject: string; html: string; text: string } {
  const label = launch.ticker ? `$${launch.ticker} · ${launch.name}` : launch.name
  const subject = `⏰ ${label} lanza en ${minutes} minutos`
  const intro = `Diste hype o sigues al dev de este proyecto. Faltan ${minutes} minutos para su lanzamiento:`
  const text = `${intro}\n\n${label}\n\n${appUrl}\n\n— Cabal · aviso Premium. Puedes apagarlo desde tu perfil.`
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#0a0b08;font-family:Arial,Helvetica,sans-serif;color:#e8ebe2">
  <div style="max-width:440px;margin:0 auto;background:#121410;border:1px solid #2a2e24;border-radius:16px;padding:28px">
    <p style="margin:0 0 18px;font-size:13px;font-weight:bold;letter-spacing:2px;color:#8FA83F">CABAL · PREMIUM</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.5">${intro}</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#cddc8f">${label}</p>
    <a href="${appUrl}" style="display:inline-block;background:#8FA83F;color:#0a0b08;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px">Ver en Cabal →</a>
    <p style="margin:22px 0 0;font-size:11px;line-height:1.5;color:#7c8272">Aviso Premium. Puedes apagarlo desde tu perfil en Cabal cuando quieras.</p>
  </div>
</body></html>`
  return { subject, html, text }
}

/**
 * Aviso de la campanita: el usuario pidió que le avisaran de este launch.
 * `minutes` es lo que falta de verdad (normalmente 60).
 */
export function launchReminderEmail(
  launch: { name: string; ticker: string | null; isPrivate: boolean },
  minutes: number,
  launchUrl: string
): { subject: string; html: string; text: string } {
  const raw = launch.ticker && !launch.isPrivate ? `$${launch.ticker} · ${launch.name}` : launch.name
  const label = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const when = minutes >= 60 ? `${Math.round(minutes / 60)} hora${Math.round(minutes / 60) === 1 ? '' : 's'}` : `${minutes} minutos`
  const subject = `🔔 ${raw} sale en ${when}`
  const intro = `Activaste la campanita de este proyecto. Sale en ${when}:`
  const text = `${intro}\n\n${raw}\n\n${launchUrl}\n\n— Cabal. Quita la campanita en la tarjeta del proyecto para no recibir más avisos de él.`
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#0a0b08;font-family:Arial,Helvetica,sans-serif;color:#e8ebe2">
  <div style="max-width:440px;margin:0 auto;background:#121410;border:1px solid #2a2e24;border-radius:16px;padding:28px">
    <p style="margin:0 0 18px;font-size:13px;font-weight:bold;letter-spacing:2px;color:#8FA83F">CABAL · RECORDATORIO</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.5">${intro}</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#cddc8f">${label}</p>
    <a href="${launchUrl}" style="display:inline-block;background:#8FA83F;color:#0a0b08;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px">Ver en Cabal →</a>
    <p style="margin:22px 0 0;font-size:11px;line-height:1.5;color:#7c8272">Quita la campanita en la tarjeta del proyecto para no recibir más avisos de él.</p>
  </div>
</body></html>`
  return { subject, html, text }
}

/** Escapa texto para meterlo en el HTML de un correo. */
function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Marco común de los correos: tarjeta oscura con la cabecera verde de Cabal. */
function frame(opts: { kicker: string; body: string; footer: string }): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#0a0b08;font-family:Arial,Helvetica,sans-serif;color:#e8ebe2">
  <div style="max-width:480px;margin:0 auto;background:#121410;border:1px solid #2a2e24;border-radius:16px;padding:28px">
    <p style="margin:0 0 18px;font-size:13px;font-weight:bold;letter-spacing:2px;color:#8FA83F">${opts.kicker}</p>
    ${opts.body}
    <p style="margin:22px 0 0;font-size:11px;line-height:1.5;color:#7c8272">${opts.footer}</p>
  </div>
</body></html>`
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:#8FA83F;color:#0a0b08;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px">${label}</a>`
}

function para(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${text}</p>`
}

/**
 * Al autor de un launch: llegó la hora y no puso el contrato, así que en Cabal
 * sale "Esperando CA" y nadie puede comprar.
 */
export function missingContractEmail(
  launch: { name: string; ticker: string | null; isPrivate: boolean },
  launchUrl: string
): { subject: string; html: string; text: string } {
  const raw = launch.ticker && !launch.isPrivate ? `$${launch.ticker} · ${launch.name}` : launch.name
  const subject = `⚠️ ${raw}: falta el contrato`
  const intro = 'Ya es la hora de tu lanzamiento y todavía no has puesto el contrato (CA). En Cabal aparece como «Esperando CA» y la comunidad no puede comprar.'
  const tip = 'Si lanzas el token dentro de Cabal, el contrato se actualiza solo.'
  const text = `${intro}

${raw}

Pon el contrato aquí: ${launchUrl}

${tip}

— Cabal`
  const html = frame({
    kicker: 'CABAL · FALTA EL CONTRATO',
    body: `${para(intro)}<p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#cddc8f">${esc(raw)}</p>${button(launchUrl, 'Poner el contrato →')}${para('')}${para(tip)}`,
    footer: 'Te llega porque publicaste este lanzamiento en Cabal.',
  })
  return { subject, html, text }
}

/** Aviso de seguridad: la contraseña de la cuenta acaba de cambiar. */
export function passwordChangedEmail(handle: string, appUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Tu contraseña de Cabal ha cambiado'
  const intro = `La contraseña de tu cuenta @${handle} se acaba de cambiar.`
  const warn = 'Si has sido tú, no tienes que hacer nada. Si no, entra en Cabal y usa "¿Olvidaste tu contraseña?" para recuperarla cuanto antes.'
  const text = `${intro}\n\n${warn}\n\n${appUrl}\n\n— Cabal · cabal.army`
  const html = frame({
    kicker: 'CABAL · SEGURIDAD',
    body: para(esc(intro)) + para(esc(warn)) + button(appUrl, 'Ir a Cabal →'),
    footer: 'Este aviso se envía siempre que cambia la contraseña, para que nadie lo haga sin que te enteres.',
  })
  return { subject, html, text }
}

/** Bienvenida: se manda una vez, al verificar el correo por primera vez. */
export function welcomeEmail(name: string, appUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Bienvenido al Cabal 🐺'
  const lines = [
    `Hola ${name}, tu correo ya está verificado y tu cuenta protegida.`,
    'Lo que puedes hacer desde ya: dar hype a los launches que te gusten, publicar tus calls y tesis, y activar la campanita para que te avisemos antes de que salga un proyecto.',
    'Cada acción suma puntos para el airdrop. Si invitas a alguien con tu código, también sumas por su actividad.',
  ]
  const text = `${lines.join('\n\n')}\n\n${appUrl}\n\n— Cabal · cabal.army`
  const html = frame({
    kicker: 'CABAL · BIENVENIDA',
    body: lines.map((l) => para(esc(l))).join('') + button(appUrl, 'Entrar en Cabal →'),
    footer: 'Te escribimos solo para lo importante: seguridad de tu cuenta, avisos que actives y grandes novedades del proyecto.',
  })
  return { subject, html, text }
}

/**
 * Anuncio masivo (p. ej. el lanzamiento oficial). El texto lo escribe el admin:
 * los párrafos se separan con una línea en blanco. Lleva siempre el enlace de baja.
 */
export function announcementEmail(opts: {
  subject: string
  body: string
  ctaLabel: string
  ctaUrl: string
  unsubscribeUrl: string
}): { subject: string; html: string; text: string } {
  const paragraphs = opts.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const text = `${paragraphs.join('\n\n')}\n\n${opts.ctaLabel}: ${opts.ctaUrl}\n\n— Cabal · cabal.army\nDarte de baja de estas novedades: ${opts.unsubscribeUrl}`
  const html = frame({
    kicker: 'CABAL',
    body:
      paragraphs.map((p) => para(esc(p).replace(/\n/g, '<br>'))).join('') + button(opts.ctaUrl, `${esc(opts.ctaLabel)} →`),
    footer: `Recibes esto porque tienes cuenta en Cabal o te apuntaste a la whitelist. <a href="${esc(opts.unsubscribeUrl)}" style="color:#9aa08e">Darme de baja de las novedades</a> (los avisos de seguridad seguirán llegando).`,
  })
  return { subject: opts.subject, html, text }
}

/** "e••••@gmail.com": para decir a dónde se mandó el código sin revelarlo entero. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(2, user.length - 2))}@${domain}`
}
