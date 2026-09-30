# Cabal para Android (Google Play + Solana dApp Store)

App TWA (Trusted Web Activity): Chrome abre `https://cabal.army/app` a pantalla
completa, con icono, splash y notificaciones propias. Todo lo que se despliega en
la web aparece en la app al momento, sin publicar actualizaciones.

- Paquete: `army.cabal.app`
- Dominio: `cabal.army`, y además `beta.cabal.army` como origen de confianza
  (mientras dure la redirección a beta, la app sigue a pantalla completa).
- La misma base sirve para las dos tiendas, pero **cada una se firma con su
  propia clave** (la dApp Store lo exige: no acepta la clave de Google Play).

## 0. Requisitos (una vez)

```bash
npm i -g @bubblewrap/cli
bubblewrap doctor      # la primera vez descarga JDK 17 y el Android SDK
```

## 1. Claves de firma

```bash
cd android
# Google Play (clave de SUBIDA; Play re-firma con la suya)
keytool -genkeypair -v -keystore cabal-upload.keystore -alias cabal -keyalg RSA -keysize 2048 -validity 10000
# Solana dApp Store (clave propia y distinta)
keytool -genkeypair -v -keystore cabal-dappstore.keystore -alias cabal-dapp -keyalg RSA -keysize 2048 -validity 10000
```

Guarda los `.keystore` y sus contraseñas fuera del repositorio y con copia de
seguridad. Sin la de la dApp Store no se puede volver a actualizar allí.

Huellas SHA-256 de cada una:

```bash
keytool -list -v -keystore cabal-upload.keystore -alias cabal | grep SHA256
keytool -list -v -keystore cabal-dappstore.keystore -alias cabal-dapp | grep SHA256
```

## 2. Verificación del dominio (Digital Asset Links)

En Dokploy, añade en la app web:

```
ANDROID_PACKAGE=army.cabal.app
ANDROID_SHA256_FINGERPRINTS=<huella clave subida>,<huella App signing de Play>,<huella dApp Store>
```

La huella de "App signing" sale en Play Console → Configuración → Integridad de la
app, después de subir la primera versión. Comprueba:
`https://cabal.army/.well-known/assetlinks.json` y el mismo en `beta.cabal.army`.
Sin esto la app funciona, pero con la barra de la URL arriba.

## 3. Compilar

```bash
cd android
bubblewrap update      # genera/actualiza el proyecto a partir de twa-manifest.json
bubblewrap build       # firma con cabal-upload.keystore -> app-release-bundle.aab y app-release-signed.apk
```

Para cada versión nueva sube `appVersionCode` (+1) y `appVersionName` en
`twa-manifest.json`.

## 4. Google Play

1. Cuenta de desarrollador **como organización** (25 $; necesita D-U-N-S). Las
   personales nuevas exigen 14 días de prueba cerrada con 12 testers.
2. Sube `app-release-bundle.aab` a Prueba interna → Producción.
3. Declaraciones: app de finanzas/cripto, política de privacidad
   (`https://cabal.army/privacidad`), seguridad de datos, clasificación de contenido.
4. Copia la huella de App signing al env del paso 2.

## 5. Solana dApp Store

1. Re-firma el APK con la clave de la dApp Store:
   ```bash
   ~/.bubblewrap/android_sdk/build-tools/*/apksigner sign \
     --ks cabal-dappstore.keystore --ks-key-alias cabal-dapp \
     --out cabal-dappstore.apk app-release-unsigned-aligned.apk
   ```
2. Publica con el portal de publicadores de la dApp Store (publisher portal) o su
   CLI (`@solana-mobile/dapp-store-cli`): NFT de publicador, NFT de app y release.
   Hace falta una wallet de Solana con un poco de SOL para esas transacciones.
3. En la dApp Store no hay comisión obligatoria ni pago in-app forzado:
   Premium, munición y donaciones pueden quedarse tal cual.

## Qué queda para la Fase 2 (Capacitor, iOS)

La App Store no acepta TWA. iOS irá con Capacitor y necesita: login de X/Google
en el navegador del sistema, wallets por deep link (Phantom/Solflare), push nativo,
borrado de cuenta dentro de la app y ocultar en iOS los pagos de Premium,
munición y donaciones (o pasarlos a In-App Purchase).
