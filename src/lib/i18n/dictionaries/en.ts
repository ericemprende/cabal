import type { Dict } from '@/lib/i18n/dictionaries/es'

/**
 * Textos de la plataforma en inglés. El tipo `Dict` obliga a cubrir todas las
 * claves del español: si falta una, no compila.
 *
 * No es una traducción palabra por palabra. El tono de Cabal en inglés es el
 * mismo que en español (directo, de trinchera, sin marketing hueco), y el
 * argot cripto se deja tal cual lo usa la gente: launch, dev, rug, call.
 */
export const en: Dict = {
  lang: {
    label: 'Language',
    hint: 'Pick the language you want across the whole platform.',
    spanish: 'Spanish',
    english: 'English',
  },

  common: {
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    saving: 'Saving…',
    loading: 'Loading…',
    retry: 'Try again',
    open: 'Open',
    free: 'Free',
  },

  landing: {
    earlyAccess: 'Early access',
    hero: {
      titleTop: 'Get on the radar',
      titleAccent: 'before everyone else',
      body:
        'Cabal is invite-only. Join the waitlist with your X account, lock in your seat and your @handle, and be among the first to see the launches when we open.',
      invitedBy: 'Invited by',
      sharePoints: 'Earn 10 Cabal points by sharing your card after signing up',
      notConfigured: 'X_CLIENT_ID and X_CLIENT_SECRET are not set on the server.',
    },
    cta: {
      continue: 'Finish signing up',
      login: 'Sign in with X',
      unavailable: 'Sign in with X unavailable',
    },
    stats: {
      onList: 'Already on the list',
      seats: 'Seats in the first batch',
      cost: 'Price',
    },
    trust: [
      'Verified with your real X account: no bots, no duplicate accounts.',
      'We never ask to post on your behalf or read your messages.',
      'Your @handle is held for you until launch day.',
    ],
    mockup: {
      before: 'When you sign up we make ',
      card: 'your card',
      after: ' with your picture and your @handle, ready to post on X.',
      squadAlt: 'The Cabal squad: the community that launches and backs projects.',
    },
    benefitsTitle: {
      before: 'Why it pays to be here ',
      accent: 'early',
    },
    benefitsLead:
      "Cabal is not another signals group. It's the public record of who launched what, who called it, and who got it wrong.",
    benefits: [
      {
        title: 'Launches, before they go live',
        body:
          'The Cabal radar collects launches the community posts with a date and a time. You get there at minute zero, not once every group is already talking about it.',
      },
      {
        title: "Every dev's real track record",
        body:
          'Every token is tied to the wallet that launched it, with verified on-chain metrics: all-time high, locked liquidity, revoked mint and previous rugs.',
      },
      {
        title: 'Points you redeem for $CABAL',
        body:
          'Post a thesis, nail a call, bring information: you earn Cabal points. Points earned before launch count double.',
      },
      {
        title: 'A closed community, not a signals group',
        body:
          'Arguments you can check, public debate and reputation that adds up. Call it right and you climb the board; make things up and you run out of credit.',
      },
      {
        title: 'Live streams on launch day',
        body:
          'Devs present their project live from the launch page. Real-time questions before you put in a single dollar.',
      },
      {
        title: 'Founder perks',
        body:
          'Everyone who comes in through the waitlist keeps their seat, their @handle and a founding member badge when we open to the public.',
      },
    ],
    footer: {
      tagline: 'the community that sees launches before anyone else.',
      legal:
        'We only ask for your X account to check you are a real person and to hold your @handle. None of this is financial advice.',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      credits: 'Credits',
    },
    errors: {
      access_denied: 'You cancelled the authorization on X',
      state: 'The session expired, please try again',
      token: 'X rejected the code exchange',
      profile: 'We could not read your X profile',
      no_config: 'Signing in with X is not set up yet',
      server: 'Unexpected error, please try again',
      generic: 'We could not complete your sign-up',
    },
  },

  header: {
    goToRadar: 'Go to the Radar',
    searchPlaceholder: 'Search tokens, people or paste a contract…',
    searchAria: 'Search tokens, launches, people or paste a contract',
    publishLaunch: 'Post a launch',
    you: 'You',
    points: 'Cabal points',
    viewProfile: 'View my profile',
    myCabal: 'My Cabal (profile)',
    affiliates: 'Affiliates',
    premiumOn: 'Your Premium plan',
    premiumOff: 'Go Pro',
    search: 'Search',
    admin: 'Admin dashboard',
    loggingOut: 'Signing out…',
    logout: 'Sign out',
    login: 'Sign in',
    loginShort: 'Sign in',
    userMenu: 'User menu',
  },

  search: {
    title: 'Search',
    placeholder: 'SMOL, @cryptonita, or paste a contract…',
    aria: 'Search Cabal',
    contract: 'Contract · Chart and buy',
    launches: 'Launches · Radar',
    liveTokens: 'Live tokens',
    people: 'People',
    traders: 'Traders',
    private: 'Private',
    noResults: (q: string) => `No results for “${q}”`,
  },

  nav: {
    radar: 'Launch Radar',
    radarShort: 'Radar',
    tokens: 'Tokens',
    feed: 'Feed',
    leaders: 'Leaders',
    chat: 'Chat',
    activity: 'Activity',
    publish: 'Post',
    profile: 'Profile',
    sections: 'Sections',
    activityFab: 'Cabal activity: live launches and theses',
    chatUnread: (n: string) => `Chat, ${n} unread messages`,
  },

  radar: {
    all: 'All',
    statusAria: 'Launch status',
    status: { active: 'Upcoming', ended: 'Finished', all: 'All' },
    byDate: 'By date',
    mostHype: 'Most hype',
    publish: 'Post',
    publishLaunch: 'Post a launch',
    emptyTitle: 'No launches match this filter',
    emptyBody: (points: number) => `Be the first to tip off the community (+${points} points)`,
    featured: 'Featured',
    hypes: (n: number) => `${n} hypes`,
    giveHype: 'Give hype',
    roleDev: 'DEV',
    roleScout: 'SCOUT',
    roleDevTitle: "Posted by the project's own dev",
    roleScoutTitle: 'Found by the community',
    launchingNow: 'Launching now',
    alreadyOut: 'Already out',
    estimatedDate: 'Estimated date',
    launchesIn: 'Launches in',
    devVerified: 'Verified dev',
    devUnverified: 'Unverified dev',
    communityPost: 'Community post',
    officialTitle: 'Official launch verified by Cabal',
    chart: 'Chart',
    chartTitle: 'See the live chart on the launch page',
    chartAria: 'Open the live chart on the launch page',
  },

  tokens: {
    sort: {
      trending: 'Trending',
      new: 'New',
      winners: 'Winners',
      losers: 'Losers',
      risk: 'Risk',
    },
    col: {
      token: 'Token',
      network: 'Chain',
      price: 'Price',
      mc: 'Market cap',
      change: '24h',
      holders: 'Holders',
      volume: '24h vol',
      dev: 'Dev',
    },
    officialTitle: 'Official token verified by Cabal',
    noHolders: 'No holder data yet',
    unverifiedDev: 'Unverified dev',
    unverified: 'Unverified',
  },

  feed: {
    kinds: { thesis: 'Thesis', call: 'Call', comment: 'Comment' },
    placeholder: 'Share a thesis, a call or your latest move… people read here before they buy.',
    writeAria: 'Write a post',
    contractPlaceholder: 'CA / token contract (required for a call)',
    contractAria: 'Token contract',
    checking: 'Checking the contract…',
    token: 'Token',
    detectedIn: 'found on',
    withImage: ' · with image',
    withoutImage: ' · no image yet',
    network: 'chain',
    notFound:
      'We could not find it on DexScreener or pump.fun. Check the contract or the chain before posting: the image and the live result may not show up.',
    publish: 'Post',
    pointsStrip: 'Cabal points:',
    pointsDetail: (thesis: number, launch: number, like: number) =>
      ` thesis +${thesis} · launch posted +${launch} · likes received +${like} · redeemable for $CABAL airdrop tokens`,
  },

  leaderboard: {
    boards: { callers: 'Top Callers', points: 'Cabal points', devs: 'Devs', clans: 'Clans' },
    community: 'Community',
    allCabal: 'All of Cabal',
    period: 'Period',
    periods: { '24h': '24h', '7d': '7 days', '30d': '30 days', all: 'All time' },
    noCallsTitle: 'Nobody has a settled call in this period',
    noCallsBody: 'Post a call with the token CA in the Feed: its result is worked out in a few minutes.',
    noClansTitle: 'No community is running the bot yet',
    noClansBody:
      'A clan is your Telegram group or your Discord server, as it is: add the Cabal bot and the calls made there count here.',
    howToAdd: 'How to add it',
    online: (n: string) => ` · ${n} online`,
    callers: (n: number) => ` · ${n} caller${n === 1 ? '' : 's'}`,
    cabalScore: 'Cabal Score',
    inCabal: 'on Cabal',
    membersInCabal: (n: string, one: boolean) => `${n} ${one ? 'member has' : 'members have'} a Cabal account`,
    calls: 'Calls',
    hits: 'Hit rate',
    hitsOf: (wins: number, calls: number) => `${wins} of ${calls}`,
    bestCall: 'Best call',
    theirTopCallers: 'Their top callers',
    seeTheirCallers: 'See their callers',
    join: 'Join',
    joinAria: (name: string, provider: string) => `Join ${name} on ${provider}`,
    profileOf: (handle: string) => `@${handle}'s profile`,
    hitsLine: (wins: number, calls: number, rate: number) => `${wins}/${calls} hits · ${rate}%`,
    best: 'best',
    points: 'points',
    follow: 'Follow',
    howScored: 'How is it scored?',
    tierTop: (x: number) => `${x}X or more`,
    scoreIntro:
      'Every call scores by the peak the token hit after it was posted (high since the call ÷ entry price).',
    scoreLoss: (win: number, drop: number) => `Never reaches ${win}X and drops more than ${drop}%`,
    scoreOutro: (win: number) =>
      `A hit is a peak of ${win}X or more. Results refresh every few minutes and are locked after 30 days.`,
  },

  activity: {
    title: 'Cabal activity',
    live: 'Live activity',
    filter: 'Filter activity',
    filters: { all: 'All', launch: 'Launches', post: 'Theses', chat: 'Chat' },
    unread: (n: string) => `${n} unread`,
    show: 'Show Cabal activity',
    hide: 'Hide Cabal activity',
    chatAria: (online: number, unread: string) =>
      `Cabal chat, ${online} online${unread ? `, ${unread} unread` : ''}`,
    nobodyOnline: 'Nobody online yet',
    onlineCount: (n: number) => `${n} online`,
    more: (n: number) => `+${n} more`,
    empty: 'Nothing of this kind going on right now',
  },

  rail: {
    aria: 'Upcoming launches and top traders',
    upcoming: 'Launching soon',
    radarClear: 'Radar is clear… post the next launch',
    topCabal: 'Cabal top',
    noCalls: 'No settled calls yet. Post one with its CA in the Feed.',
    pointsTitle: 'Cabal points',
    pointsBody: 'Post launches and theses → earn points → swap them for tokens when $CABAL launches.',
    firstLaunch: 'Post my first launch',
    legalNav: 'Legal links',
    terms: 'Terms',
    privacy: 'Privacy',
    credits: 'Credits',
    following: 'following',
    follow: 'Follow',
    callerLine: (pts: number, best: string) => `${pts} pts · best ${best}`,
    followers: (n: string) => `${n} followers`,
  },

  chat: {
    title: 'Cabal chat',
    placeholder: 'Say something to the Cabal…',
    empty: 'Be the first to write here',
    unavailable: 'Live chat is unavailable right now',
    replyingTo: 'Replying to',
    cancelReply: 'Cancel reply',
    like: 'Like',
    reply: 'Reply',
    replyTo: (name: string) => `Reply to ${name}`,
    send: 'Send message',
    roomHint: 'Chat room',
    unlike: 'Remove like',
    likeMessage: (name: string) => `Like ${name}'s message`,
  },

  appFooter: {
    tagline: 'the community that sees launches before anyone else',
    points: (thesis: number, launch: number) =>
      `Thesis +${thesis} · Launch +${launch} · Redeemable for $CABAL`,
  },

  notifications: {
    label: 'Notifications',
    withUnread: (n: number) => `Notifications (${n} unread)`,
    chatReplies: 'Chat · Replies to you',
    upcoming: 'Radar · Upcoming launches',
    nothingSoon: 'Nothing in the next 36h. Check the Radar.',
    private: 'Private',
    posted: 'posted',
  },
}
