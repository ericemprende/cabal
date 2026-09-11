import { db } from '@/lib/db'

let seedPromise: Promise<void> | null = null

const MIN = 60 * 1000

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    // Si falla (p. ej. Postgres aún no responde), se olvida para reintentarlo en
    // la siguiente petición. Guardar la promesa rechazada dejaba toda la API
    // devolviendo 500 hasta reiniciar el servidor.
    seedPromise = seed().catch((e) => {
      seedPromise = null
      throw e
    })
  }
  return seedPromise
}

async function seed(): Promise<void> {
  const count = await db.user.count()
  if (count > 0) return

  const now = Date.now()

  // ---------- POINT RULES (editable desde el dashboard admin) ----------
  await db.setting.createMany({
    data: [
      { key: 'points_thesis', value: '25' },
      { key: 'points_comment', value: '5' },
      { key: 'points_launch', value: '40' },
      { key: 'points_like_received', value: '2' },
      { key: 'points_hype_received', value: '1' },
      { key: 'points_daily_visit', value: '3' },
      { key: 'points_share_x', value: '10' },
    ],
  })

  // ---------- USERS ----------
  // Nota: el contenido de ejemplo (launches, tokens, posts) ya NO se genera.
  // El Radar y la pestaña de Tokens arrancan vacíos; todo lo que aparece lo
  // suben los usuarios desde /publicar o el admin.
  const u = async (data: {
    handle: string
    name: string
    avatar: string
    bio?: string
    wallet?: string
    walletVerified?: boolean
    xHandle?: string
    xVerified?: boolean
    googleEmail?: string
    googleVerified?: boolean
    tgHandle?: string
    isDev?: boolean
    isAdmin?: boolean
    cabalScore?: number
    callsWon?: number
    callsTotal?: number
    followers?: number
    isCurrentUser?: boolean
    points?: number
    lifetimePoints?: number
  }) => db.user.create({ data })

  const tu = await u({
    handle: 'tu',
    name: 'Tú',
    avatar: '🐺',
    bio: 'Nuevo en el Cabal. Cazando el próximo 100x antes que nadie.',
    isCurrentUser: true,
    isAdmin: true,
    cabalScore: 10,
    points: 50,
    lifetimePoints: 50,
  })
  const basedDev = await u({
    handle: 'based_dev',
    name: 'Based Dev',
    avatar: '🔧',
    bio: 'Dev verificado. Construyo en Solana. LP siempre bloqueada, mint siempre revocado.',
    wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    walletVerified: true,
    xHandle: 'based_dev',
    xVerified: true,
    tgHandle: 'based_dev',
    isDev: true,
    cabalScore: 920,
    callsWon: 7,
    callsTotal: 9,
    followers: 4820,
    points: 1840,
    lifetimePoints: 2100,
  })
  const cryptonita = await u({
    handle: 'cryptonita',
    name: 'Cryptonita',
    avatar: '👩‍🚀',
    bio: 'Caller. Si lo posteo antes del launch, es porque leí el contrato.',
    wallet: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    walletVerified: true,
    xHandle: 'cryptonita',
    xVerified: true,
    googleEmail: 'cryptonita@gmail.com',
    googleVerified: true,
    tgHandle: 'cryptonita_calls',
    cabalScore: 1450,
    callsWon: 23,
    callsTotal: 31,
    followers: 12400,
    points: 3240,
    lifetimePoints: 3600,
  })
  await u({
    handle: 'degenmike',
    name: 'Degen Mike',
    avatar: '🦈',
    bio: 'Entré a 4K MC en WIF. Pregúntame cómo.',
    cabalScore: 890,
    callsWon: 14,
    callsTotal: 22,
    followers: 8100,
    points: 1620,
    lifetimePoints: 1810,
  })
  await u({
    handle: 'salem',
    name: 'Salem',
    avatar: '🧙',
    bio: 'Lectura de charts y vibras. 60/40 win rate y subiendo.',
    cabalScore: 640,
    callsWon: 9,
    callsTotal: 15,
    followers: 3900,
    points: 980,
    lifetimePoints: 1120,
  })
  await u({
    handle: 'ponzi_pete',
    name: 'Ponzi Pete',
    avatar: '🐍',
    bio: 'lanzo tokens :)',
    wallet: '0xdead0000000000000000000000000000000001',
    isDev: true,
    cabalScore: 60,
    callsWon: 1,
    callsTotal: 8,
    followers: 210,
    points: 40,
    lifetimePoints: 180,
  })
  await u({
    handle: 'nate',
    name: 'Nate',
    avatar: '🦍',
    bio: 'Apilo bananas y memecoins.',
    cabalScore: 720,
    callsWon: 11,
    callsTotal: 18,
    followers: 5200,
    points: 1210,
    lifetimePoints: 1350,
  })
  await u({
    handle: 'wood',
    name: 'Wood',
    avatar: '🌲',
    bio: 'Paciente. Compro el fondo, vendo el hype.',
    cabalScore: 510,
    callsWon: 7,
    callsTotal: 12,
    followers: 2400,
    points: 760,
    lifetimePoints: 890,
  })
  await u({
    handle: 'swizzle',
    name: 'Swizzle',
    avatar: '🍸',
    bio: 'El PR de los launches. Si no tiene memes, no lanza.',
    tgHandle: 'swizzle_pr',
    xHandle: 'swizzle_kol',
    cabalScore: 430,
    callsWon: 6,
    callsTotal: 11,
    followers: 1800,
    points: 690,
    lifetimePoints: 780,
  })
  const elprofe = await u({
    handle: 'elprofe',
    name: 'El Profe',
    avatar: '🎓',
    bio: 'Tesis con fundamentos: holders, LP, bundles y narrativa.',
    googleEmail: 'elprofe.degen@gmail.com',
    googleVerified: true,
    xHandle: 'elprofe_calls',
    xVerified: true,
    cabalScore: 1100,
    callsWon: 18,
    callsTotal: 25,
    followers: 9600,
    points: 2870,
    lifetimePoints: 3150,
  })
  await u({
    handle: 'lambo_lu',
    name: 'Lambo Lu',
    avatar: '🏎️',
    bio: 'De 0 a degen en 3 meses.',
    cabalScore: 380,
    callsWon: 5,
    callsTotal: 10,
    followers: 1500,
    points: 540,
    lifetimePoints: 640,
  })
  await u({
    handle: 'anon47',
    name: 'Anon 47',
    avatar: '👻',
    bio: 'No confíes en nadie. Ni en mí.',
    cabalScore: 290,
    callsWon: 4,
    callsTotal: 9,
    followers: 900,
    points: 430,
    lifetimePoints: 520,
  })
  await u({
    handle: 'kael',
    name: 'Kael',
    avatar: '🐱',
    bio: 'Primer launch en Base. Aprendiendo.',
    wallet: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    walletVerified: true,
    isDev: true,
    cabalScore: 150,
    callsWon: 1,
    callsTotal: 2,
    followers: 340,
    points: 190,
    lifetimePoints: 190,
  })
  // ---------- FOLLOWS (for current user) ----------
  await db.follow.createMany({
    data: [cryptonita, elprofe, basedDev].map((t) => ({
      userId: tu.id,
      targetId: t.id,
    })),
  })

  // bump followers counts
  await db.user.update({ where: { id: cryptonita.id }, data: { followers: { increment: 1 } } })
  await db.user.update({ where: { id: elprofe.id }, data: { followers: { increment: 1 } } })
  await db.user.update({ where: { id: basedDev.id }, data: { followers: { increment: 1 } } })

  // ---------- POINT EVENTS (historial del usuario actual) ----------
  await db.pointEvent.create({
    data: {
      userId: tu.id,
      amount: 50,
      reason: 'admin_adjust',
      note: 'Bono de bienvenida del Cabal',
      createdAt: new Date(now - 2 * MIN),
    },
  })
}
