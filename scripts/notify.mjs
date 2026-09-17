#!/usr/bin/env node
// Una pasada del worker de avisos (Telegram + campanita), a mano:
//   bun run notify:run
// En producción ya corre solo dentro del servidor (src/instrumentation.ts).

import { runNotificationTick } from '../src/lib/notifications.ts'

const r = await runNotificationTick()
console.log('[notify]', r)
process.exit(0)
