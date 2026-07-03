# DEBUG_SIGNUP — Investigación HTTP 429 en registro

**Fecha:** 2026-07-02  
**Alcance:** Flujo `signUp()` → `supabase.auth.signUp()` en FARO  
**Metodología:** Revisión estática del código + análisis de condiciones de carrera en React

---

## Resumen ejecutivo

El **429 no proviene de un retry automático en TanStack Query ni de un `useEffect` que re-ejecute el registro**. La causa raíz identificada en código es una **condición de carrera (TOCTOU)** entre el guard `if (isSubmitting) return` y `setIsSubmitting(true)`: dos clics rápidos (o clic durante la espera de Turnstile antes del re-render) pueden ejecutar **`signUp()` dos veces** antes de que React deshabilite el botón.

Cada `signUp()` dispara un email de confirmación vía Supabase Auth → el segundo intento choca con el **rate limit de emails** → **HTTP 429**.

---

## Respuestas a las 9 preguntas de investigación

### 1. ¿Cuántas veces se ejecuta `signUp()` por cada clic?

**Diseño esperado:** 1 vez por envío del formulario.

**Comportamiento anterior (bug):** hasta **2+ veces** con doble clic en la ventana entre:
- primer `handleSubmit` (pasa `isSubmitting === false`)
- re-render con `isSubmitting === true`

**Evidencia en código (antes del fix):**

```typescript
// auth-screen.tsx — patrón vulnerable
async function handleSubmit(e?: FormEvent) {
  e?.preventDefault()
  if (isSubmitting) return   // ← lectura asíncrona: stale en el 2.º clic
  setIsSubmitting(true)      // ← no bloquea hasta el siguiente render
  // ...
  await signUp(...)          // ← puede ejecutarse N veces
}
```

**Cadena de llamadas (una ejecución legítima):**
```
<form onSubmit> → handleSubmit → signUp (context) → authService.signUp → supabase.auth.signUp
```
Solo **un** punto de entrada en UI (`auth-screen.tsx` línea ~88).

---

### 2. ¿Doble disparo entre `onClick` y `onSubmit`?

**No.** Tras la refactorización previa:
- El botón usa `type="submit"` **sin** `onClick`.
- Solo existe `<form onSubmit={(e) => void handleSubmit(e)}>`.
- **No hay** handler duplicado onClick + onSubmit en el botón de registro.

**Conclusión:** descartado como causa del doble envío.

---

### 3. ¿Hay algún `useEffect` que vuelva a ejecutar el registro?

**No.**

| Archivo | useEffect | ¿Llama signUp? |
|---------|-----------|----------------|
| `auth-screen.tsx` | Solo reacciona a `pendingAuthIntent === 'password_recovery'` → cambia mode | ❌ |
| `auth-context.tsx` | `initAuth()` → `completeAuthFromUrl()` + `getSession()` | ❌ |
| `auth-context.tsx` | `onAuthStateChange` → `loadProfile()` | ❌ (REST, no signUp) |

`signUp` solo aparece en:
- `src/screens/auth-screen.tsx`
- `src/store/auth-context.tsx` (passthrough)
- `src/services/auth-service.ts` (implementación)

---

### 4. ¿React StrictMode causa efectos secundarios?

**StrictMode está activo** (`src/main.tsx`).

En **React 18+**, StrictMode en desarrollo:
- **Duplica montaje de effects** (`useEffect`), no handlers de eventos del usuario.
- **No duplica** `handleSubmit` por un solo clic.

`initAuth` puede ejecutar `getSession()` dos veces en DEV → más tráfico a `/auth/v1/token?grant_type=refresh` o similar, **pero no `signUp`**.

**Conclusión:** StrictMode no explica doble `signUp` por clic; puede amplificar lecturas de sesión al cargar la app.

---

### 5. ¿TanStack Query o algún listener vuelve a disparar la petición?

**No para signUp.**

- TanStack Query (`query-provider.tsx`): `retry: 1` solo en **queries**, no en mutaciones auth.
- No existe `useMutation` para registro.
- `onAuthStateChange` tras signUp exitoso dispara `loadProfile()` (REST `/rest/v1/profiles`), no otro signUp.

---

### 6. ¿Existe algún retry automático?

| Capa | Retry |
|------|-------|
| TanStack Query | Solo queries, no auth |
| supabase-js signUp | Sin retry configurado |
| Service Worker | Cachea `/rest/v1/*`, **no** `/auth/v1/signup` |
| Turnstile `getResponsePromise` | Poll cada 250 ms, **no** re-envía signUp |

**429 en `/auth/v1/recover` o signup** = límite del **servidor Supabase Auth** (emails/hora), no retry del cliente.

---

### 7. ¿El botón puede pulsarse varias veces antes de recibir respuesta?

**Sí — este era el bug principal.**

Secuencia con doble clic (~50 ms apart):

```
T0  Clic 1: isSubmitting=false → entra handleSubmit → setIsSubmitting(true)
T1  Clic 2: isSubmitting AÚN false (React no re-renderizó) → entra handleSubmit otra vez
T2  await requestCaptchaToken() × 2
T3  authService.signUp() × 2  → 2× POST /auth/v1/signup → 429 en el segundo
T4  Re-render: botón disabled (demasiado tarde)
```

Durante Turnstile (~hasta 12 s), `isSubmitting` ya es `true` **si el primer clic obtuvo el lock** — pero **sin ref síncrono**, un segundo clic antes del primer `setIsSubmitting` igual pasaba.

---

### 8. Logs temporales (`console.count`)

Archivo: `src/lib/signup-debug.ts`

Activación:
- Automático en `import.meta.env.DEV`
- En producción: `VITE_SIGNUP_DEBUG=1` en Vercel + redeploy

Contadores:
| Label | Significado |
|-------|-------------|
| `auth-screen.handleSubmit invoked` | Cada intento de submit |
| `auth-screen.handleSubmit BLOCKED (submitLockRef)` | Segundo clic bloqueado por mutex |
| `auth-screen.handleSubmit BLOCKED (isSubmitting state lag)` | Segundo clic bloqueado por state (backup) |
| `auth-screen.handleSubmit calling signUp()` | Justo antes de signUp |
| `authService.signUp → supabase.auth.signUp` | Cada llamada real a Supabase |

**Prueba manual esperada tras el fix (1 clic):**
```
[FARO signup-debug] auth-screen.handleSubmit invoked: 1
[FARO signup-debug] auth-screen.handleSubmit calling signUp(): 1
[FARO signup-debug] authService.signUp → supabase.auth.signUp: 1
```

**Doble clic (2.º bloqueado):**
```
handleSubmit invoked: 2
BLOCKED (submitLockRef): 1
authService.signUp: 1   ← solo una petición de red
```

---

### 9. Solución implementada

**Mutex síncrono con `useRef`** además de `isSubmitting`:

```typescript
const submitLockRef = useRef(false)

async function handleSubmit(e?: FormEvent) {
  e?.preventDefault()
  if (submitLockRef.current) return  // bloqueo inmediato, mismo tick
  submitLockRef.current = true
  setIsSubmitting(true)
  try { /* ... */ }
  finally {
    submitLockRef.current = false
    setIsSubmitting(false)
  }
}
```

Misma protección en `handleResend()` (también golpea endpoints auth y puede 429).

**Ajuste menor en `auth-service.ts`:** `captchaToken` solo se incluye en options si existe (consistente con login).

---

## Causa raíz

**Condición de carrera TOCTOU:** el guard basado en `useState(isSubmitting)` no es atómico. Múltiples invocaciones de `handleSubmit` pueden alcanzar `signUp()` antes del re-render, generando **N peticiones POST** a Supabase Auth por un solo intento percibido del usuario → **429** por rate limit de emails/registro.

Factores agravantes (no causa primaria):
- Usuario reintenta al no ver feedback instantáneo (Turnstile invisible hasta ~12 s).
- Intentos previos de registro/recuperación acumulan cuota 429 en Supabase.
- `resendSignupConfirmation` sin mutex compartía el mismo patrón vulnerable.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/screens/auth-screen.tsx` | `submitLockRef` mutex + logs debug |
| `src/services/auth-service.ts` | Logs debug + captchaToken condicional |
| `src/lib/signup-debug.ts` | **Nuevo** — helper `console.count` |
| `src/vite-env.d.ts` | Tipo `VITE_SIGNUP_DEBUG` |
| `DEBUG_SIGNUP.md` | **Este documento** |

**Sin cambios de UI** (mismos textos, layout y estilos).

---

## Evidencia encontrada

1. **Un solo call site** de signUp en UI → el duplicado no es arquitectura distribuida, es re-entrada en el mismo handler.
2. **No onClick + onSubmit** duplicados en el botón actual.
3. **Guard `isSubmitting` insuficiente** por naturaleza asíncrona de setState (documentado en React).
4. **StrictMode / TanStack / useEffect** descartados para signUp duplicado.
5. **429 típico de Supabase Auth** cuando se envían 2+ emails de confirmación en ventana corta (comportamiento esperado del servidor ante abuso).

---

## Verificación recomendada

1. `npm run dev` → abrir auth → pestaña Registro.
2. DevTools → Console + Network.
3. Doble clic rápido en "Registrarse".
4. Confirmar:
   - `authService.signUp` count = **1**
   - Network: **1** request a `/auth/v1/signup`
5. Para prod: `VITE_SIGNUP_DEBUG=1` temporal, redeploy, repetir, luego quitar.

---

## Limpieza posterior

Cuando el 429 esté resuelto, eliminar o desactivar:
- `src/lib/signup-debug.ts`
- imports y llamadas `countSignupDebug` en auth-screen y auth-service
- variable `VITE_SIGNUP_DEBUG` si se añadió en Vercel

---

## Nota sobre 429 persistentes

Si tras el fix sigue habiendo 429 con **count = 1** en signUp, la cuota de Supabase ya está agotada por intentos anteriores. Esperar 15–60 min o usar otro email. Eso sería límite de plataforma, no doble envío del cliente.
