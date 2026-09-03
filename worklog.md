# Worklog — Proyecto Cabal

---
Task ID: 4-5
Agent: main (Z.ai Code)
Task: Frontend completo de Cabal (tema neón verde, tabs, modales, dashboard admin)

Work Log:
- globals.css: tema dark con verde neón (#00ff88), utilidades .text-glow, .neon-shadow, .live-dot, ticker marquee, scrollbars custom
- layout.tsx: fuentes Space Grotesk (display) + Geist, metadata Cabal, Providers (TanStack Query), Toaster sonner
- public/logo.svg: figura encapuchada neón con ojos brillantes (icono de cabal)
- Componentes en src/components/cabal/: shared.tsx (logo, avatares emoji, badges red, countdown en vivo, safety checks), header.tsx (búsqueda "/" con dialog, notificaciones de próximos launches, menú usuario), mobile-nav.tsx (bottom nav + FAB publicar), ticker.tsx (cinta de precios), post-card.tsx, radar-tab.tsx (hero destacado + filtros red/orden + grid de launch cards con countdown), launch-detail.tsx (modal con tesis/comentarios), post-launch-dialog.tsx (formulario completo con emoji picker y redes), tokens-tab.tsx (tabla estilo fomo), token-detail.tsx (modal con gráfico recharts, stats, historial del dev con track record), feed-tab.tsx (composer con selector de tipo), leaderboard-tab.tsx (callers/puntos/devs/clanes), profile-dialog.tsx (Mi Cabal con balance de puntos, historial, editar perfil, wallet), admin-dialog.tsx (3 vistas: puntos por usuario con +/-, reglas editables, stats con gráfico de distribución), sidebars.tsx (actividad en vivo + próximos + top callers)
- Fixes de lint: setState en effects eliminados (patrón onOpenChange/draft), componente Item estático extraído, refs en render corregidos
- Fix de runtime: exportar jsonFetch en api-client (admin-dialog lo usa), import faltante computeLaunchStatus en launches/[id]
- Todas las APIs verificadas con curl: 200 en me/launches/tokens/token detail/feed/leaderboard/points; admin guard 403/404 correcto

Stage Summary:
- Frontend 100% integrado con backend, sin errores de lint
- Pendiente: verificación visual end-to-end con Agent Browser (desktop + móvil)


---
Task ID: 11
Agent: main (Z.ai Code)
Task: Verificación end-to-end con Agent Browser + fixes

Work Log:
- Fix: import faltante useTokens en header.tsx (crasheaba la app)
- Fix: spread {...t} con key en mobile-nav.tsx (error React)
- Fix: import faltante useUI en launch-detail.tsx
- Fix: DialogTitle en skeletons de loading (accesibilidad Radix)
- Mejora visual: launch cards con $TICKER prominente + nombre truncado
- Mejora: métrica del dev cambiada a "Ret. ATH %" (retención vs ATH) en vez de múltiplo sintético
- Pruebas E2E superadas: comentario/tesis en launch (+25 ⚡ con toast, balance 132→157→197), publicar launch NAPE (+40 ⚡, aparece en radar/notificaciones/right rail), token detail con gráfico y track record del dev, like en feed, hype toggle (342→341, toggle correcto), follow en top callers, leaderboard de puntos (#11 Tú con 197), perfil con balance/historial/stats, admin: ajuste +100 a Kael con motivo (190→290), reglas editables, estadísticas con gráfico de distribución (14.707 ⚡ en circulación), búsqueda "/" funcionando, notificaciones con próximos launches, vista móvil iPhone 14 con bottom nav + FAB
- Lint final: 0 errores. Consola del navegador: 0 errores

Stage Summary:
- Cabal 100% funcional y verificado en desktop (1440px) y móvil (iPhone 14)
- Golden path completo operativo: radar → detalle → tesis con puntos → publicar launch → admin gestiona puntos
- App lista para preview

---
Task ID: 1-3b
Agent: main (Z.ai Code)
Task: Base de datos, seed, motor de puntos y APIs completas de Cabal

Work Log:
- Schema Prisma diseñado: User (con points, lifetimePoints, isAdmin), Launch, Token, Post, Vote, Follow, PointEvent, Setting
- Push a SQLite ejecutado sin errores
- Seed completo: 13 usuarios (devs verificados, callers, rugger), 8 launches pre-lanzamiento, 14 tokens con devs, ~30 posts (tesis/comentarios/calls), reglas de puntos, historial de puntos del usuario actual
- Motor de puntos en src/lib/api-helpers.ts: awardPoints() lee reglas de Settings, crea PointEvent y actualiza balance atómicamente
- APIs creadas: /api/me (GET/PATCH), /api/launches (GET/POST +[id] +[id]/hype), /api/tokens (GET +[id] con chart determinista e historial del dev), /api/posts (POST con puntos por tesis/comentario), /api/posts/[id]/like (toggle + puntos al autor), /api/feed, /api/leaderboard (callers/devs/points/clans), /api/follow/[id], /api/points
- APIs Admin: /api/admin/overview, /api/admin/users, /api/admin/points (ajuste manual con nota), /api/admin/rules (GET/PUT reglas de puntos)

Stage Summary:
- Backend 100% operativo con sistema de puntos configurable desde admin
- Reglas por defecto: tesis=25, comentario=5, launch=40, like recibido=2, hype recibido=1, visita diaria=3
- Pendiente: frontend completo (tema neón verde, tabs Radar/Tokens/Feed/Líderes, modales, dashboard admin)

---
Task ID: 12
Agent: main (Z.ai Code)
Task: Rediseño visual Cabal — wordmark Neue Machina, paleta oliva, iconos monocromos, upload de imagen/banner

Work Log:
- Fuente: Neue Machina (Pangram Pangram) auto-alojada en public/fonts (Regular/Medium/Bold/Ultrabold woff), @font-face + utilidad .font-machina; wordmark "CABAL" en mayúscula bold SIN logo SVG (eliminado public/logo.svg, favicon tipográfico en src/app/icon.svg)
- Paleta oliva: --neon #8fa83f (antes #00ff88), fondos cálidos #0a0b08/#121410, BORDES NEUTROS blancos (border-white/8-12) en todo el shell, glows reducidos ~60%, scrollbars neutros, base/bnb badges monocromos con dot de color
- Iconos monocromos: UserAvatar (iniciales en Neue Machina, tonos neutros deterministas, badge verificado oliva) reemplaza todos los EmojiAvatar; TokenGlyph (imagen del token o inicial en tile monocromo) para launches/tokens; todos los emojis de UI reemplazados por Lucide (Zap puntos, Timer countdowns, CheckCircle2/XCircle safety, Globe filtros, Flame/Sparkles/Trending sorts, Target/Wrench/Shield/ShieldChart leaderboards, GraduationCap/Megaphone/MessageSquare kinds, Heart likes, medallas→rank 01/02/03 tipográfico)
- Upload de imágenes: schema Launch.image/Launch.banner + Token.image, API /api/upload (multipart, valida mime y 2.5MB, guarda en public/uploads), POST /api/launches acepta image/banner (valida ruta), formulario "Publicar lanzamiento" con dropzones cuadrada (imagen del token) y 16:9 (banner opcional) con preview y remove; imágenes renderizadas en radar/hero/detalle (banner con fade)/feed/chips
- Seed regenerado: imágenes AI para SMOL y CABAL (+banner) en public/seed/, notas de puntos sin emojis, DB reseteada
- Admin: tabs con iconos, labels de reglas sin emojis, likes con Heart; Perfil: historial de puntos con iconos por tipo, balance con Zap en font-machina, picker de avatar eliminado
- Verificación E2E con Agent Browser (desktop 1440 + iPhone 14): radar con imágenes, tesis +25 (132→157), upload real de imagen → preview → launch TVST publicado +40 (157→197) y visible en radar con su imagen, tokens/líderes/clanes/perfil/admin/búsqueda/footer/móvil sin emojis ni errores de consola; lint 0 errores

Stage Summary:
- Cabal rediseñado: identidad tipográfica Neue Machina, paleta oliva sobria con bordes neutros, iconografía monocroma homogénea, y lanzamientos con imagen + banner subibles por el usuario
- Golden path completo verificado en navegador; app lista para preview

---
Task ID: 13
Agent: main (Z.ai Code)
Task: Verificación X/Google en perfil, URL de admin, logo Cabal Coin, punto morado Solana, ticker opcional + launches privados, badge EN VIVO rojo

Work Log:
- Schema: User.xHandle/xVerified/googleEmail/googleVerified/tgHandle + Launch.ticker ahora opcional (String?) + Launch.isPrivate → db push OK
- Logo Cabal Coin: regenerado con AI (monograma "C" verde oliva sobre carbón) en public/seed/cabal.png; editable desde Admin → Proyectos/Tokens (subida de logo)
- Solana: punto morado #9945FF (antes verde) en NETWORKS
- Badge de estado: EN VIVO en ROJO con punto pulsante (live o <45min "inminente"), ÁMBAR (<6h), OLIVA (con tiempo), gris finalizado; cards live con borde rojo; hero con countdown dinámico; .live-dot-red en globals.css
- Seed: Fomo Dog (launch hace 18min → EN VIVO), Proyecto Centinela (privado, sin ticker), X/Google/TG verificados en based_dev/cryptonita/elprofe/swizzle; DB reseteada
- APIs: POST /api/me/verify (X/Google simulando OAuth, bonus +5 una vez por proveedor, disconnect soportado); launches GET/POST con ticker opcional + isPrivate + máscara de ticker en respuestas públicas (dueño/admin lo ven); PATCH /api/admin/users (perfiles X/TG/Google, badges, roles, protección auto-remoción admin), GET+PATCH /api/admin/launches, GET+PATCH /api/admin/tokens
- Frontend: perfil con sección "Conexiones y verificación" (X y Google con flujo inline + desconectar); formulario publicar con ticker opcional y toggle "Lanzamiento privado"; TickerLabel (chip PRIVADO ámbar con candado) en radar/hero/detalle/feed/notificaciones/búsqueda/sidebars; admin reescrito con 5 tabs: Usuarios y perfiles (editar nombre/handle/X/TG/Google/badges/roles + ajuste de puntos), Proyectos (editar launch completo con upload de logo/banner), Tokens (logo + métricas), Reglas, Estadísticas
- Deep link admin: /?admin=1 abre el panel automáticamente (useState lazy + guard typeof window para SSR); botón en menú de usuario también
- Fix SSR: window not defined en page.tsx (useState initializer) — 500 → 200
- E2E Agent Browser: verificación X (@cabal_wolf) y Google (lobo@cabal.xyz) con +5 pts y toasts; publicación de launch privado "Proyecto Sombra" (+40, chip PRIVADO, ticker enmascarado en API); admin editó Google de Based Dev vía panel; badge EN VIVO rojo en FOMO/WIF2/SMOL; punto morado SOL; móvil iPhone 14 OK; lint 0, tsc 0 (app), consola 0 errores

Stage Summary:
- Todas las solicitudes del usuario implementadas y verificadas en navegador
- URL del administrador: preview + /?admin=1 (usuario "tu" es admin)
- Logo de Cabal Coin listo como placeholder de marca; reemplazable por el logo real del usuario desde Admin → Proyectos → Cabal Coin → Logo (o enviarlo por chat)
- OAuth X/Google simulado, preparado para intercambiar por X API v2 / Google Identity Services con credenciales reales
