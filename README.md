# CABAL — Radar social de launches de memecoins

> **Documento vivo** · Este README describe el estado actual del proyecto y **debe actualizarse cada vez que el proyecto cambie o evolucione** (nuevas features, cambios de arquitectura, correcciones relevantes). Al final incluye un registro de cambios por fecha.

---

## 1. ¿Qué es Cabal?

Cabal es una plataforma social de trading de memecoins (estilo fomo.family) enfocada en **pre-lanzamientos**: la comunidad descubre, comparte y discute launches antes de que salgan, gana puntos por sus aportaciones y sube en el leaderboard. Los puntos se podrán canjear por el token `$CABAL` cuando lance.

- **Concepto clave**: un *Launch* es un aviso de un memecoin que va a lanzarse (con fecha/hora, red, tesis y checks de seguridad). Un *Token* es un memecoin ya en vivo.
- **Roles**: `DEV` (sube su propio proyecto) y `SCOUT` (miembro de la comunidad que comparte el hallazgo).
- **Ticker privado**: un launch puede ocultar su ticker hasta el momento del lanzamiento (se muestra la etiqueta "Privado").

## 2. Estado actual (septiembre 2026)

- App funcionando en **Next.js 16 + bun**, puerto 3000.
- Autenticación por credenciales (registro/login/logout) + verificación OAuth con X y Google.
- Panel de administración completo (`/admin` o `/?admin=1`).
- Base de datos limpia: solo contenido real subido por el usuario (sin datos de ejemplo).
- Sistema de puntos configurable desde el panel admin.

## 3. Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, `src/`) + TypeScript 5 |
| Runtime / gestor de paquetes | bun (dev en puerto 3000, log en `dev.log`) |
| Estilos | Tailwind CSS 4 + shadcn/ui (New York) + lucide-react (iconos monocromos, sin emojis en UI) |
| Estado | Zustand (UI) + TanStack Query (servidor) |
| Base de datos | SQLite (`db/custom.db`) vía Prisma ORM |
| Sesiones | Cookie httpOnly firmada (HMAC-SHA256, 30 días) — `src/lib/auth.ts` |
| Passwords | scrypt con salt aleatorio (`salt:hash`) |
| Uploads | `POST /api/upload` → `public/uploads/` (MIME whitelist, máx 2.5 MB) |
| Gráficos | recharts (live-chart estilo GMGN/Axiom) |

## 4. Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx              # Home: Radar / Tokens / Feed / Líderes (tabs)
│   ├── publicar/page.tsx     # Página de publicación de launch (no es popup)
│   ├── admin/page.tsx        # Redirige al panel admin (/?admin=1)
│   └── api/                  # API REST (ver §7)
├── components/cabal/         # Toda la UI de Cabal
│   ├── shared.tsx            # Wordmark, avatares, TickerLabel, CountdownPill,
│   │                         # NetworkBadge/Icon, SafetyChecks, CopyCA, PointsPill
│   ├── header.tsx            # Header: búsqueda "/", notificaciones, auth (login/registro/logout)
│   ├── radar-tab.tsx         # Hero destacado + filtros por red + grid de LaunchCards
│   ├── tokens-tab.tsx        # Tabla de tokens en vivo
│   ├── feed-tab.tsx          # Composer + feed de posts (tesis/call/trade/comentario)
│   ├── leaderboard-tab.tsx   # Callers, devs y puntos
│   ├── launch-detail.tsx     # Modal de launch: tesis, comentarios, hype, gráfico si hay CA
│   ├── token-detail.tsx      # Modal de token: gráfico, stats, track record del dev
│   ├── profile-dialog.tsx    # "Mi Cabal": puntos, historial, editar perfil (foto, bio…)
│   ├── auth-dialog.tsx       # Login / registro por credenciales
│   ├── oauth-consent-dialog.tsx  # Consentimiento para verificar X / Google
│   ├── admin-panel.tsx       # Panel admin: launches, usuarios, reglas de puntos, afiliados
│   ├── sidebars.tsx          # Actividad en vivo (izq) + Próximos/Top (der)
│   ├── mobile-nav.tsx        # Bottom nav móvil + FAB publicar
│   ├── post-card.tsx · ticker.tsx · image-drop.tsx · live-chart.tsx
├── lib/
│   ├── db.ts                 # Cliente Prisma (singleton)
│   ├── cabal.ts              # Redes (NETWORKS), helpers de formato/countdown
│   ├── api-client.ts         # Hooks TanStack Query + jsonFetch + uploadImage
│   ├── store.ts              # Zustand (tab activa, modales, búsqueda)
│   ├── auth.ts               # Sesión usuario (scrypt + cookie firmada)
│   ├── admin-auth.ts         # Sesión admin (cookie aparte)
│   ├── oauth.ts · social.ts  # Verificación X / Google
│   ├── affiliate.ts          # Enlaces de referido por red ({ca}, {red})
│   ├── seed.ts               # Seed mínimo (reglas de puntos + usuarios base) — sin contenido demo
│   ├── serializers.ts · types.ts · utils.ts
├── components/ui/            # Componentes shadcn/ui
db/custom.db                  # Base de datos SQLite
prisma/schema.prisma          # Modelos
public/uploads/               # Imágenes subidas (logos/banners)
```

## 5. Funcionalidades

### Radar (home)
- **Hero destacado** con el próximo launch más hypeado y cuenta atrás en vivo **con minutos y segundos** (tiqueta cada segundo).
- **Grid de launches** con: glyph/logo, ticker (o etiqueta "Privado"), nombre, red, rol (DEV/SCOUT), cuenta atrás compacta (incluye min+seg cuando queda <24h), checks de seguridad (LP, mint, Top10) con nivel de riesgo, hype (fuegos) y contador de comentarios.
- **Filtros por red**: todas, Solana, Base, Ethereum, BSC, Tron, Robinhood + orden (próximos / más hype). Los chips hacen **wrap** (sin scroll horizontal oculto) para que todas las redes queden visibles en móvil.
- Launches **privados**: ocultos del listado público según su flag; visibles para su autor/admin.

### Publicar launch (`/publicar`)
- Página completa (no popup): nombre, ticker opcional, privado, red, fecha/hora, descripción, imagen (logo) y banner, redes sociales, CA opcional, checks de seguridad, rol (dev/scout).
- Subida de imágenes con preview (dropzone + por URL).

### Detalle de launch
- Tesis y comentarios de la comunidad (+puntos), hype, seguir al autor, socials, checks de seguridad y **gráfico en vivo** (si el launch tiene CA del token) con enlaces externos GMGN/Axiom.
- CA con botón de copiar.

### Tokens
- Tabla estilo fomo con precio, MC, cambio 24h, volumen, holders; detalle con gráfico y track record del dev.

### Feed
- Posts de tipos tesis/call/trade/comentario, likes, seguir, linked targets (launch/token).

### Líderes
- Ranking de callers por puntos, devs y clanes.

### Puntos Cabal
- Reglas editables desde el panel admin (guardadas en `Setting`): tesis +25, comentario +5, launch +40, like recibido +2, hype recibido +1, visita diaria +3.
- Historial en `PointEvent`; balance visible en header y perfil. Canje futuro por `$CABAL`.

### Autenticación
- **Registro/login por credenciales** (handle + password, scrypt). Sesión en cookie httpOnly firmada (`cabal_session`, 30 días).
- **Login social directo con X / Google** (sept 2026): botones "X" y "Google" en el diálogo de entrar/crear cuenta.
  - Con API keys (`X_CLIENT_ID`/`X_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) → OAuth 2.0 real vía `/api/auth/{provider}/start?mode=login`; el callback inicia sesión o crea la cuenta automáticamente con la identidad verificada.
  - Sin API keys → pantalla de consentimiento simulada que hace lo mismo vía `POST /api/auth/social` (modo demo).
  - Si la identidad social ya tiene cuenta → entra en ella; si no → la crea (handle único derivado del @usuario/email, +5 pts por verificación).
- **Logout** desde el menú del avatar.
- **Verificación de identidad** OAuth con X y Google (+5 puntos) con diálogo de consentimiento (modo link desde el perfil).
- Sin sesión → modo invitado (usuario demo "Tú").

### Perfil ("Mi Cabal")
- Editar **foto de perfil** (upload), nombre, bio; ver balance, historial de puntos y follows.

### Panel admin (`/?admin=1`, creds `admin` / `admin123@`)
- Editar/crear/ocultar launches (todas las redes, fechas, privado, CA…).
- Gestionar usuarios (puntos +/-, isDev, verificado).
- Reglas de puntos editables.
- **Plataformas afiliadas** (GMGN, Axiom…): enlace madre de referido por red con placeholders `{ca}` y `{red}`; etiqueta "DE LA RED {red}".
- Estadísticas con distribución de puntos.

## 6. Diseño (design system)

- **Paleta**: fondo casi negro `#0a0b08` / `#121410`; **oliva `#8FA83F`** como color primario (badges, botones, glows). Rojo `#ff4d5e` para "en vivo"/urgente, ámbar para privado/avisos.
- **Tipografías**: wordmark "CABAL" en **Neue Machina** (`.font-machina`); display Space Grotesk (`.font-display`); monospace para countdowns.
- **Iconos**: monocromáticos lucide-react; **sin emojis en la UI** (los emojis solo existen como avatar por defecto del seed).
- Componentes compartidos clave en `shared.tsx`:
  - `TickerLabel`: `$TICKER` o píldora compacta "🔒 Privado" (tamaño fijo interno, no hereda el font-size del contenedor).
  - `CountdownPill`: cuenta atrás con tamaños `xs | sm | md | lg` y estados (en vivo rojo pulsante, urgente <45min, pronto <6h, oliva normal).
  - `NetworkBadge` / `NetworkIcon`: logos SVG vectoriales por red.
- **Reglas de layout**: footer siempre al fondo (`min-h-screen flex flex-col` + `mt-auto`); tarjetas con `min-w-0` para evitar desbordes del grid en móvil; listas largas con `max-h` + scroll.

## 7. API (resumen)

Métodos principales (JSON; auth por cookie de sesión; admin por cookie propia):

| Endpoint | Descripción |
|---|---|
| `GET/POST /api/launches` | Listado público (oculta privados/ocultos) / crear launch |
| `GET /api/launches/[id]` · `POST /api/launches/[id]/hype` | Detalle · toggle hype |
| `GET /api/tokens` · `GET /api/tokens/[id]` | Listado (sort/network) · detalle |
| `GET/POST /api/posts` · `POST /api/posts/[id]/like` | Feed · crear post · like |
| `GET /api/leaderboard` · `GET /api/feed` | Rankings · actividad |
| `GET /api/me` · `POST /api/me/verify` | Perfil actual · iniciar verificación OAuth |
| `POST /api/auth/register|login|logout` · `GET /api/auth/session|status` | Credenciales y sesión |
| `POST /api/auth/social` | Login/registro social demo (sin API keys) |
| `GET /api/auth/x/start|callback` · `GET /api/auth/google/start|callback` | OAuth X / Google (verificación y `?mode=login` para login social) |
| `POST /api/follow/[id]` | Toggle seguir usuario |
| `GET /api/points` | Historial de puntos |
| `GET /api/affiliate` | Plataformas afiliadas activas |
| `POST /api/upload` | Subida de imágenes (2.5 MB máx) |
| `POST /api/admin/login|logout` · `GET /api/admin/session` | Sesión admin |
| `GET/POST /api/admin/launches|users|rules|points|affiliate|overview|tokens` | Gestión admin |

## 8. Modelo de datos (Prisma/SQLite)

- **User**: handle, nombre, avatar (URL de foto o emoji), bio, wallet, `passwordHash`, verificaciones (wallet/X/Google), `isDev`, `isAdmin`, `isCurrentUser`, puntos (`points`, `lifetimePoints`), followers, stats de calls.
- **Launch**: nombre, ticker opcional, `isPrivate`, `hidden`, `submitterRole` (dev/community), imagen/banner, `network`, `launchAt`, descripción, socials, `contract` (CA), checks (`lpLocked`, `mintRevoked`, `top10Pct`), `hype`, estado.
- **Token**: datos de mercado (price, mc, change24h, volume24h, holders, top10Pct), `contract`, dev, `isRug`, ATH.
- **Post**: kind (thesis/comment/call/trade), contenido, likes, link opcional a launch/token, PnL.
- **Vote** (hype/likes únicos por usuario), **Follow**, **PointEvent** (historial), **Setting** (reglas de puntos), **AffiliatePlatform** (enlaces de referido por red, JSON `red→url` con `{ca}`/`{red}`).

## 9. Comandos de desarrollo

```bash
bun run dev         # Dev server en puerto 3000 (log: dev.log) — SIEMPRE en background
bun run lint        # ESLint
bun run db:push     # Aplicar cambios de schema.prisma a SQLite
bun run db:generate # Regenerar cliente Prisma
```

- Preview: usar el **Panel de vista previa** del entorno (no localhost).
- Admin: `/?admin=1` → usuario `admin` · password `admin123@`.

## 10. Patrones y decisiones importantes

- **Booleans desde FormData**: parsear con `x === true || x === 'true'` (nunca `Boolean(str)`).
- **`cn()` usa tailwind-merge**: el último `text-[Npx]` gana; por eso los componentes de píldoras fijan su tamaño en un span interno para no heredar tamaños del padre.
- **Tarjetas del grid**: llevar `min-w-0` en el elemento raíz para evitar el "grid blowout" (que la tarjeta crezca más allá del viewport en móvil).
- **Redes soportadas**: `solana`, `base`, `ethereum`, `bsc`, `tron`, `robinhood` (`NETWORKS` en `src/lib/cabal.ts`; logos en `NetworkIcon`).
- **z-ai-web-dev-sdk**: solo en backend (skills de IA: imagen, búsqueda, etc.).
- **Sin contenido de ejemplo**: el seed solo crea reglas de puntos, usuarios base y follows; los launches/tokens visibles son los que suba el usuario.

## 11. Registro de cambios (changelog)

> Añadir una entrada por cada cambio relevante, con fecha (zona horaria America/Bogota).

### 2026-09-04 (tarde)
- **Login social con X / Google**: botones "X" y "Google" en el diálogo de iniciar sesión/crear cuenta. Con API keys corre OAuth 2.0 real (`/api/auth/{provider}/start?mode=login` + callbacks que crean sesión); sin keys usa el consentimiento simulado y `POST /api/auth/social`. La cuenta se crea automáticamente si la identidad no existe (handle único derivado, +5 pts de verificación). `OAuthConsentDialog` soporta `mode: link | login`.
- **Filtros de red siempre visibles**: la fila de chips del Radar pasó de scroll horizontal oculto a `flex-wrap` — Robinhood (RH) y todas las redes se ven completas en móvil y desktop.
- **Cuenta atrás con minutos y segundos**: `countdownParts` incluye siempre segundos (`1d 0h 45m 01s`); las píldoras compactas de las tarjetas muestran min+seg cuando falta <24h. El hero y las barras laterales tictan cada segundo.
- **Mobile-first**: verificado a 320/390px (auth, filtros, tarjetas, modales) pensando en la futura app nativa.

### 2026-09-04
- **UI — etiquetas compactas**: la píldora "Privado" (`TickerLabel`) ahora tiene tamaño fijo interno (9px) y nunca hereda el tamaño del texto del contenedor (antes el `text-[15px]` de la tarjeta la agrandaba a ~91px). `CountdownPill` estrena tamaño `xs` (10px) y se usa en las tarjetas del Radar.
- **Fix móvil**: las tarjetas del Radar causaban desborde horizontal (la píldora "EN VIVO" se montaba sobre la etiqueta "Privado" / salía de la tarjeta). Causa: *grid blowout* — la tarjeta crecía por el ancho intrínseco de su contenido. Solución: `min-w-0` + `overflow-hidden` en la tarjeta y `min-w-0` en las filas internas; el nombre ahora trunca correctamente.
- **Docs**: se crea este `README.md` como documento vivo del proyecto. (El único README previo, `download/README.md`, era un placeholder del sistema de descargas, no documentación real.)

### 2026-09-03 y anteriores
- Limpieza total del contenido de ejemplo (posts, tokens y launches demo eliminados; seed reescrito sin datos demo).
- Página dedicada `/publicar` para crear launches (con dropzone de logo/banner y preview por URL).
- Autenticación: registro/login por credenciales, logout, verificación OAuth X/Google (+5 pts), edición de perfil con foto (upload a `public/uploads`).
- Panel admin con login propio (`admin` / `admin123@`), edición de launches, usuarios, reglas de puntos y plataformas afiliadas (GMGN/Axiom con enlaces por red).
- Rediseño visual oliva `#8FA83F` + wordmark Neue Machina; favicon; gráficos estilo GMGN/Axiom; CA con botón copiar; puntos canjeables por `$CABAL`.
