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

- Login y vinculación con X, Google y Discord: se abren en el navegador del
  sistema (Google bloquea OAuth en WebViews) y vuelven a la app por
  `army.cabal.app://auth` con un token de un solo uso (`src/lib/app-handoff.ts`,
  `src/lib/native-bridge.ts`). **Paso obligatorio en Xcode:** registrar el
  esquema en `ios/App/App/Info.plist`:

  ```xml
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key><string>army.cabal.app</string>
      <key>CFBundleURLSchemes</key><array><string>army.cabal.app</string></array>
    </dict>
  </array>
  ```

## Pendiente antes de enviar a revisión

1. **Wallets.** En el móvil no hay extensiones: conectar Phantom/Solflare por
   deep link (protocolo de deeplinks de Phantom). Mientras tanto, el botón de
   compra debería abrir el token en Phantom en vez de firmar dentro de la app
   (además, Apple 3.1.5 pide licencia para intercambiar cripto dentro de la app).
2. **Push nativo.** Registrar el token APNs (plugin PushNotifications) en una
   ruta nueva y enviarlo junto a las web-push actuales (clave `.p8` de APNs).
3. **Funciones nativas visibles** para no caer en la 4.2 (web envuelta): push,
   hoja de compartir nativa y háptica en hype/likes.
4. **Ficha de la tienda:** capturas, política de privacidad
   (`https://cabal.army/privacidad`), etiquetas de privacidad, cuenta de prueba
   para el revisor y nota explicando que no hay intercambio de cripto en la app.
