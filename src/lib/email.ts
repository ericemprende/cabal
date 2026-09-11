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

export type EmailMessage = { to: string; subject: string; html: string; text: string }

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
          }),
          signal: AbortSignal.timeout(15_000),
        })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${cfg.provider} rechazó el correo (${res.status}): ${detail.slice(0, 200)}`)
  }
}

// ---------- Plantillas ----------

export type CodePurpose = 'verify_email' | 'login' | 'two_factor'

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

/** "e••••@gmail.com": para decir a dónde se mandó el código sin revelarlo entero. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(2, user.length - 2))}@${domain}`
}
