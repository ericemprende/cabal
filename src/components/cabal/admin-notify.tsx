'use client'

import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { timeAgo } from '@/lib/cabal'
import { useAdminNotify, useAdminNotifyAction, useAdminNotifyUpdate } from '@/lib/notify-client'
import type { AdminBotDTO, BotProviderName } from '@/lib/notify-types'

const DISPATCH_LABEL: Record<string, string> = {
  'launch:new': 'Launch nuevo',
  'launch:soon': 'Recordatorio',
  call: 'Call nueva',
  post: 'Tesis',
}

const BRAND = { telegram: '#229ED9', discord: '#5865F2' } as const
const BRAND_HOVER = { telegram: '#1c8cc2', discord: '#4752c4' } as const
const BRAND_TEXT = { telegram: '#5cc0f0', discord: '#98a2fa' } as const

/** Panel admin → Telegram y Discord: conectar cada bot, su estado y los envíos recientes. */
export function AdminNotify({ enabled }: { enabled: boolean }) {
  const q = useAdminNotify(enabled)
  const action = useAdminNotifyAction()

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!q.data) return <p className="text-sm text-muted-foreground">No se pudo cargar la configuración.</p>
  const { telegram: tg, discord: dc } = q.data
  const webhookOk = tg.webhook && tg.webhook.url === tg.webhookUrl

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Los bots avisan a los usuarios de la campanita (con la antelación que cada uno elija) y difunden lanzamientos,
        recordatorios y tesis en los chats, grupos, canales y servidores que la gente conecta desde su perfil.
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0a0b08] px-4 py-3">
        <div>
          <p className="font-mono text-lg font-bold text-primary">{q.data.reminders}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campanitas activas</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            action.mutate(
              { action: 'run' },
              {
                onSuccess: (r) =>
                  toast.success(`Pasada hecha: ${r.result?.messages ?? 0} mensaje(s), ${r.result?.emails ?? 0} correo(s)`),
              }
            )
          }
          disabled={action.isPending}
          className="ml-auto h-8 gap-1.5 rounded-lg border-white/10 text-xs"
        >
          <Play className="h-3.5 w-3.5" /> Enviar pendientes ahora
        </Button>
      </div>

      <BotSection
        provider="telegram"
        title="Telegram"
        icon={<Send className="h-4 w-4" style={{ color: BRAND_TEXT.telegram }} aria-hidden />}
        bot={tg}
        tokenPlaceholder="123456789:AA…"
        envVar="TELEGRAM_BOT_TOKEN"
        refreshLabel="Registrar webhook"
        openHref={tg.botUsername ? `https://t.me/${tg.botUsername}` : null}
        testPlaceholder="Chat id (vacío = tu Telegram si lo conectaste en tu perfil)"
        setup={
          <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-muted-foreground">
            <li>
              Abre{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="font-semibold hover:underline"
                style={{ color: BRAND_TEXT.telegram }}
              >
                @BotFather
              </a>{' '}
              en Telegram y envía <code className="text-primary">/newbot</code>.
            </li>
            <li>Elige nombre y usuario (p. ej. CabalArmyBot) y copia el token que te da.</li>
            <li>Pégalo aquí: se valida, se registra el webhook y los comandos del bot.</li>
          </ol>
        }
        status={
          <div className="rounded-lg border border-white/8 px-3 py-2.5 text-[12px]">
            <p className="flex items-center gap-1.5 font-semibold">
              {webhookOk ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              )}
              Webhook {webhookOk ? 'registrado' : 'sin registrar o apunta a otra URL'}
            </p>
            <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
              {tg.webhook?.url || tg.webhookUrl}
            </p>
            {tg.webhook?.lastError && (
              <p className="mt-1 text-[11px] text-amber-300">
                Último error de Telegram: {tg.webhook.lastError}
                {tg.webhook.lastErrorAt && ` (${timeAgo(tg.webhook.lastErrorAt)})`}
              </p>
            )}
            {!!tg.webhook?.pendingUpdates && (
              <p className="mt-1 text-[11px] text-muted-foreground">{tg.webhook.pendingUpdates} update(s) pendientes</p>
            )}
          </div>
        }
      />

      <BotSection
        provider="discord"
        title="Discord"
        icon={<MessageSquare className="h-4 w-4" style={{ color: BRAND_TEXT.discord }} aria-hidden />}
        bot={dc}
        tokenPlaceholder="MTIz…"
        envVar="DISCORD_BOT_TOKEN"
        refreshLabel="Registrar comandos"
        openHref={dc.invite}
        openLabel="Añadir a un servidor"
        testPlaceholder="Id del canal (vacío = tu Discord si lo conectaste en tu perfil)"
        extraStat={{ label: 'Servidores', value: dc.servers }}
        setup={
          <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-muted-foreground">
            <li>
              Crea una aplicación en{' '}
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="font-semibold hover:underline"
                style={{ color: BRAND_TEXT.discord }}
              >
                Discord Developers
              </a>{' '}
              y, en <span className="text-primary">Bot</span>, pulsa «Reset Token» para copiarlo.
            </li>
            <li>Pégalo aquí: se valida, se guarda la clave pública de la app y se registran los comandos.</li>
            <li>Después habrá que pegar la URL de interacciones en el portal (aparece al conectar).</li>
          </ol>
        }
        status={
          <div className="rounded-lg border border-white/8 px-3 py-2.5 text-[12px]">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Pega esta URL en el portal de Discord
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Developer Portal → tu aplicación → General Information → <b>Interactions Endpoint URL</b>. Discord la
              valida con una petición firmada antes de aceptarla; no se puede registrar por API.
            </p>
            <CopyLine value={dc.interactionsUrl} />
            <p className="mt-2 flex items-center gap-1.5 font-semibold">
              {dc.gateway.connected ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              )}
              Lectura de contratos pegados: {dc.gateway.connected ? 'conectada' : 'sin conectar'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {dc.gateway.error ??
                'Necesita el permiso «Message Content» en Developer Portal → tu aplicación → Bot → Privileged Gateway Intents. Tarda hasta un minuto en levantarse tras conectar el bot.'}
            </p>
          </div>
        }
      />

      {q.data.recent.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Envíos recientes</p>
          {q.data.recent.map((d) => {
            const prefix = d.key.startsWith('post:') ? 'post' : d.key.split(':').slice(0, 2).join(':')
            return (
              <div key={d.key} className="flex items-center gap-2 rounded-lg border border-white/8 px-3 py-1.5 text-[12px]">
                <span className="font-semibold">{DISPATCH_LABEL[prefix] ?? prefix}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">{d.key}</span>
                <span className="text-muted-foreground">{d.sentCount} env.</span>
                <span className="text-[11px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

/**
 * Un bot en el panel. Telegram y Discord se configuran igual (token, pausa,
 * estadísticas, prueba, desconectar); lo que cambia son las instrucciones de
 * alta y el bloque de estado propio de cada uno.
 */
function BotSection({
  provider,
  title,
  icon,
  bot,
  setup,
  status,
  tokenPlaceholder,
  envVar,
  refreshLabel,
  openHref,
  openLabel = 'Abrir bot',
  testPlaceholder,
  extraStat,
}: {
  provider: BotProviderName
  title: string
  icon: ReactNode
  bot: AdminBotDTO
  setup: ReactNode
  status: ReactNode
  tokenPlaceholder: string
  envVar: string
  refreshLabel: string
  openHref: string | null
  openLabel?: string
  testPlaceholder: string
  extraStat?: { label: string; value: number }
}) {
  const update = useAdminNotifyUpdate()
  const action = useAdminNotifyAction()
  const [token, setToken] = useState('')
  const [testChat, setTestChat] = useState('')

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-[#0a0b08] p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-sm font-bold">{title}</h3>
        {bot.configured ? (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-[#8FA83F]/12 px-2 py-0.5 text-[11px] font-bold text-primary">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> {bot.botUsername ? `@${bot.botUsername}` : 'conectado'}
          </span>
        ) : (
          <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
            Sin conectar
          </span>
        )}
      </div>

      {!bot.configured ? (
        <div className="space-y-2.5">
          {setup}
          {bot.fromEnv && (
            <p className="text-[11px] text-amber-300">
              Hay un {envVar} en el servidor: deja el campo vacío para usarlo.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              placeholder={tokenPlaceholder}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-9 border-white/10 bg-[#121410] font-mono text-xs"
            />
            <Button
              onClick={() =>
                update.mutate(
                  { provider, token },
                  {
                    onSuccess: (r) => {
                      setToken('')
                      toast.success(`Bot ${r.username ? `@${r.username}` : ''} conectado`)
                    },
                  }
                )
              }
              disabled={update.isPending || (!token.trim() && !bot.fromEnv)}
              style={{ backgroundColor: BRAND[provider] }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER[provider])}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND[provider])}
              className="h-9 gap-1.5 rounded-lg font-bold text-white"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Conectar bot
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-white/8 px-3 py-2.5">
            <span>
              <span className="block text-[13px] font-semibold">Envíos activos</span>
              <span className="block text-[11px] text-muted-foreground">
                Pausado, el bot responde comandos pero no manda avisos.
              </span>
            </span>
            <Switch
              checked={bot.enabled}
              disabled={update.isPending}
              onCheckedChange={(v) => update.mutate({ provider, enabled: v })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Usuarios" value={bot.stats.privateChats} />
            <Stat label={provider === 'discord' ? 'Canales' : 'Grupos'} value={bot.stats.groups} />
            <Stat label={provider === 'discord' ? 'Anuncios' : 'Canales'} value={bot.stats.channels} />
            <Stat label="Inactivos" value={bot.stats.inactive} />
            {extraStat && <Stat label={extraStat.label} value={extraStat.value} />}
          </div>

          {status}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                action.mutate({ action: 'refresh', provider }, { onSuccess: () => toast.success(`${refreshLabel}: hecho`) })
              }
              disabled={action.isPending}
              className="h-8 gap-1.5 rounded-lg border-white/10 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {refreshLabel}
            </Button>
            {openHref && (
              <a
                href={openHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {openLabel} <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder={testPlaceholder}
              value={testChat}
              onChange={(e) => setTestChat(e.target.value)}
              className="h-8 border-white/10 bg-[#121410] font-mono text-xs"
            />
            <Button
              size="sm"
              onClick={() =>
                action.mutate(
                  { action: 'test', provider, chatId: testChat.trim() || undefined },
                  { onSuccess: (r) => toast.success(`Mensaje de prueba enviado a ${r.sent} chat(s)`) }
                )
              }
              disabled={action.isPending}
              className="h-8 gap-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground"
            >
              <Send className="h-3.5 w-3.5" /> Probar
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm('¿Quitar el bot? Dejará de enviar avisos y de responder. Los chats vinculados se conservan.')) {
                  update.mutate({ provider, disconnect: true })
                }
              }}
              disabled={update.isPending}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-[#ff8080]"
            >
              <Unplug className="h-3.5 w-3.5" /> Desconectar bot
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function CopyLine({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => toast.success('Copiado'))
      }}
      className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#121410] px-3 py-2 text-left font-mono text-[11px] text-primary"
    >
      <span className="min-w-0 break-all">{value}</span>
      <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/8 px-3 py-2">
      <p className="font-mono text-lg font-bold text-primary">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}
