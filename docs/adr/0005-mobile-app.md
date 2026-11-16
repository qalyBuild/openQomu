# ADR 0005: App Android interna con Capacitor y push sin Blaze

## Estado

Aceptado.

## Contexto

El equipo usa openQomu como SPA. La tarea «Crear App Mobile» pide una app nativa de Android para recibir push incluso con la app cerrada. Restricciones:

- La UI debe ser exactamente la misma que la web.
- El rendimiento debe ser bueno en dispositivos de gama media.
- Distribución como APK interna, sin Google Play.
- Push 100 % gratuito, sin plan Blaze ni Cloud Functions.

## Decisión

1. **Capacitor 8** empaqueta el build de Vite en un APK. Se reutilizan dominio, rutas y componentes.
2. **Google Sign-In nativo** con `@capgo/capacitor-social-login` y `signInWithCredential`; el OAuth dentro de WebView está bloqueado por Google.
3. **Push con FCM HTTP v1** enviado desde un Worker de Cloudflare:
   - El cliente escribe `pushOutbox` y llama a `POST /notify`.
   - Un cron cada minuto procesa pendientes y reintentos.
4. **Puertos nuevos** en el dominio (`DeviceRepository`, `PushOutbox`, `PushGateway`, `GoogleSignIn`) con adaptadores Firebase, Capacitor y demo.
5. **Decoradores** de repositorios para encolar eventos sin contaminar los casos de uso existentes (OCP).

## Alternativas

- **React Native/Expo:** mejor rendimiento nativo, pero obliga a reescribir UI, editor Tiptap, kanban y shadcn. No cumple «UI exactamente igual».
- **PWA:** descartada por el usuario y por las limitaciones de push en iOS.
- **Cloud Functions + FCM:** más simple, pero exige Blaze. Se descarta por el requisito de coste cero.
- **Worker con polling de mensajes:** evitaría el outbox, pero necesita cursores y duplica lecturas; el outbox es explícito e idempotente.

## Consecuencias

- Cada cambio de UI requiere recompilar el APK (no hay OTA).
- El Worker necesita un service account con permisos de Firestore y FCM.
- La app no pasa por Play Store; se instala manualmente.
- iOS queda para una fase futura y requerirá macOS/Xcode.
