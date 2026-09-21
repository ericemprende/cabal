# App móvil de Cabal

Plan en dos tiempos: **hoy** una PWA instalable desde el navegador, **mañana**
la misma base publicada en Google Play y App Store. Este documento es el mapa
de lo que ya está hecho y lo que falta para llegar a las tiendas.

## 1. Lo que ya funciona (PWA)

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Manifiesto | `src/app/manifest.ts` | Nombre, iconos, color, `start_url` en `/app`, accesos directos |
| Iconos | `public/icons/` (los genera `bun run icons:pwa`) | 192, 512 y el *maskable* que recorta Android |
| Service worker | `public/sw.js` | Páginas siempre desde la red, `/offline` si no hay señal, estáticos cacheados, API nunca |
| Página sin conexión | `src/app/offline/page.tsx` | Lo que se ve sin internet |
| Instalación | `src/components/cabal/install-app.tsx` | Registra el service worker y ofrece instalar (en iPhone explica el camino) |
| Sección por URL | `/app?tab=chat` | Deep links: accesos directos del icono y enlaces de los bots |

Reglas que conviene no romper:

- **`/api` nunca se cachea.** Precios, chat y sesión son datos en vivo.
- **Las páginas van a la red primero.** Así un despliegue nuevo se ve al momento
  y nadie se queda con una versión vieja pegada.
- Si cambian los iconos o el nombre, subir `VERSION` en `public/sw.js` para que
  la caché vieja se borre.

## 2. Avisos push en el móvil

Ya funcionan de punta a punta. Piezas:

| Pieza | Dónde vive |
|---|---|
| Envío | `src/lib/push.ts` (librería `web-push`) |
| Alta, baja y preferencias | `src/app/api/me/push/route.ts` |
| Lado del navegador | `src/lib/push-client.ts` |
| Ajustes del usuario | `src/components/cabal/push-settings.tsx`, dentro de "Mi Cabal" |
| Recepción | `public/sw.js` (eventos `push` y `notificationclick`) |
| Disparo | `src/lib/notifications.ts`, en la misma pasada que Telegram y Discord |

**Puesta en marcha (una sola vez):**

1. `bun run push:keys` genera el par de claves.
2. Pegar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` en las
   variables de entorno de Dokploy y redesplegar.
3. Sin esas claves no pasa nada malo: la sección de avisos ni siquiera aparece.

Si algún día se cambian las claves, **todas las suscripciones guardadas dejan de
valer** y cada persona tiene que volver a aceptar los avisos.

**Qué se puede encender y apagar** (por dispositivo, no por cuenta: lo normal es
quererlos en el teléfono y no en el ordenador del trabajo):

- Lanzamientos a punto de salir (los de la campanita)
- Launches nuevos
- Calls nuevas
- Tesis nuevas
- Respuestas en el chat en vivo

Cada dispositivo es una fila de `PushSubscription`, identificada por el
`endpoint` que da el navegador. Si el servicio de push responde 404 o 410, la
suscripción se borra sola: ya no existe.

Dos avisos importantes sobre iPhone:

- Solo llegan push si el usuario **instaló** la app en su pantalla de inicio
  (Safari no las da en una pestaña normal). Por eso existe el banner de
  instalación, y por eso los ajustes lo explican cuando detectan un iPhone.
- Requiere iOS 16.4 o superior.

## 3. Camino a Google Play

La vía barata es un **TWA** (la PWA empaquetada como app Android):

1. `npx @bubblewrap/cli init --manifest https://cabal.army/manifest.webmanifest`
2. Servir `/.well-known/assetlinks.json` con la huella del certificado de firma,
   para que la app abra sin barra de navegador.
3. Icono de Play: `public/icons/play-512.png` (ya generado).
4. Ficha de Play: política de privacidad (ya existe en `/privacidad`),
   clasificación de contenido y el formulario de seguridad de datos.

Google acepta TWAs sin problema siempre que la PWA cumpla los mínimos
(manifiesto, service worker, https).

## 4. Camino a App Store

Apple **rechaza** las apps que son solo un navegador con la web dentro. Hay dos
opciones reales:

- **Capacitor** envolviendo la web, pero aportando cosas nativas de verdad:
  notificaciones push nativas, biometría para entrar, compartir del sistema,
  widget de precios. Con eso suele pasar revisión.
- **Expo / React Native** con pantallas nativas que consumen la API de Cabal.
  Más trabajo, mejor resultado.

En ambos casos hay que pagar la cuenta de desarrollador de Apple (99 USD al año)
y cuidar una cosa: si la app permite **comprar** el plan Premium dentro, Apple
exige su sistema de pagos y su comisión. Lo habitual es dejar el pago fuera de
la app y que Premium se contrate desde la web.

## 5. Lo que hay que ordenar en el código antes de una app nativa

Esto es lo que evitará rehacer trabajo el día que exista un cliente nativo:

1. **Sesión por token, no solo por cookie.** Hoy la sesión vive en una cookie
   (`src/lib/auth.ts`). Una app nativa no maneja cookies igual: hace falta
   aceptar también una cabecera `Authorization` con un token de larga duración
   y un endpoint para renovarlo.
2. **Los tipos ya son compartibles.** Todos los DTO están en `src/lib/types.ts`
   y las rutas devuelven exactamente eso. El día que haya app nativa, ese
   archivo se copia o se publica como paquete y el cliente ya tiene los tipos.
3. **Nada de lógica de negocio en los componentes.** Las reglas viven en
   `src/lib/` (por ejemplo `call-score.ts`, `premium.ts`, `badges.ts`). Mantenerlo
   así: lo que esté en `src/components` no se puede reutilizar en una app nativa.
4. **Versionar la API el día que cambie de forma.** Una app publicada en las
   tiendas tarda días en actualizarse en los teléfonos: el servidor tendrá que
   aguantar la versión anterior una temporada.
5. **Enlaces profundos con esquema propio.** Ya existe `/app?tab=`; para nativo
   habrá que mapear cada pantalla (`cabal://launch/<id>`, `cabal://u/<handle>`).
6. **Subida de imágenes.** Ya se reduce en el cliente antes de subir
   (`shrinkForUpload` en `src/lib/api-client.ts`); en nativo habrá que repetir
   ese paso con la librería equivalente.
