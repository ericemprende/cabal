#!/usr/bin/env node
// Genera el par de claves VAPID de los avisos push:
//   bun run push:keys
// Pegar el resultado en las variables de entorno (Dokploy) y redesplegar.
// OJO: si se cambian las claves, las suscripciones guardadas dejan de valer y
// cada persona tendrá que volver a aceptar los avisos.
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('VAPID_SUBJECT=mailto:hola@cabal.army')
