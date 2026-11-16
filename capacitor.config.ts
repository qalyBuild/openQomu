import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Configuración de la app Android de openQomu.
 *
 * La web se compila con Vite en `dist` y Capacitor la empaqueta en el APK.
 * Define `CAPACITOR_APP_ID` y `CAPACITOR_APP_NAME` para usar tu propio
 * identificador, y añade tu `google-services.json` para las notificaciones.
 */
const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID?.trim() || 'app.openqomu',
  appName: process.env.CAPACITOR_APP_NAME?.trim() || 'openQomu',
  webDir: 'dist',
  android: {
    backgroundColor: '#0c0b12',
    allowMixedContent: false,
    // Sin captura manual del WebView: así el teclado de Android recupera
    // sugerencias, autocorrección, mayúsculas y el cursor deslizante.
    captureInput: false,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 1,
    },
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: false,
      backgroundColor: '#0c0b12',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
