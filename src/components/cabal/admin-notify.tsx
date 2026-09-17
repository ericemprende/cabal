'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Play, RefreshCw, Send, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { timeAgo } from '@/lib/cabal'
import { useAdminNotify, useAdminNotifyAction, useAdminNotifyUpdate } from '@/lib/notify-client'

const DISPATCH_LABEL: Record<string, string> = {
  'launch:new': 'Launch nuevo',
  'launch:soon': 'Recordatorio 1 h',
  post: 'Tesis',
}

/** Panel admin → Telegram y Discord: conectar el bot, estado del webhook y envíos recientes. */
export function AdminNotify({ enabled }: { enabled: boolean }) {
  const q = useAdminNotify(enabled)
  const update = useAdminNotifyUpdate()
  const action = useAdminNotifyAction()
  const [token, setToken] = useState('')
  const [testChat, setTestChat] = useState('')

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!q.data) return <p className="text-sm text-muted-foreground">No se pudo cargar la configuración.</p>
  const tg = q.data.telegram
  const webhookOk = tg.webhook && tg.webhook.url === tg.webhookUrl

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        El bot avisa a los usuarios de la campanita (1 hora antes del lanzamiento) y difunde lanzamientos, recordatorios
        y tesis en los chats, grupos y canales que la gente conecta desde su perfil.
      </p>

      {/* ── Telegram ── */}
      <section className="space-y-3 rounded-xl border border-white/10 bg-[#0a0b08] p-4">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-[#5cc0f0]" aria-hidden />
          <h3 className="font-display text-sm font-bold">Telegram</h3>
          {tg.configured ? (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-[#8FA83F]/12 px-2 py-0.5 text-[11px] font-bold text-primary">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> @{tg.botUsername}
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Sin conectar</span>
          )}
        </div>

        {!tg.configured ? (
          <div className="space-y-2.5">
            <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-muted-foreground">
              <li>
                Abre{' '}
                <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="font-semibold text-[#5cc0f0] hover:underline">
                  @BotFather
                </a>{' '}
                en Telegram y envía <code className="text-primary">/newbot</code>.
              </li>
              <li>Elige nombre y usuario (p. ej. CabalArmyBot) y copia el token que te da.</li>
              <li>Pégalo aquí: se valida, se registra el webhook y los comandos del bot.</li>
            </ol>
            {tg.fromEnv && (
              <p className="text-[11px] text-amber-300">
                Hay un TELEGRAM_BOT_TOKEN en el servidor: deja el campo vacío para usarlo.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                autoComplete="off"
                placeholder="123456789:AA…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-9 border-white/10 bg-[#121410] font-mono text-xs"
              />
              <Button
                onClick={() =>
                  update.mutate(
                    { token },
                    {
                      onSuccess: (r) => {
                        setToken('')
                        toast.success(`Bot @${r.username} conectado`)
                      },
                    }
                  )
                }
                disabled={update.isPending || (!token.trim() && !tg.fromEnv)}
                className="h-9 gap-1.5 rounded-lg bg-[#229ED9] font-bold text-white hover:bg-[#1c8cc2]"
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
              <Switch checked={tg.enabled} disabled={update.isPending} onCheckedChange={(v) => update.mutate({ enabled: v })} />
            </label>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="Usuarios" value={tg.stats.privateChats} />
              <Stat label="Grupos" value={tg.stats.groups} />
              <Stat label="Canales" value={tg.stats.channels} />
              <Stat label="Inactivos" value={tg.stats.inactive} />
              <Stat label="Campanitas" value={tg.stats.reminders} />
            </div>

            <div className="rounded-lg border border-white/8 px-3 py-2.5 text-[12px]">
              <p className="flex items-center gap-1.5 font-semibold">
                {webhookOk ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                )}
                Webhook {webhookOk ? 'registrado' : 'sin registrar o apunta a otra URL'}
              </p>
              <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{tg.webhook?.url || tg.webhookUrl}</p>
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

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => action.mutate({ action: 'webhook' }, { onSuccess: () => toast.success('Webhook registrado') })}
                disabled={action.isPending}
                className="h-8 gap-1.5 rounded-lg border-white/10 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Registrar webhook
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  action.mutate(
                    { action: 'run' },
                    {
                      onSuccess: (r) =>
                        toast.success(
                          `Pasada hecha: ${r.result?.messages ?? 0} mensaje(s), ${r.result?.emails ?? 0} correo(s)`
                        ),
                    }
                  )
                }
                disabled={action.isPending}
                className="h-8 gap-1.5 rounded-lg border-white/10 text-xs"
              >
                <Play className="h-3.5 w-3.5" /> Enviar pendientes ahora
              </Button>
              <a
                href={`https://t.me/${tg.botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Abrir bot <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Chat id (vacío = tu Telegram si lo conectaste en tu perfil)"
                value={testChat}
                onChange={(e) => setTestChat(e.target.value)}
                className="h-8 border-white/10 bg-[#121410] font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={() =>
                  action.mutate(
                    { action: 'test', chatId: testChat.trim() || undefined },
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
                    update.mutate({ disconnect: true })
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

      {/* ── Discord ── */}
      <section className="rounded-xl border border-dashed border-white/10 p-4">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            💬
          </span>
          <h3 className="font-display text-sm font-bold">Discord</h3>
          <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Próximamente</span>
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Los chats vinculados ya guardan el proveedor, así que Discord usará los mismos avisos y preferencias.
        </p>
      </section>

      {/* ── Envíos recientes ── */}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/8 px-3 py-2">
      <p className="font-mono text-lg font-bold text-primary">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}
