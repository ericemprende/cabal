import type { CapacitorConfig } from '@capacitor/cli'

/**
 * App de iOS: carga la web en vivo (server.url), así cada despliegue llega a
 * la app sin pasar por revisión. `www/` solo es la pantalla sin conexión.
 *
 * appendUserAgent es la marca que lee src/lib/native-app.ts para ocultar en
 * iOS las compras y donaciones que la App Store no permite fuera de IAP.
 */
const config: CapacitorConfig = {
  appId: 'army.cabal.app',
  appName: 'Cabal',
  webDir: 'www',
  server: {
    url: 'https://cabal.army/app',
    // Mientras exista la redirección a beta, la app tiene que poder seguirla
    allowNavigation: ['cabal.army', '*.cabal.army'],
    errorPath: 'offline.html',
  },
  ios: {
    appendUserAgent: 'CabalApp-iOS',
    contentInset: 'always',
    backgroundColor: '#0a0b08',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#0a0b08', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0a0b08' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
}

export default config
