# UX, WIREFRAMES Y ROADMAP

## 13. Wireframes (Descripción Textual)

### Pantalla Principal (Home)

```
┌─────────────────────────────────────┐
│  🗼 FaroVen                         │
│  Información verificada en Venezuela │
│  Última actualización: [fecha/hora] │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │   🔍  BUSCAR PERSONA       │    │
│  │   (botón grande, primario)  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌──────────┐ ┌──────────┐         │
│  │ 🏥      │ │ 🏠      │         │
│  │ Hospitales│ │ Refugios │         │
│  └──────────┘ └──────────┘         │
│                                     │
│  ┌──────────┐ ┌──────────┐         │
│  │ 📦      │ │ ⚡      │         │
│  │ Centros  │ │ Necesid. │         │
│  │ Acopio   │ │          │         │
│  └──────────┘ └──────────┘         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ⚠ Reportar Error           │    │
│  └─────────────────────────────┘    │
│                                     │
│  [¿Eres voluntario? Inicia sesión]  │
└─────────────────────────────────────┘
```

### Pantalla de Búsqueda

```
┌─────────────────────────────────────┐
│ ← Volver          Buscar Persona    │
├─────────────────────────────────────┤
│                                     │
│  Nombre(s)   [________________]     │
│  Apellido(s) [________________]     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │      🔍 BUSCAR             │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│ Resultados (3 encontrados)          │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ María García Pérez              │ │
│ │ 🟢 LESIONADO LEVE              │ │
│ │ 🏥 Hospital General #234       │ │
│ │ 📅 27/06/2026 19:30            │ │
│ │ 📋 Fuente: Cruz Roja           │ │
│ │ ⭐ Confianza: ALTA             │ │
│ │ 📝 Observaciones: Estable      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Juan García López               │ │
│ │ 🟡 TRASLADADO                  │ │
│ │ 🏥 Hospital Central → Ref. #12 │ │
│ │ 📅 27/06/2026 18:45            │ │
│ │ 📋 Fuente: Protección Civil    │ │
│ │ ⭐ Confianza: ALTA             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Ana García Ruiz                 │ │
│ │ ⚪ SIN INFORMACIÓN              │ │
│ │ No se encontró información en   │ │
│ │ fuentes verificadas.            │ │
│ │ 📅 27/06/2026 20:00             │ │
│ │ [Reportar información]          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Pantalla de Resultado Individual

```
┌─────────────────────────────────────┐
│ ← Volver            Resultado       │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │     María García Pérez          ││
│  │                                  ││
│  │  Estado:                        ││
│  │  🟢 LESIONADO LEVE              ││
│  │                                  ││
│  │  Ubicación:                     ││
│  │  🏥 Hospital General            ││
│  │  Av. Central #234, Col. Centro  ││
│  │  [Ver en mapa]                  ││
│  │                                  ││
│  │  📅 Actualizado: 27/06/2026     ││
│  │     19:30 hrs                   ││
│  │                                  ││
│  │  📋 Fuente: Cruz Roja           ││
│  │  ⭐ Confianza: ALTA             ││
│  │                                  ││
│  │  📝 Observaciones:              ││
│  │  Paciente estable, en          ││
│  │  observación.                  ││
│  │                                  ││
│  │  ⚠ ¿Información incorrecta?    ││
│  │  [Reportar Error]               ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Pantalla de Necesidades

```
┌─────────────────────────────────────┐
│ ← Volver          Necesidades       │
├─────────────────────────────────────┤
│                                     │
│  🔴 CRÍTICO                        │
│  ┌─────────────────────────────────┐│
│  │ 🩸 Sangra O+        ██████░░ 60%││
│  │ Agua potable        ████░░░░ 40%││
│  └─────────────────────────────────┘│
│                                     │
│  🟠 ALTO                            │
│  ┌─────────────────────────────────┐│
│  │ 👶 Pañales          ███████░ 70%││
│  │ 🍼 Leche infantil   ██████░░ 60%││
│  └─────────────────────────────────┘│
│                                     │
│  🟡 MEDIO                           │
│  ┌─────────────────────────────────┐│
│  │ 🛏️ Cobijas          ████████ 80%││
│  │ 💊 Medicinas        ████░░░░ 40%││
│  └─────────────────────────────────┘│
│                                     │
│  🟢 BAJO                            │
│  ┌─────────────────────────────────┐│
│  │ 🥫 Alimentos no pér. ██████░ 65%││
│  └─────────────────────────────────┘│
│                                     │
│  📅 Actualizado: 27/06/2026 20:00  │
└─────────────────────────────────────┘
```

### Pantalla de Reportar Error

```
┌─────────────────────────────────────┐
│ ← Volver        Reportar Error      │
├─────────────────────────────────────┤
│                                     │
│  ¿Qué tipo de error encontraste?    │
│                                     │
│  ○ Información incorrecta           │
│  ○ La persona ya apareció           │
│  ○ La persona fue trasladada        │
│  ○ El hospital cambió               │
│  ○ La necesidad ya fue cubierta     │
│  ○ Otro                             │
│                                     │
│  Describe el error:                 │
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  │ [_____________________________] ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  Tu nombre (opcional):              │
│  [________________]                  │
│                                     │
│  Tu email (opcional):               │
│  [________________]                  │
│                                     │
│  📎 Adjuntar captura (opcional)     │
│  [Seleccionar archivo]              │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ENVIAR REPORTE             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ℹ️ Los reportes serán revisados   │
│  por nuestro equipo antes de        │
│  realizar cualquier cambio.        │
└─────────────────────────────────────┘
```

### Pantalla Admin — Dashboard

```
┌─────────────────────────────────────┐
│ 🛡️ Panel Admin        [cerrar sesión]│
├─────────────────────────────────────┤
│                                     │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ │ ⏳ 47 │ │ 👥 23 │ │ 🏥 12 │ │ 🏠 8 ││
│ │Pend. │ │Usuarios│ │Hosp. │ │Refug.││
│ └──────┘ └──────┘ └──────┘ └──────┘│
│                                     │
│ Cambios Pendientes de Revisión      │
│ ┌────────────────────────────────┐  │
│ │ María García → Hospital   [🔍] │  │
│ │ Juan Pérez → Estado       [🔍] │  │
│ │ Lista Cruz Roja.csv       [🔍] │  │
│ └────────────────────────────────┘  │
│                                     │
│ Actividad Reciente (24h)            │
│ ┌────────────────────────────────┐  │
│ │ ████████████░░ 120 updates    │  │
│ │ ██████░░░░░░░ 45 reports      │  │
│ │ ██████████████ 3 new admins   │  │
│ └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

## 14. Convención de Nombres

### Frontend

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Componentes | PascalCase | `SearchResult.tsx` |
| Páginas | PascalCase | `HomePage.tsx` |
| Hooks | camelCase + `use` | `useSearch.ts` |
| Utilidades | camelCase | `formatDate.ts` |
| Estilos | kebab-case en classes | `search-result-card` |
| Archivos | kebab-case | `supply-center-card.tsx` |
| Tipos | PascalCase | `PersonStatus` |
| Interfaces | PascalCase sin prefijo | `PersonResult` |
| Enums | PascalCase | `ConfidenceLevel` |
| Variables | camelCase | `searchResults` |
| Constantes | UPPER_SNAKE_CASE | `MAX_SEARCH_RESULTS` |

### Base de Datos

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Tablas | snake_case, plural | `supply_centers` |
| Columnas | snake_case | `first_name` |
| PKs | `id` (UUID) | `id` |
| FKs | `{tabla}_id` | `hospital_id` |
| Timestamps | `created_at`, `updated_at` | `created_at` |
| Soft delete | `deleted_at` | `deleted_at` |
| Funciones | snake_case | `search_person` |
| Enums | snake_case | `person_status` |

## 15. Roadmap del MVP

### Fase 0 — Fundación (Semana 1)

| Tarea | Prioridad |
|-------|-----------|
| Setup: Vite + React + Tailwind + shadcn/ui | P0 |
| Setup: Supabase project + PostgreSQL schema | P0 |
| Configurar Vercel + dominio + HTTPS | P0 |
| Migraciones SQL: tables, indexes, RLS, triggers | P0 |
| Autenticación: Supabase Auth con OTP | P0 |
| Layout base responsive + modo oscuro | P0 |

### Fase 1 — Core (Semana 2)

| Tarea | Prioridad |
|-------|-----------|
| Módulo de búsqueda de personas (función SQL + UI) | P0 |
| Vista de resultado individual con fuente/confianza | P0 |
| Listado de hospitales + detalle | P1 |
| Listado de refugios + detalle | P1 |
| Listado de centros de acopio | P1 |
| Tablero de necesidades | P1 |
| Formulario de reportar error | P1 |
| Página "no encontrado" con copy correcto | P0 |

### Fase 2 — Roles (Semana 3)

| Tarea | Prioridad |
|-------|-----------|
| Dashboard voluntario | P1 |
| Flujo: voluntario actualiza persona → queda pending | P0 |
| Flujo: voluntario carga lista CSV | P1 |
| Dashboard administrador | P1 |
| Flujo: admin aprueba/rechaza cambios | P0 |
| Gestión de usuarios (admin) | P2 |
| Subida de archivos (Storage + RLS) | P1 |

### Fase 3 — IA y Pulido (Semana 4)

| Tarea | Prioridad |
|-------|-----------|
| Edge Function: OCR en imágenes | P2 |
| Edge Function: OCR en PDFs | P2 |
| Edge Function: detección de duplicados | P2 |
| Edge Function: normalización de nombres | P2 |
| Rate limiting (Edge Function o middleware) | P1 |
| hCaptcha en formulario de reportes | P1 |
| Pruebas de carga (k6) | P1 |
| Accesibilidad: contraste, lectores pantalla | P2 |

## 16. Roadmap de Versiones Futuras

### v1.1 — Post-MVP (Sprint 5-6)

- Mapa interactivo (Leaflet/Mapbox) para hospitales y refugios
- Exportación de resultados (CSV, PDF)
- Notificaciones push (cambios en personas seguidas)
- API pública para integración con gobiernos
- Internacionalización (inglés + lenguas indígenas)
- Modo sin conexión (PWA + Service Worker cache)

### v1.2 — Escalabilidad (Sprint 7-8)

- Caché con Redis (via Upstash) para búsquedas frecuentes
- CDN para archivos estáticos y almacenamiento
- Cola de procesamiento (RabbitMQ o Bull) para trabajos OCR
- Vistas materializadas para dashboards
- Sharding por región geográfica
- Auto-scaling en Vercel (Edge Functions)

### v2.0 — Avanzado (Q3)

- App móvil nativa (React Native)
- Notificaciones SMS para familiares (Twilio)
- Reconocimiento facial (solo backend, con consentimiento explícito)
- Integración con sistemas gubernamentales (API government)
- Dashboard público con estadísticas anonimizadas
- Chatbot para consultas rápidas
- Reportes por WhatsApp

### v3.0 — Plataforma Multi-Emergencia (Q4)

- Múltiples emergencias simultáneas
- Plantillas de configuración por tipo de desastre
- Federación de datos entre regiones
- Marketplace de voluntarios
- Panel de donaciones

## 17. Lista Priorizada de Tareas para Comenzar

### P0 — Imprescindible (No hay MVP sin esto)

1. Setup del proyecto (Vite + React + Tailwind + shadcn/ui + Supabase)
2. Migración SQL inicial: todas las tablas y enums
3. Índices de búsqueda (pg_trgm, tsvector)
4. RLS policies básicas
5. Triggers de auditoría y updated_at
6. Página Home con los 6 botones principales
7. Componente de búsqueda (SearchBar + llamada a RPC)
8. Función SQL `search_person`
9. Vista de resultado con: fuente, fecha, confianza
10. Mensaje "No se encontró información en las fuentes verificadas"
11. Layout responsive (mobile-first)
12. Modo oscuro

### P1 — Muy Importante

13. Listado de hospitales + detalle
14. Listado de refugios + detalle
15. Listado de centros de acopio
16. Tablero de necesidades con prioridades
17. Formulario "Reportar Error"
18. Autenticación con OTP
19. Dashboard voluntario
20. Flujo de actualización con aprobación
21. Dashboard administrador
22. Gestión de usuarios (admin)
23. Rate limiting básico
24. hCaptcha/reCAPTCHA

### P2 — Mejora

25. Subida de archivos (Storage)
26. Edge Functions OCR
27. Detección de duplicados
28. Normalización de nombres
29. Historial completo (audit_logs)
30. Pruebas automatizadas (vitest + Playwright)
31. Pruebas de carga

## 18. Buenas Prácticas de Privacidad (Resumen Ejecutivo)

1. **Minimización**: Solo nombre, estado, ubicación institucional. Nada más.
2. **Separación**: Reportante nunca vinculado a persona buscada.
3. **Ofuscación**: Resultados parciales sin revelar volumen de datos.
4. **No indexación**: `noindex` en HTML y headers HTTP.
5. **Cifrado**: TLS 1.3 en tránsito, cifrado en reposo en Supabase.
6. **Soft delete**: `deleted_at` primero, purga real a los 90 días.
7. **Consentimiento**: Toda fuente debe ser verificable (hospital, autoridad).
8. **Logs sin PII**: No se registran nombres completos en audit_logs.
9. **Temporalidad**: Los datos se eliminan 30 días después del cierre de emergencia.
10. **Transparencia**: Cada dato mostrado tiene fuente, fecha y nivel de confianza visibles.
