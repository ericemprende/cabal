import { db } from '@/lib/db'

let seedPromise: Promise<void> | null = null

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seed()
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
    ],
  })

  // ---------- USERS ----------
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
    points: 132,
    lifetimePoints: 132,
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
  const degenmike = await u({
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
  const salem = await u({
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
  const ponziPete = await u({
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
  const nate = await u({
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
  const wood = await u({
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
  const swizzle = await u({
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
  const lamboLu = await u({
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
  const anon47 = await u({
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
  const kael = await u({
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

  // ---------- LAUNCHES (pre-launch radar) ----------
  const mkLaunch = (data: {
    name: string
    ticker: string | null
    emoji: string
    image?: string
    banner?: string
    isPrivate?: boolean
    network: string
    launchAt: Date
    description: string
    website?: string
    twitter?: string
    telegram?: string
    hype: number
    lpLocked?: boolean
    mintRevoked?: boolean
    top10Pct?: number
    createdById: string
    createdAt: Date
  }) => db.launch.create({ data })

  const smole = await mkLaunch({
    name: 'Smole Coin',
    ticker: 'SMOL',
    emoji: '🐹',
    image: '/seed/smol.png',
    network: 'solana',
    launchAt: new Date(now + 47 * MIN),
    description:
      'El hamster que nunca vendió. Launch justo, sin allocación del equipo. LP quemada al 100% y mint revocado antes del launch. Comunidad desde el día 1, memes listos, 20 KOLs confirmados en las primeras 2 horas. Narrativa: los pequeños ganan.',
    website: 'https://smol.xyz',
    twitter: 'https://x.com/smolcoin',
    telegram: 'https://t.me/smolcoin',
    hype: 342,
    lpLocked: true,
    mintRevoked: true,
    top10Pct: 9,
    createdById: basedDev.id,
    createdAt: new Date(now - 5 * HOUR),
  })
  const wif2 = await mkLaunch({
    name: 'Wif Hat 2',
    ticker: 'WIF2',
    emoji: '🐶',
    network: 'solana',
    launchAt: new Date(now + 28 * MIN),
    description:
      'La secuela que nadie pidió y todos vamos a comprar..snapshot de holders de WIF para airdrop en el bloque 1. Sin bolsa de valores, sin drama. Solo un perro con sombrero otra vez.',
    twitter: 'https://x.com/wifhat2',
    hype: 587,
    lpLocked: true,
    mintRevoked: false,
    top10Pct: 18,
    createdById: degenmike.id,
    createdAt: new Date(now - 2 * HOUR),
  })
  const ncat = await mkLaunch({
    name: 'Neon Cat',
    ticker: 'NCAT',
    emoji: '🐈‍⬛',
    network: 'base',
    launchAt: new Date(now + 6 * HOUR + 12 * MIN),
    description:
      'Un gato neón para la cadena verde. Primer launch de Kael en Base: contraste total, fee mínimo, comunidad construida en Farcaster desde hace 3 semanas. Arte generado 100% on-chain.',
    website: 'https://neoncat.base',
    twitter: 'https://x.com/neoncat_base',
    hype: 156,
    lpLocked: true,
    mintRevoked: true,
    top10Pct: 14,
    createdById: kael.id,
    createdAt: new Date(now - 20 * HOUR),
  })
  const cabalCoin = await mkLaunch({
    name: 'Cabal Coin',
    ticker: 'CABAL',
    emoji: '🟢',
    image: '/seed/cabal.png',
    banner: '/seed/cabal-banner.png',
    network: 'solana',
    launchAt: new Date(now + 26 * HOUR),
    description:
      'El token de esta comunidad. 0% tax, LP bloqueada 6 meses, mint revocado en vivo durante el stream de lanzamiento. 50% del supply para los 500 primeros miembros verificados del Radar. Si estás aquí temprano, ya sabes.',
    website: 'https://cabal.claims',
    twitter: 'https://x.com/cabalcoin',
    telegram: 'https://t.me/cabalcoin',
    hype: 823,
    lpLocked: true,
    mintRevoked: true,
    top10Pct: 6,
    createdById: cryptonita.id,
    createdAt: new Date(now - 9 * HOUR),
  })
  const gato = await mkLaunch({
    name: 'Gato Gordo',
    ticker: 'GATO',
    emoji: '😺',
    network: 'bsc',
    launchAt: new Date(now + 30 * HOUR + 40 * MIN),
    description:
      'El gato más gordo de BSC. Fair launch puro, sin presale, sin team allocation. Cuidado: el dev no tiene historial verificado todavía, entren con lo que puedan perder.',
    twitter: 'https://x.com/gatogordo_bsc',
    hype: 94,
    lpLocked: false,
    mintRevoked: false,
    top10Pct: 31,
    createdById: anon47.id,
    createdAt: new Date(now - 3 * HOUR),
  })
  const frogk = await mkLaunch({
    name: 'Frog King',
    ticker: 'FROGK',
    emoji: '🐸',
    network: 'ethereum',
    launchAt: new Date(now + 3 * DAY + 4 * HOUR),
    description:
      'La rana que corona a Ethereum mainnet. Tesis de El Profe: la narrativa de ranas siempre corre en ETH cuando BTC lateraliza. Contrato auditado por 2 firmas, distribution check pública.',
    website: 'https://frogking.eth',
    twitter: 'https://x.com/frogkingeth',
    telegram: 'https://t.me/frogking',
    hype: 211,
    lpLocked: true,
    mintRevoked: true,
    top10Pct: 11,
    createdById: elprofe.id,
    createdAt: new Date(now - 30 * HOUR),
  })
  const zpunk = await mkLaunch({
    name: 'Zombie Punks',
    ticker: 'ZPUNK',
    emoji: '🧟',
    network: 'base',
    launchAt: new Date(now + 5 * DAY),
    description:
      'Punks pero zombis pero en Base. Mint gratis + fee de lanzamiento que va 100% a LP. Temporada de Halloween eterna. El PR lo maneja Swizzle, ya saben que habrá hilos.',
    twitter: 'https://x.com/zombiepunks',
    hype: 88,
    lpLocked: false,
    mintRevoked: true,
    top10Pct: 22,
    createdById: swizzle.id,
    createdAt: new Date(now - 14 * HOUR),
  })
  const tucan = await mkLaunch({
    name: 'Tucan Trade',
    ticker: 'TUC',
    emoji: '🦜',
    network: 'tron',
    launchAt: new Date(now + 12 * HOUR),
    description:
      'El loro que repite todo lo que dice la cadena. Experimento social en Tron: el token tuitea sus propias stats cada hora. LP bloqueada 3 meses, mint revocado, audit en curso.',
    website: 'https://tucan.tron',
    hype: 63,
    lpLocked: true,
    mintRevoked: true,
    top10Pct: 17,
    createdById: lamboLu.id,
    createdAt: new Date(now - 7 * HOUR),
  })

  // Ya se lanzó hace 18 minutos → badge EN VIVO (rojo)
  await mkLaunch({
    name: 'Fomo Dog',
    ticker: 'FOMO',
    emoji: '🐕',
    network: 'base',
    launchAt: new Date(now - 18 * MIN),
    description:
      'El perro del FOMO, lanzado hace minutos en Base. Liquidez añadienda en vivo, los primeros holders reportan gráfico limpio. Sigue el launch en vivo desde el canal de la comunidad.',
    twitter: 'https://x.com/fomodog_base',
    hype: 271,
    lpLocked: true,
    mintRevoked: false,
    top10Pct: 15,
    createdById: degenmike.id,
    createdAt: new Date(now - 26 * HOUR),
  })

  // Launch privado: sin ticker público, se reserva hasta el bloque 1
  await mkLaunch({
    name: 'Proyecto Centinela',
    ticker: null,
    emoji: '🚀',
    isPrivate: true,
    network: 'solana',
    launchAt: new Date(now + 9 * HOUR + 25 * MIN),
    description:
      'Launch anunciado en modo privado: el ticker y el contrato se revelan en el bloque 1. Lo único público: el dev ya lanzó antes un token 3x con LP quemada y el snapshot de los primeros 200 hypes tendrá airdrop. Únete al canal cerrado para la alerta.',
    telegram: 'https://t.me/centinela_close',
    hype: 129,
    lpLocked: true,
    mintRevoked: false,
    top10Pct: 20,
    createdById: anon47.id,
    createdAt: new Date(now - 4 * HOUR),
  })

  // ---------- TOKENS (live) ----------
  const mkToken = (data: {
    name: string
    ticker: string
    emoji: string
    network: string
    price: number
    mc: number
    change24h: number
    volume24h: number
    holders: number
    top10Pct: number
    contract: string
    devId: string
    launchedAt: Date
    athMc: number
    isRug?: boolean
  }) => db.token.create({ data })

  const bonk2 = await mkToken({
    name: 'Bonk Two',
    ticker: 'BONK2',
    emoji: '🐕',
    network: 'solana',
    price: 0.000042,
    mc: 42000000,
    change24h: 12.4,
    volume24h: 3100000,
    holders: 21400,
    top10Pct: 12,
    contract: 'BonK2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    devId: basedDev.id,
    launchedAt: new Date(now - 21 * DAY),
    athMc: 61000000,
  })
  const mocha = await mkToken({
    name: 'Mocha',
    ticker: 'MOCH',
    emoji: '☕',
    network: 'solana',
    price: 0.0031,
    mc: 3100000,
    change24h: 45.7,
    volume24h: 890000,
    holders: 4300,
    top10Pct: 16,
    contract: 'moCHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    devId: basedDev.id,
    launchedAt: new Date(now - 4 * DAY),
    athMc: 3400000,
  })
  const ligma = await mkToken({
    name: 'Ligma',
    ticker: 'LIGMA',
    emoji: '🧠',
    network: 'solana',
    price: 0.00087,
    mc: 8700000,
    change24h: -8.2,
    volume24h: 420000,
    holders: 6100,
    top10Pct: 24,
    contract: 'LiGMAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    devId: degenmike.id,
    launchedAt: new Date(now - 9 * DAY),
    athMc: 15200000,
  })
  const gigachad = await mkToken({
    name: 'Gigachad Sol',
    ticker: 'GIGA',
    emoji: '💪',
    network: 'solana',
    price: 0.021,
    mc: 21000000,
    change24h: 88.3,
    volume24h: 5400000,
    holders: 12800,
    top10Pct: 10,
    contract: 'GIGAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    devId: nate.id,
    launchedAt: new Date(now - 15 * DAY),
    athMc: 23000000,
  })
  const doomer = await mkToken({
    name: 'Doomer',
    ticker: 'DOOM',
    emoji: '😩',
    network: 'base',
    price: 0.00012,
    mc: 1200000,
    change24h: -22.5,
    volume24h: 130000,
    holders: 2100,
    top10Pct: 38,
    contract: '0xD00M000000000000000000000000000000000001',
    devId: anon47.id,
    launchedAt: new Date(now - 6 * DAY),
    athMc: 4100000,
  })
  const pepeChain = await mkToken({
    name: 'Pepe Chain',
    ticker: 'PCHAIN',
    emoji: '🐸',
    network: 'base',
    price: 0.000578,
    mc: 5780000,
    change24h: 33.1,
    volume24h: 720000,
    holders: 8900,
    top10Pct: 14,
    contract: '0xPCxxxxxxx0000000000000000000000000000002',
    devId: kael.id,
    launchedAt: new Date(now - 11 * DAY),
    athMc: 9200000,
  })
  const moonx = await mkToken({
    name: 'MoonX',
    ticker: 'MOONX',
    emoji: '🌙',
    network: 'bsc',
    price: 0.0000011,
    mc: 110000,
    change24h: -91.4,
    volume24h: 40000,
    holders: 310,
    top10Pct: 82,
    contract: '0xM00NX0000000000000000000000000000000003',
    devId: ponziPete.id,
    launchedAt: new Date(now - 18 * DAY),
    athMc: 1900000,
    isRug: true,
  })
  const rugPull = await mkToken({
    name: 'RugPull coin',
    ticker: 'RUG',
    emoji: '🪤',
    network: 'bsc',
    price: 0.0000002,
    mc: 9000,
    change24h: -99.2,
    volume24h: 1200,
    holders: 42,
    top10Pct: 97,
    contract: '0xRUG0000000000000000000000000000000000004',
    devId: ponziPete.id,
    launchedAt: new Date(now - 27 * DAY),
    athMc: 2400000,
    isRug: true,
  })
  const solSearch = await mkToken({
    name: 'Sol Searcher',
    ticker: 'SRCH',
    emoji: '🔍',
    network: 'solana',
    price: 0.00034,
    mc: 3400000,
    change24h: 19.8,
    volume24h: 510000,
    holders: 5200,
    top10Pct: 19,
    contract: 'SRCHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    devId: salem.id,
    launchedAt: new Date(now - 2 * DAY),
    athMc: 3600000,
  })
  const forestFren = await mkToken({
    name: 'Forest Fren',
    ticker: 'FREN',
    emoji: '🌳',
    network: 'base',
    price: 0.00091,
    mc: 9100000,
    change24h: 6.9,
    volume24h: 300000,
    holders: 7400,
    top10Pct: 21,
    contract: '0xFRENxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx5',
    devId: wood.id,
    launchedAt: new Date(now - 13 * DAY),
    athMc: 11000000,
  })
  const martini = await mkToken({
    name: 'Martini',
    ticker: 'MRTN',
    emoji: '🍸',
    network: 'ethereum',
    price: 0.0024,
    mc: 24000000,
    change24h: -4.3,
    volume24h: 1800000,
    holders: 9800,
    top10Pct: 13,
    contract: '0xMRTNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx6',
    devId: swizzle.id,
    launchedAt: new Date(now - 30 * DAY),
    athMc: 39000000,
  })
  const tesis = await mkToken({
    name: 'Tesis Token',
    ticker: 'TESIS',
    emoji: '📜',
    network: 'solana',
    price: 0.0069,
    mc: 6900000,
    change24h: 27.4,
    volume24h: 980000,
    holders: 6600,
    top10Pct: 11,
    contract: 'TESISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    devId: elprofe.id,
    launchedAt: new Date(now - 7 * DAY),
    athMc: 8100000,
  })
  const lamboInu = await mkToken({
    name: 'Lambo Inu',
    ticker: 'LINU',
    emoji: '🏎️',
    network: 'tron',
    price: 0.000047,
    mc: 470000,
    change24h: 102.7,
    volume24h: 210000,
    holders: 1900,
    top10Pct: 27,
    contract: 'TLINUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    devId: lamboLu.id,
    launchedAt: new Date(now - 36 * HOUR),
    athMc: 520000,
  })
  const ghost = await mkToken({
    name: 'Ghostface',
    ticker: 'GHST',
    emoji: '👻',
    network: 'ethereum',
    price: 0.0014,
    mc: 1400000,
    change24h: -12.1,
    volume24h: 96000,
    holders: 2900,
    top10Pct: 29,
    contract: '0xGHSTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx7',
    devId: anon47.id,
    launchedAt: new Date(now - 16 * DAY),
    athMc: 5200000,
  })

  // ---------- POSTS (feed / tesis / comentarios) ----------
  const mkPost = (data: {
    kind: string
    content: string
    userId: string
    launchId?: string
    tokenId?: string
    likes?: number
    pnl?: number
    createdAt: Date
  }) => db.post.create({ data })

  // Theses on tokens
  await mkPost({
    kind: 'thesis',
    content:
      'Tesis GIGA: el 88% subió con volumen real, no bundles. Top10 holders al 10%, LP bloqueada y el dev ya entregó 2 tokens limpios. Si rompe los 25M de MC con estos holders, la liquidez del CEX lo manda a 100M. Entré a 12M y no muevo hasta el listing.',
    userId: elprofe.id,
    tokenId: gigachad.id,
    likes: 148,
    createdAt: new Date(now - 8 * HOUR),
  })
  await mkPost({
    kind: 'thesis',
    content:
      'MOCH a 45% en 24h con solo 4 días de vida y 4300 holders. El gráfico es el más limpio que he visto desde BONK. based_dev ya tiene reputación con BONK2, y esta vez el float es más chico. 3M de MC es temprano todavía.',
    userId: cryptonita.id,
    tokenId: mocha.id,
    likes: 96,
    createdAt: new Date(now - 4 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'Ojo con el top10 al 38% en DOOM. Dos wallets entraron 15 minutos después del launch. Huele a preparación de dump.',
    userId: salem.id,
    tokenId: doomer.id,
    likes: 61,
    createdAt: new Date(now - 12 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'dev = ponzi_pete. Ya hizo esto con RUG coin: LP no bloqueada, mint activo y abandono a las 48h. NO entren a MOONX. El historial del dev está en su perfil, es público.',
    userId: cryptonita.id,
    tokenId: moonx.id,
    likes: 204,
    createdAt: new Date(now - 20 * HOUR),
  })
  await mkPost({
    kind: 'thesis',
    content:
      'PCHAIN es la jugada de Base esta semana. Kael verificó wallet, publicó el contrato con anticipación y está haciendo AMA diario en Farcaster. La comunidad crece 300 holders/día sin paid shills. Si toca 10M, HODL hasta 25M.',
    userId: nate.id,
    tokenId: pepeChain.id,
    likes: 87,
    createdAt: new Date(now - 16 * HOUR),
  })
  await mkPost({
    kind: 'trade',
    content: 'Sold 50% de LIGMA. Subió 8 días seguidos y el RSI está por las nubes. Dejo el resto correr con SL en la entrada.',
    userId: degenmike.id,
    tokenId: ligma.id,
    likes: 44,
    pnl: 3120.5,
    createdAt: new Date(now - 2 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'TESIS token con 27% verde y el dev publicando cada movimiento. Así se construye en público. Nada que agregar, solo subir la tesis del Profe.',
    userId: wood.id,
    tokenId: tesis.id,
    likes: 23,
    createdAt: new Date(now - 6 * HOUR),
  })
  await mkPost({
    kind: 'trade',
    content: 'Entré a LINU a 190K MC. Tron necesita su season de memecoins y este tiene los memes más sanos del ecosistema. NFA, pero mi cartera ya es verde.',
    userId: lamboLu.id,
    tokenId: lamboInu.id,
    likes: 38,
    pnl: 412.0,
    createdAt: new Date(now - 9 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'MRTN es el blue chip de esta lista. 30 días, 24M MC y sigue en top de volumen en ETH. Cuando el mercado esté rojo, mira quién resiste: estos son.',
    userId: salem.id,
    tokenId: martini.id,
    likes: 52,
    createdAt: new Date(now - 26 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'SRCH a 2 días de nacer y ya con 5.2K holders. La narrativa de herramientas on-chain está subiendo. Si based_dev lanza SMOL limpio, toda su cartera de devs sube de reputación.',
    userId: cryptonita.id,
    tokenId: solSearch.id,
    likes: 41,
    createdAt: new Date(now - 11 * HOUR),
  })
  await mkPost({
    kind: 'thesis',
    content:
      'FREN: el único token de Base con crecimiento de holders sostenido 3 semanas. Sin KOLs, sin pump & dumps. Wood no tuitea, solo construye. Este es de los que se compran y se olvidan por 6 meses.',
    userId: elprofe.id,
    tokenId: forestFren.id,
    likes: 73,
    createdAt: new Date(now - 30 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'GHST cayendo con la season de ETH. Buen momento para DCA si crees en la narrativa de terror on-chain para Halloween.',
    userId: anon47.id,
    tokenId: ghost.id,
    likes: 12,
    createdAt: new Date(now - 22 * HOUR),
  })

  // Posts on launches (pre-launch hype)
  await mkPost({
    kind: 'thesis',
    content:
      'Tesis WIF2: el snapshot de holders de WIF trae 40K wallets mirando el launch. La primera vela la hacen los bots, la segunda la hace la comunidad. Si el top10 queda bajo 20%, esto vuela. Cuidado con el mint: todavía no lo revocan, les recomiendo esperar al check.',
    userId: elprofe.id,
    launchId: wif2.id,
    likes: 132,
    createdAt: new Date(now - 1 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'SMOL es el launch más limpio del mes: LP quemada, mint revocado, top10 al 9%. based_dev ha entregado 2 tokens sin drama. El hamster se come al perro.',
    userId: cryptonita.id,
    launchId: smole.id,
    likes: 178,
    createdAt: new Date(now - 3 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'Confirmado: 20 KOLs van a tuitear SMOL en la primera hora. Ya vi el grupo. Prepáren sus alerts, el launch es en menos de 1 hora.',
    userId: swizzle.id,
    launchId: smole.id,
    likes: 65,
    createdAt: new Date(now - 40 * MIN),
  })
  await mkPost({
    kind: 'comment',
    content: 'CABAL al 50% para los primeros 500 verificados. Esto es lo que ninguna terminal te da: acceso real a los launches de la comunidad. Yo ya soy de los primeros 100.',
    userId: nate.id,
    launchId: cabalCoin.id,
    likes: 251,
    createdAt: new Date(now - 5 * HOUR),
  })
  await mkPost({
    kind: 'thesis',
    content:
      'Tesis CABAL: las plataformas de comunidad siempre tokenizan cuando el engagement está en el techo. 823 de hype pre-launch sin token es la señal más fuerte que he visto este año. El floor es la comunidad misma.',
    userId: elprofe.id,
    launchId: cabalCoin.id,
    likes: 189,
    createdAt: new Date(now - 7 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'NCAT: Kael publicó el arte on-chain 3 semanas antes del launch. Eso es construir de verdad. Base necesita su gato.',
    userId: salem.id,
    launchId: ncat.id,
    likes: 47,
    createdAt: new Date(now - 18 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'GATO sin LP bloqueada y top10 al 31% = casino. Si entran, usen tamaño de apuesta de casino. El dev no tiene historial.',
    userId: cryptonita.id,
    launchId: gato.id,
    likes: 58,
    createdAt: new Date(now - 2 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'FROGK con doble audit y distribution pública. La narrativa rana siempre corre en ETH. Un poco lejos todavía (3 días) pero es de las tesis más sólidas del radar.',
    userId: wood.id,
    launchId: frogk.id,
    likes: 39,
    createdAt: new Date(now - 24 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'El loro de Tron tuiteando sus propias stats cada hora es el content que este espacio necesitaba 😂',
    userId: anon47.id,
    launchId: tucan.id,
    likes: 29,
    createdAt: new Date(now - 6 * HOUR),
  })

  // General feed posts
  await mkPost({
    kind: 'call',
    content:
      'CALL PÚBLICO: Si SMOL abre bajo 100K MC y el top10 queda bajo 15%, hago thread con las 5 wallets del dev para que todos verifiquen. La ventaja aquí es tener la info ANTES del launch, no después.',
    userId: degenmike.id,
    likes: 91,
    createdAt: new Date(now - 30 * MIN),
  })
  await mkPost({
    kind: 'call',
    content: 'PnL del mes cerrado: +$8,420 gracias a entrar temprano a PCHAIN y MOCH gracias a los posts del Radar. El que informa primero, gana.',
    userId: cryptonita.id,
    likes: 167,
    pnl: 8420.0,
    createdAt: new Date(now - 13 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'Me encanta que esto no sea otro terminal. Aquí se habla, se lee y se decide con tiempo. Los terminales te muestran el token cuando ya es tarde.',
    userId: wood.id,
    likes: 84,
    createdAt: new Date(now - 21 * HOUR),
  })
  await mkPost({
    kind: 'call',
    content: 'Tip del día: antes de entrar a cualquier launch revisen 3 cosas en la tarjeta: LP bloqueada 🔒, mint revocado ⛔ y top10 bajo 20%. Si falla 2 de 3, es casino.',
    userId: elprofe.id,
    likes: 143,
    createdAt: new Date(now - 15 * HOUR),
  })
  await mkPost({
    kind: 'comment',
    content: 'primer día en el Cabal y ya entendí más que en 3 meses de terminales',
    userId: tu.id,
    likes: 12,
    createdAt: new Date(now - 50 * MIN),
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

  // ---------- HYPE VOTES ----------
  await db.vote.createMany({
    data: [
      { userId: tu.id, target: 'launch', targetId: smole.id },
      { userId: tu.id, target: 'launch', targetId: cabalCoin.id },
    ],
  })

  // ---------- POINT EVENTS (historial del usuario actual) ----------
  await db.pointEvent.createMany({
    data: [
      {
        userId: tu.id,
        amount: 40,
        reason: 'launch',
        note: 'Publicaste el launch: SMOLE Coin (SMOL)',
        createdAt: new Date(now - 6 * HOUR),
      },
      {
        userId: tu.id,
        amount: 25,
        reason: 'thesis',
        note: 'Tesis publicada en CABAL Coin',
        createdAt: new Date(now - 5 * HOUR),
      },
      {
        userId: tu.id,
        amount: 5,
        reason: 'comment',
        note: 'Comentario en el feed',
        createdAt: new Date(now - 4 * HOUR),
      },
      {
        userId: tu.id,
        amount: 12,
        reason: 'like_received',
        note: '6 likes recibidos en tus posts',
        createdAt: new Date(now - 3 * HOUR),
      },
      {
        userId: tu.id,
        amount: 50,
        reason: 'admin_adjust',
        note: 'Bono de bienvenida del Cabal',
        createdAt: new Date(now - 2 * HOUR),
      },
    ],
  })
}
