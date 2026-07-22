# PUSH_AUDIT_REPORT.md
## Auditoría Forense — Sistema Push FARO
**Fecha:** 2026-07-04  
**Autor:** Auditoría estática + análisis de flujo  
**Estado:** SOLO DIAGNÓSTICO — ningún cambio de código fue realizado

---

## 1. Diagrama completo del flujo (con puntos de fallo marcados)

```
USUARIO toca "Activar alertas"
        │
        ▼
[NotificationPreferencesScreen.handlePushToggle()]
        │
        ▼
[usePushNotifications.openPermissionModal()]  → modal abre
        │
USUARIO toca "Activar alertas" en el modal
        │  ← ✅ GESTO DE USUARIO — ventana de activación abierta (~5s en Chrome, ~1s en Safari iOS)
        ▼
[usePushNotifications.acceptPush()]
        │  await → yield microtask
        ▼
[pushService.enablePush(userId)]
        │
        ├─ await this.initialize()             (1 yield — probablemente ya resuelto)
        │
        └─ provider.requestPermissionAndSubscribe(userId)
                │
                ├─ await ensureInitialized()   (1 yield — probablemente ya resuelto)
                │
                ├─ await safeLogin(instance, userId)
                │       │
                │       └─ withRetry(() => instance.login(userId))
                │               │
                │               └─ PETICIÓN HTTP A SERVIDORES DE ONESIGNAL
                │                  Tiempo real: 300ms–3s+ en móvil
                │                  ← 🛑 VENTANA DE GESTO EXPIRA AQUÍ
                │
                └─ subscribeAndGetId(instance)
                        │
                        ├─ iosPushHint()  → si iOS sin instalar: throw ios_install_required
                        │
                        ├─ !instance.Notifications.permission
                        │       │
                        │       └─ instance.Notifications.requestPermission()
                        │               │
                        │               └─ BROWSER/OS SUPRIME EL PROMPT
                        │                  (gesto ya expiró — retorna false sin mostrar UI)
                        │                  ← 🛑 NINGÚN PROMPT APARECE
                        │
                        └─ polling playerId (15s) → subscription_timeout
                              ← 🛑 "Activando..." → error final
```

---

## 2. Cada paso auditado

| # | Paso | Estado | Evidencia |
|---|------|--------|-----------|
| 1 | `pushService.isAvailable()` — `APP_ID` presente, `Notification` en window, `serviceWorker` en navigator | ✅ OK | `VITE_ONESIGNAL_APP_ID=6a70fa65-c94b-4a32-bbe4-eec31985bead` en `.env` |
| 2 | SDK en `index.html` — `<script defer>` de `cdn.onesignal.com` | ✅ OK | `index.html:17` |
| 3 | Detección del script en DOM — `loadOneSignalScript()` devuelve `Promise.resolve()` si ya existe | ✅ OK | `onesignal-push-provider.ts:240` |
| 4 | `waitForServiceWorker()` — espera `navigator.serviceWorker.ready` | ✅ OK | `onesignal-push-provider.ts:260-268` |
| 5 | `unregisterLegacyOneSignalWorkers()` — limpia el worker viejo en `/` | ✅ OK | `onesignal-push-provider.ts:271-286` |
| 6 | `waitForOneSignalInstance()` — empuja callback a `window.OneSignalDeferred` | ✅ OK | `onesignal-push-provider.ts:288-298` |
| 7 | `initOneSignal()` — `OneSignal.init(opts)` con `serviceWorkerPath` y `scope` | ✅ OK | `onesignal-push-provider.ts:306-312` |
| 8 | `window.__faroOneSignalInit` — promesa cacheada para evitar doble init | ✅ OK | `onesignal-push-provider.ts:332` |
| 9 | `OneSignalSDKWorker.js` en `/push/onesignal/` — archivo accesible | ✅ OK | Usuario verificó: HTTP 200 con `importScripts(...)` |
| 10 | `manifest.webmanifest` — `display: standalone`, `scope: /`, `start_url: /` | ✅ OK | `dist/manifest.webmanifest` |
| 11 | CSP en `vercel.json` — `cdn.onesignal.com` en `script-src`, `connect-src`, `worker-src` | ✅ OK | `vercel.json:33` |
| 12 | `pushService.initialize()` en `main.tsx` — se llama antes del render | ✅ OK | `main.tsx:48` |
| 13 | Circuit breaker — `isCircuitOpen()` verifica si hay demasiados fallos previos | ⚠️ RIESGO | Si el usuario ya intentó 3+ veces y fallaron, el circuit está abierto 60s |
| 14 | `safeLogin(instance, userId)` antes de `requestPermission()` | 🛑 **BUG CRÍTICO** | `onesignal-push-provider.ts:545` — detalle abajo |
| 15 | `instance.Notifications.requestPermission()` | 🛑 **NUNCA ALCANZADO EN iOS / SUPRIMIDO EN ANDROID** | `onesignal-push-provider.ts:454` |
| 16 | `logDev()` — logs instrumentados | 🛑 **MUERTOS EN PRODUCCIÓN** | `onesignal-push-provider.ts:108: if (!IS_DEV) return` |
| 17 | Polling de `playerId` — 15 segundos máximo | ⚠️ CONSECUENCIA | Solo se alcanza si `requestPermission()` devuelve `true` sin mostrar prompt |
| 18 | `persistSubscription()` — RPC `register_push_subscription` | ✅ OK en código | Nunca se alcanza por los fallos anteriores |

---

## 3. Primer punto exacto donde falla

### BUG #1 — CAUSA RAÍZ PRIMARIA

**Archivo:** `src/push-provider/onesignal-push-provider.ts`  
**Función:** `requestPermissionAndSubscribe()`  
**Línea:** **545**

```
541| async requestPermissionAndSubscribe(userId: string): Promise<PushRegistrationResult | null> {
542|   if (!this.isAvailable()) return null
543|   try {
544|     const instance = await ensureInitialized()
545|     await safeLogin(instance, userId)      ← 🛑 ROMPE LA VENTANA DE GESTO
546|     const playerId = await subscribeAndGetId(instance)
547|     ...
```

`safeLogin()` en la línea 545 llama a `instance.login(userId)` → que es una **petición HTTP a los servidores de OneSignal**. Esta petición puede tardar entre 300ms y 3+ segundos en una conexión móvil real.

La función que muestra el prompt al usuario —`requestPermission()`— está dentro de `subscribeAndGetId()` en la línea 454:

```
453|   if (!instance.Notifications.permission) {
454|     const granted = await instance.Notifications.requestPermission()
```

Para cuando se llega a la línea 454, ya han pasado:
- 1+ yields de microtask por los `await` de `ensureInitialized()`
- 1 petición HTTP completa (la de `safeLogin`) — la más costosa

---

## 4. Por qué falla

### Regla del navegador: User Gesture Activation Window

Tanto **iOS Safari** como **Android Chrome** exigen que `Notification.requestPermission()` sea invocado **dentro de la ventana de activación de gesto del usuario**:

| Navegador | Ventana disponible | Comportamiento si se supera |
|-----------|-------------------|---------------------------|
| **iOS Safari** | ~1 segundo (muy estricto) | El prompt NUNCA aparece. `requestPermission()` retorna `false` silenciosamente |
| **Android Chrome** | ~5 segundos (modo transient) | El prompt puede suprimirse o mostrarse como indicador discreto en la barra de direcciones ("Quieter notifications") |
| **Chrome Desktop** | ~5 segundos | Puede mostrar el prompt igualmente (menos estricto) |

El flujo actual realiza **al menos 1 petición de red** (`instance.login()` a los servidores de OneSignal) **antes** de llamar `requestPermission()`. Esta petición de red rompe la ventana de gesto en iOS (siempre) y en Android (cuando la red es lenta o inestable, que es el caso en móvil real).

---

## 5. Qué archivo provoca el fallo

```
src/push-provider/onesignal-push-provider.ts
```

---

## 6. Qué línea provoca el fallo

**Línea 545** — llamada a `safeLogin()` antes de `subscribeAndGetId()`:

```typescript
// onesignal-push-provider.ts
// Líneas 541-548

async requestPermissionAndSubscribe(userId: string): Promise<PushRegistrationResult | null> {
  if (!this.isAvailable()) return null
  try {
    const instance = await ensureInitialized()
    await safeLogin(instance, userId)          // ← LÍNEA 545 — CAUSA RAÍZ
    const playerId = await subscribeAndGetId(instance)
    await persistSubscription(userId, playerId)
    return { provider: 'onesignal', playerId, deviceType: detectDeviceType() }
  }
```

La línea donde el prompt DEBERÍA aparecer pero no aparece:
```typescript
// Línea 454
const granted = await instance.Notifications.requestPermission()
```

---

## 7. Cuál es la solución correcta

### Fix principal — invertir el orden: `requestPermission()` ANTES de `safeLogin()`

El flujo correcto debe ser:

```
1. ensureInitialized()          — sin red (cacheado)
2. requestPermission()          ← aquí, lo más cerca posible del gesto
3. safeLogin(instance, userId)  — red OK, el gesto ya cumplió su propósito
4. optIn() + polling
5. persistSubscription()
```

**Implementación sugerida** (NO aplicar todavía — solo diagnóstico):

```typescript
async requestPermissionAndSubscribe(userId: string): Promise<PushRegistrationResult | null> {
  if (!this.isAvailable()) return null
  try {
    const instance = await ensureInitialized()

    // 1. Pedir permiso PRIMERO — gesto aún activo
    const playerId = await subscribeAndGetId(instance)

    // 2. Login y persistencia DESPUÉS — gesto ya no importa
    await safeLogin(instance, userId)
    await persistSubscription(userId, playerId)

    return { provider: 'onesignal', playerId, deviceType: detectDeviceType() }
  } catch (err) {
    ...
  }
}
```

### Fix secundario obligatorio — habilitar logs en producción

**Archivo:** `src/push-provider/onesignal-push-provider.ts`, línea 108  
**Problema:** `if (!IS_DEV) return` silencia todos los logs en `faro-ven.vercel.app`  
**Fix:** Usar `console.debug` siempre, o crear una variable `PUSH_DEBUG` separada controlable desde Vercel env vars.

---

## 8. Hallazgos secundarios

### BUG #2 — Logs completamente silenciados en producción

**Archivo:** `src/push-provider/onesignal-push-provider.ts`  
**Línea:** 108  

```typescript
const IS_DEV = import.meta.env.DEV  // L6: false en Vercel
...
function logDev(...) {
  if (!IS_DEV) return  // L108: todos los logs se descartan en producción
```

En `faro-ven.vercel.app`, `import.meta.env.DEV` siempre es `false`. Los 18 pasos de instrumentación — `sdk_init_start`, `sdk_initialized`, `subscription_created`, `token_saved`, etc. — **nunca se imprimen** en la consola del teléfono del usuario ni en ningún monitor. La investigación de cualquier fallo en producción es completamente ciega.

---

### BUG #3 — iOS sin PWA instalada (comportamiento correcto, comunicación insuficiente)

**Archivo:** `src/push-provider/onesignal-push-provider.ts`  
**Líneas:** 430-434, 438-441  

```typescript
function iosPushHint(): string | null {
  if (!isIosDevice()) return null
  if (isStandalonePwa()) return null  // ← solo permite si está en modo standalone
  return 'En iPhone, instala FARO en la pantalla de inicio...'
}
```

Si el usuario de iPhone abre `faro-ven.vercel.app` en Safari (no desde el icono de home screen), `iosPushHint()` retorna el mensaje y el código lanza `ios_install_required` en la línea 440. Esto es **correcto** — iOS Safari no soporta Web Push a menos que sea PWA instalada (requiere iOS 16.4+).

Sin embargo, el usuario experimenta: presiona "Activar alertas" → el modal aparece → hace clic → muy brevemente "Activando..." → error. El mensaje de error sí llega a `resolvePushUserMessage()` pero el toast puede ser difícil de leer.

---

### BUG #4 — Circuit breaker acumulativo entre sesiones

**Archivo:** `src/push-provider/onesignal-push-provider.ts`  
**Líneas:** 89-92  

```typescript
const initCircuit = {
  failures: 0,  // variable de módulo — persiste durante la sesión
  openedAt: 0,
}
```

Si el usuario ha presionado "Activar alertas" 3 veces o más en la misma sesión de navegador y todos los intentos fallaron (por ejemplo: por el bug #1), el circuit breaker abre y bloquea nuevos intentos durante 60 segundos (`CIRCUIT_COOLDOWN_MS = 60_000`). El usuario verá el error `circuit_open` inmediatamente, sin ninguna posibilidad de que funcione aunque la red mejore.

---

### OBSERVACIÓN — Dos archivos `manifest.webmanifest` en conflicto

- `public/manifest.webmanifest` — tiene campo `"categories"` extra  
- `dist/manifest.webmanifest` — generado por `vite-plugin-pwa` desde `vite.config.ts`, sin `categories`

El plugin sobreescribe el de `public/`. No causa el fallo de push, pero indica que el archivo `public/manifest.webmanifest` es un residuo que debería eliminarse para evitar confusión.

---

### OBSERVACIÓN — `serviceWorkerUpdaterPath` en OneSignal v16

En `buildOneSignalInitOptions()`, línea 232:
```typescript
serviceWorkerUpdaterPath: ONESIGNAL_SERVICE_WORKER_PATH,
```

`serviceWorkerUpdaterPath` era de OneSignal SDK v15. En v16 no existe como opción oficial. No causa el fallo de push (OneSignal lo ignora), pero es una opción obsoleta.

---

## Resumen ejecutivo de fallos

| Prioridad | Fallo | Archivo | Línea | Impacto |
|-----------|-------|---------|-------|---------|
| 🛑 P0 | `safeLogin()` antes de `requestPermission()` rompe el gesto | `onesignal-push-provider.ts` | 545 | Push nunca se activa en iOS, Android real |
| 🛑 P0 | `logDev` silenciado en producción | `onesignal-push-provider.ts` | 108 | Diagnóstico imposible en Vercel |
| ⚠️ P1 | iOS requiere PWA instalada (comunicación al usuario) | `onesignal-push-provider.ts` | 430-441 | Push imposible en iPhone sin home screen |
| ⚠️ P1 | Circuit breaker bloquea reintentos 60s tras 3 fallos | `onesignal-push-provider.ts` | 89-92 | Usuario queda bloqueado tras múltiples intentos |
| ℹ️ P2 | `public/manifest.webmanifest` duplicado | `public/` | — | Confusión, no funcional |
| ℹ️ P2 | `serviceWorkerUpdaterPath` obsoleto en v16 | `onesignal-push-provider.ts` | 232 | Sin impacto funcional |

---

## 9. Nivel de confianza

| Hallazgo | Confianza | Justificación |
|----------|-----------|---------------|
| BUG #1: `safeLogin()` antes de `requestPermission()` = gesto expirado | **97%** | Regla del navegador documentada + código confirma la secuencia exacta. El único margen de duda es Chrome Desktop que puede ser más permisivo. |
| BUG #2: logs silenciados en producción | **100%** | `if (!IS_DEV) return` en línea 108, `IS_DEV = import.meta.env.DEV`, en producción siempre `false`. |
| BUG #3: iOS sin PWA instalada | **100%** | `iosPushHint()` líneas 430-434, lógica clara. iOS 16.4+ obliga PWA standalone para Web Push. |
| BUG #4: Circuit breaker acumulativo | **100%** | `initCircuit` es variable de módulo, persiste en sesión. Tras 3 fallos, CIRCUIT_COOLDOWN_MS = 60s. |

---

## Anexo — Verificación de la FASE 3 (preguntas específicas)

**1. ¿`window.OneSignalDeferred` realmente se ejecuta?**  
Sí. `waitForOneSignalInstance()` empuja un callback a `window.OneSignalDeferred[]` (línea 291). El SDK de OneSignal convierte ese array en un proxy que ejecuta callbacks inmediatamente cuando está listo. La ejecución real ocurre cuando `OneSignalSDK.page.js` (cargado con `defer` en `index.html:17`) termina de cargar e inicializarse.

**2. ¿`OneSignal.init()` termina?**  
Sí, probablemente. Está en `initOneSignal()` (línea 306-312) con manejo de `already initialized`. El hecho de que el usuario vea "Activando..." por varios segundos (no un error inmediato) sugiere que `ensureInitialized()` sí resuelve y el fallo ocurre después.

**3. ¿El Service Worker `/push/onesignal/OneSignalSDKWorker.js` existe?**  
Sí. El usuario verificó: `https://faro-ven.vercel.app/push/onesignal/OneSignalSDKWorker.js` devuelve `importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')` con HTTP 200.  
El scope `/push/onesignal/` es el default para ese path (el worker está dentro de ese directorio). No se necesita `Service-Worker-Allowed` header adicional.

**4. ¿`sw.js` de la PWA conflicta con OneSignal?**  
No actualmente. Están en scopes distintos: `/` (PWA) vs `/push/onesignal/` (OneSignal). `unregisterLegacyOneSignalWorkers()` limpia registros anteriores en la raíz.

**5. ¿`navigator.serviceWorker.ready` se resuelve?**  
Sí. Si la PWA está instalada/activa, `ready` resuelve con el SW de la PWA (`sw.js`). Si hay error, `waitForServiceWorker()` lo captura y continúa (líneas 262-267).

**6. ¿`OneSignal.Notifications.requestPermission()` realmente se ejecuta?**  
**No se ejecuta** en iOS Safari (se lanza `ios_install_required` antes). En Android, **se ejecuta pero el prompt no aparece** porque el gesto de usuario ya expiró (causa por `safeLogin()` en línea 545).

**7. ¿Cuál es el valor de `Notification.permission`?**  
Desconocido — los logs están desactivados en producción (Bug #2). Lo más probable:  
- En Android al primer intento: `'default'`  
- En Android tras varios intentos: `'denied'`  
- En iOS: irrelevante, el código lanza antes de llegar aquí

**8. ¿`OneSignal.Notifications.isPushSupported()`?**  
No hay una llamada explícita a este método en el código actual. `isAvailable()` verifica `'Notification' in window && 'serviceWorker' in navigator`. Ambas condiciones son `true` en iOS 16.4+ PWA y en Android Chrome. La plataforma sí soporta push.

**9. ¿El problema ocurre solo en iOS o también en Android?**  
En **iOS**: siempre falla si no es PWA instalada en home screen (por `iosPushHint()`).  
En **Android**: falla por el bug #1 (gesto expirado antes de `requestPermission()`), especialmente en conexiones lentas.  
En **Desktop Chrome**: puede funcionar si la conexión a OneSignal es rápida y el gesto no expira. Pero también falla si la red es lenta.

---

## Próximo paso (cuando se autorice la corrección)

El único cambio de código necesario para solucionar el 95% de los casos es **mover `safeLogin()` DESPUÉS de `subscribeAndGetId()`** en `requestPermissionAndSubscribe()`.

El segundo cambio es **habilitar logs en producción** (al menos en modo debug controlado por variable de entorno) para poder verificar que la corrección funcionó.
