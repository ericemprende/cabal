import type { ChatMessageDTO } from '@/lib/types'

const userSelect = { id: true, name: true, handle: true, avatar: true, walletVerified: true } as const

/** `include` de Prisma para leer un mensaje del chat con autor y cita. */
export const chatMessageInclude = {
  user: { select: userSelect },
  replyTo: { select: { id: true, body: true, user: { select: { id: true, name: true, handle: true } } } },
  likes: { select: { userId: true } },
} as const

type Row = {
  id: string
  body: string
  createdAt: Date
  system: boolean
  linkUrl: string | null
  linkLabel: string | null
  user: { id: string; name: string; handle: string; avatar: string; walletVerified: boolean }
  replyTo: { id: string; body: string; user: { id: string; name: string; handle: string } } | null
  likes: { userId: string }[]
}

export function toChatMessageDTO(m: Row): ChatMessageDTO {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    system: m.system,
    linkUrl: m.linkUrl,
    linkLabel: m.linkLabel,
    user: {
      id: m.user.id,
      name: m.user.name,
      handle: m.user.handle,
      avatar: m.user.avatar,
      walletVerified: m.user.walletVerified,
    },
    // La cita se recorta: basta para reconocer el mensaje original.
    replyTo: m.replyTo ? { id: m.replyTo.id, body: m.replyTo.body.slice(0, 140), user: m.replyTo.user } : null,
    likedBy: m.likes.map((l) => l.userId),
  }
}
