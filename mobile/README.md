# Cabal para iOS (App Store) — Capacitor

La App Store no acepta TWA, así que iOS va con Capacitor: una app nativa que
carga `https://cabal.army/app` en un WKWebView y añade lo nativo (splash, barra
de estado, push, compartir). Android (Google Play y Solana dApp Store) va aparte
como TWA, en `../android`.

- Bundle ID: `army.cabal.app`
- User-Agent: añade `CabalApp-iOS`. La web lo detecta (`src/lib/native-app.ts`)
  y en iOS oculta Premium, munición y donaciones; el servidor además las rechaza.

## Requisitos

- **Un Mac con Xcode 16+** (no se puede compilar iOS en Windows). Alternativas
  sin Mac propio: Codemagic, o GitHub Actions con runner `macos-latest`.
- Cuenta de Apple Developer **como organización** (99 $/año, D-U-N-S). Para una
  app con cripto Apple lo exige.

## Crear y abrir el proyecto (en el Mac)

```bash
cd mobile
npm install
npm run ios:add      # genera ios/ (Xcode, Swift Package Manager)
npm run ios:sync
npm run ios:open     # abre Xcode
```

En Xcode: Signing & Capabilities → tu equipo, y añade **Push Notifications** y
**Associated Domains** (`applinks:cabal.army`). Iconos: arrastra
`public/icons/icon-512.png` (1024×1024 recomendado) a `AppIcon`.

## Ya hecho en la web

- Borrar la cuenta desde el perfil → Avanzado (App Store 5.1.1(v)).
- En la app de iOS: sin compra de Premium ni de munición ni donaciones
  (3.1.1 y 3.2.2). Lo ya comprado sigue funcionando.
- Página sin conexión (`www/offline.html`).

## Pendiente antes de enviar a revisión

1. **Login con Google dentro de la app.** Google bloquea OAuth en WebViews
   (`disallowed_useragent`). Hay que abrirlo con `@capacitor/browser`
   (SFSafariViewController) y devolver la sesión a la app con un token de un
   solo uso por deep link (`army.cabal.app://auth?t=…` → `/api/auth/app-handoff`).
   El login con usuario/contraseña ya funciona tal cual.
2. **Wallets.** En el móvil no hay extensiones: conectar Phantom/Solflare por
   deep link (protocolo de deeplinks de Phantom). Mientras tanto, el botón de
   compra debería abrir el token en Phantom en vez de firmar dentro de la app
   (además, Apple 3.1.5 pide licencia para intercambiar cripto dentro de la app).
3. **Push nativo.** Registrar el token APNs (plugin PushNotifications) en una
   ruta nueva y enviarlo junto a las web-push actuales (clave `.p8` de APNs).
4. **Funciones nativas visibles** para no caer en la 4.2 (web envuelta): push,
   hoja de compartir nativa y háptica en hype/likes.
5. **Ficha de la tienda:** capturas, política de privacidad
   (`https://cabal.army/privacidad`), etiquetas de privacidad, cuenta de prueba
   para el revisor y nota explicando que no hay intercambio de cripto en la app.
