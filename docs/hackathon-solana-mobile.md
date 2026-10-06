# Solana Mobile Hackathon (CLOCK IN) — entrega de Cabal

Cierre: **8 de octubre de 2026**. Portal: https://solanamobile.com/hackathon

## Qué piden y dónde está

| Requisito | Estado | Dónde |
|---|---|---|
| APK Android funcional | Hecho (2,8 MB, firmado con la clave de la dApp Store) | `android/cabal-seeker.apk` (no se versiona) |
| Mobile Wallet Adapter | Hecho | `src/lib/wallets.ts` → `startMobileWalletAdapter()` |
| Compatible con la Solana dApp Store | TWA firmada con clave propia de la dApp Store | `android/README.md` §5 |
| Repositorio de GitHub | El repo es **privado**: hacerlo público o dar acceso a los jueces | https://github.com/ericemprende/cabal |
| Vídeo demo | Pendiente (grabar) | guion abajo |
| Pitch deck | Ya existe | https://claude.ai/artifact/8V6LS7pYGaN2ZbT31JhY4N |

## Cómo funciona MWA en la app

La app Android es una TWA: Chrome a pantalla completa con `https://cabal.army/app`.
En Android, `@solana-mobile/wallet-standard-mobile` registra **Mobile Wallet
Adapter** como una wallet de Wallet Standard más. El selector de wallets la pone
la primera; al tocarla, Android abre la wallet del teléfono (Seed Vault en el
Seeker, Phantom, Solflare…) para autorizar, y la misma vía firma:

- comprar y vender tokens (`solana:signAndSendTransaction`),
- lanzar tokens en Pump/Bonk/Cabal Launch (`solana:signTransaction`),
- verificar la wallet del perfil (`solana:signMessage`).

En iOS y escritorio no cambia nada (extensiones y enlaces a Phantom/Solflare).

**Importante:** como la TWA carga la web en vivo, MWA solo aparece en el APK
cuando este código está desplegado en producción.

## Compilar de nuevo (Windows)

Herramientas en `~/.bubblewrap` (JDK 17 + Android SDK). La clave y su contraseña
están en `~/.cabal-keys/dappstore.txt`: **haz copia de seguridad**; sin ella no se
puede actualizar la app en la dApp Store. Huella SHA-256 de la clave:
`D4:84:3F:86:E7:EB:02:88:5A:38:63:87:AF:1E:E9:74:EF:F8:92:C2:B3:61:8F:92:DA:65:1D:46:7D:21:BA:9F`

1. `cd android && npx @bubblewrap/cli update --skipVersionUpgrade` (tras cambiar `twa-manifest.json`).
2. `bubblewrap build` no encuentra `gradlew.bat` en Windows. En su lugar, en PowerShell con
   `JAVA_HOME` y `ANDROID_HOME` apuntando a `~/.bubblewrap`: `.\gradlew.bat assembleRelease`.
3. `zipalign -p 4` y `apksigner sign --ks cabal-dappstore.keystore --ks-key-alias cabal-dapp`
   (build-tools 35) → `cabal-seeker.apk`.

Para que abra sin barra de URL, añadir esa huella a `ANDROID_SHA256_FINGERPRINTS` en Dokploy.

## Probarlo

1. Instalar el APK en un Android (o emulador) con una wallet compatible con MWA
   (Phantom o Solflare; en emulador, la *fakewallet* de Solana Mobile).
2. Abrir Cabal → comprar un token → "Mobile Wallet Adapter" → autorizar.

## Guion del vídeo (2–3 min)

1. El problema: los memecoins se descubren tarde y entre ruido; el radar de Cabal
   los enseña *antes* de que salgan, con la comunidad votando (hype / popó).
2. Abrir el APK en el teléfono, recorrer Radar → ficha de un launch → recordatorio.
3. Conectar con Mobile Wallet Adapter y comprar desde el móvil.
4. Crear un token desde el móvil (pestaña Crear token).
5. Gamificación: insignias, puntos, ranking de callers, insignia de donador.
6. Cierre: qué viene (dApp Store, integración SKR).

## Integración SKR (premio extra de 10.000 $)

Familia de insignias **Seeker** en , según el SKR que la cuenta
tiene en sus wallets de Solana **verificadas** (firmadas), leído on-chain del mint
oficial :

| Rango | Nombre | SKR |
|---|---|---|
| Bronce | Seeker | 1 |
| Acero | Seeker veterano | 1.000 |
| Oro | Guardián Seeker | 10.000 |
| Obsidiana | Leyenda Seeker | 100.000 |

 suma el saldo con  y lo cachea 10 min.
Sale en el perfil, en la alerta de insignia desbloqueada (con botón para presumirla
en X) y en Próximos objetivos para quien aún no tiene SKR.
