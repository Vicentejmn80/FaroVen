# SECURITY REPORT - FARO (Pre-Produccion)

Fecha: 2026-07-02  
Alcance: hardening de seguridad sin cambios visuales ni de navegacion.

## Estado general

- Estado actual: **Apto para preproduccion controlada**.
- Riesgo residual: **Medio** (dependencias operativas y revision manual de RLS regional).
- Build: **OK** (`npm run build`).

## Riesgos encontrados

### Criticos

1. **Politicas RLS de escritura publica demasiado amplias**
   - Existian politicas `public_insert_*` y `public_update_*` sobre centros y necesidades.
   - Permitian que anonimos/autenticados escribieran fuera de su rol.

2. **Ausencia de rate limiting en escrituras criticas**
   - Reportes, solicitudes de coordinador, cambios de inventario/saturacion sin throttling de backend.

3. **Validacion backend insuficiente**
   - Campos clave dependian del frontend (longitudes, email, coordenadas, referencias de sitio).

### Altos

4. **Mensajes de error potencialmente sensibles**
   - Varios flujos exponian mensajes tecnicos de Supabase/PostgREST.

5. **Storage policies permisivas**
   - Buckets con politicas de lectura/escritura sin ownership estricto.

6. **Headers HTTP de seguridad incompletos**
   - Faltaba CSP y cabeceras base anti-clickjacking / anti-mime-sniffing.

## Riesgos corregidos

## 1) Supabase: RLS, validacion y anti-abuso

Archivo: `supabase/migrations/20260630270000_security_hardening.sql`

Cambios:
- Se agrega `security_rate_limits` + funcion `enforce_rate_limit(...)`.
- Se agregan helpers de seguridad:
  - `security_client_ip()`
  - `security_actor_key()`
  - `validate_email_strict(...)`
  - `validate_uuid_text(...)`
  - `assert_text_bounds(...)`
  - `assert_valid_site_reference(...)`
- Se eliminan politicas publicas de escritura inseguras:
  - `public_insert_hospitals`, `public_insert_shelters`, `public_insert_supply_centers`
  - `public_insert_needs`, `public_update_needs`
  - `public_update_hospitals`, `public_update_shelters`, `public_update_supply_centers`
  - `public_review_pending_reports` (anon update reports)
- Se revocan grants anon de escritura en tablas criticas.
- Se endurece lectura publica de reportes a `status = 'verified'`.
- Se agregan triggers de validacion/rate-limit:
  - `trg_validate_report_write` (`reports`)
  - `trg_validate_coordinator_request_write` (`coordinator_requests`)
  - `trg_validate_need_write` (`needs`)
  - `trg_validate_hospital_write` / `shelter` / `supply_center`
- Se endurecen policies de Storage por ownership y carpeta propia:
  - `reports-images`
  - `person-lists`

## 2) CAPTCHA (Cloudflare Turnstile, invisible)

Archivos:
- `src/components/security/invisible-turnstile.tsx`
- `src/screens/auth-screen.tsx`
- `src/screens/reports-screen.tsx`
- `src/screens/coordinator-request-screen.tsx`
- `src/store/auth-context.tsx`
- `src/services/auth-service.ts`
- `src/vite-env.d.ts`
- `.env.example`
- `package.json`, `package-lock.json`

Cambios:
- Integracion invisible de Turnstile en:
  - Login
  - Registro
  - Recuperar contrasena
  - Reporte ciudadano
  - Solicitud de coordinador
- En auth, se envia `captchaToken` a Supabase (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `resend`).
- Dependencia agregada: `@marsidev/react-turnstile`.

## 3) Manejo de errores seguro

Archivos:
- `src/lib/auth-errors.ts`
- `src/lib/supabase-errors.ts`
- `src/components/admin/request-info-modal.tsx`
- `src/components/coordinator/coordinator-reports-inbox.tsx`
- `src/components/coordinator/coordinator-needs-module.tsx`
- `src/screens/reports-screen.tsx`
- `src/screens/update-saturation-flow.tsx`
- `src/screens/register-need-flow.tsx`
- `src/screens/adjust-need-stock-flow.tsx`

Cambios:
- Se deja de propagar error tecnico al usuario.
- Mensajes finales son amigables y no exponen detalles internos.

## 4) Headers HTTP y privacidad

Archivos:
- `vercel.json`
- `index.html`

Cambios:
- Headers agregados:
  - `Content-Security-Policy`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Strict-Transport-Security`
- Meta privacidad:
  - `robots: noindex, nofollow, noarchive, nosnippet`
  - `referrer: strict-origin-when-cross-origin`

## Riesgos pendientes (requieren intervencion manual)

1. **Scope regional de admins**
   - Falta un modelo de datos explicito de region/asignacion regional para enforcement estricto.
   - Hoy se endurecio acceso general, pero la restriccion "admin regional solo su region" requiere definir esa entidad y sus relaciones.

2. **Aplicacion y verificacion en Supabase remoto**
   - La migracion de hardening debe aplicarse y probarse en staging/prod.
   - Requiere validacion manual de cada policy antes de producción (recomendado).

3. **Configuracion de Turnstile en Supabase Dashboard**
   - Activar Bot Protection con Cloudflare Turnstile en Auth.
   - Configurar claves correctas (site key publica, secret key en Supabase).

4. **Rate limits de Auth en plataforma**
   - Complementar con parametros de anti-abuso de Supabase Auth (email/send limits, abuse settings).

## Nivel de riesgo por area (actual)

- RLS y permisos: **Medio** (mejorado, pendiente region-scope formal).
- Validacion backend: **Medio-bajo** (agregada en triggers/funciones).
- Abuso (rate limiting): **Medio-bajo** (backend implementado en escrituras operativas).
- CAPTCHA: **Medio-bajo** (integrado en frontend + auth token; falta activar dashboard).
- Exposicion de errores: **Bajo**.
- Seguridad HTTP frontend: **Bajo**.

## Checklist de seguridad (pre go-live)

- [ ] Aplicar `20260630270000_security_hardening.sql` en staging.
- [ ] Ejecutar pruebas de permisos por rol:
  - [ ] anon no escribe centros/needs
  - [ ] coordinador solo su sitio
  - [ ] regional_admin segun alcance definido
  - [ ] super_admin global
- [ ] Activar Turnstile en Supabase Auth Dashboard.
- [ ] Configurar `VITE_TURNSTILE_SITE_KEY` en entorno.
- [ ] Reprobar flujos: login/signup/recover/report/coordinator-request.
- [ ] Verificar que no se muestran errores tecnicos al usuario.
- [ ] Repetir smoke test de build y despliegue.

## Recomendaciones antes de abrir FARO al publico

1. Definir formalmente el modelo de **region administrativa** y cerrar ese control en RLS.
2. Ejecutar una ronda de **tests de seguridad por rol** con usuarios reales de staging.
3. Configurar monitoreo de errores (Sentry o equivalente) para no depender solo de consola.
4. Congelar migraciones de hardening y pasar por revision dual (seguridad + producto).
5. Hacer un ejercicio de abuso controlado (spam reports, fuerza bruta auth, flood de needs).
