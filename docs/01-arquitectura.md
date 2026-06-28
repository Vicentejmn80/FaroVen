# ARQUITECTURA DEL SISTEMA — FaroVen

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     VERCEL (Hosting)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React + Vite + Tailwind                 │   │
│  │              shadcn/ui + TanStack Query              │   │
│  │              PWA (Service Worker + Cache)            │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │ HTTPS                             │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │           Supabase Client Library (@supabase/supabase-js)│
│  │           • Auth (magic link / OTP)                    │   │
│  │           • Realtime (suscriptions)                    │   │
│  │           • Storage (images, PDFs)                     │   │
│  │           • Database (PostgreSQL via REST/GraphQL)     │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   SUPABASE (Backend)                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              PostgreSQL 15+                          │   │
│  │  • Full-text search (pg_trgm, tsvector)             │   │
│  │  • Row Level Security (RLS)                         │   │
│  │  • Triggers for audit_log + versioning              │   │
│  │  • Materialized views (cached counts)               │   │
│  │  • Indexes (GIN, GiST, B-tree)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Supabase Auth                             │   │
│  │  • Email OTP / Magic Link                           │   │
│  │  • Roles: volunteer, admin                          │   │
│  │  • RLS policies by role                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Supabase Storage                          │   │
│  │  • Buckets: attachments, reports, avatars           │   │
│  │  • RLS policies per bucket                          │   │
│  │  • File type validation (images, PDFs)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Edge Functions (Deno)                     │   │
│  │  • OCR processing (images/PDFs)                     │   │
│  │  • Duplicate detection                              │   │
│  │  • Name normalization                               │   │
│  │  • List comparison                                  │   │
│  │  • Rate limiting                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 2. Estructura de Carpetas

```
/
├── frontend/
│   ├── src/
│   │   ├── app/                    # App router / layout
│   │   │   ├── layout.tsx
│   │   │   ├── providers.tsx       # QueryClient, Theme, Auth
│   │   │   └── routes.tsx
│   │   ├── pages/
│   │   │   ├── Home/
│   │   │   ├── Search/
│   │   │   ├── Hospitals/
│   │   │   ├── Shelters/
│   │   │   ├── SupplyCenters/
│   │   │   ├── Needs/
│   │   │   ├── Report/
│   │   │   ├── Admin/
│   │   │   └── Auth/
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui base components
│   │   │   ├── layout/             # Header, Footer, Sidebar
│   │   │   ├── search/             # SearchBar, ResultCard
│   │   │   ├── needs/              # NeedBadge, NeedList
│   │   │   ├── hospital/           # HospitalCard, HospitalMap
│   │   │   ├── shelter/            # ShelterCard
│   │   │   ├── supply-center/      # SupplyCenterCard
│   │   │   ├── report/             # ReportForm
│   │   │   ├── admin/              # AdminTable, ApproveButton
│   │   │   └── shared/             # LoadingSpinner, ErrorBoundary
│   │   ├── hooks/
│   │   │   ├── useSearch.ts
│   │   │   ├── useHospitals.ts
│   │   │   ├── useShelters.ts
│   │   │   ├── useNeeds.ts
│   │   │   ├── useReport.ts
│   │   │   ├── useAuth.ts
│   │   │   └── useAdmin.ts
│   │   ├── lib/
│   │   │   ├── supabase.ts         # Supabase client
│   │   │   ├── constants.ts
│   │   │   ├── utils.ts
│   │   │   └── types.ts
│   │   ├── stores/                 # Zustand stores (if needed)
│   │   ├── styles/
│   │   │   ├── globals.css
│   │   │   └── tailwind.config.ts
│   │   └── worker/
│   │       └── sw.ts               # Service Worker (offline cache)
│   ├── public/
│   │   ├── icons/
│   │   └── manifest.json
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── database/
│   ├── migrations/
│   │   ├── 000_initial_schema.sql
│   │   ├── 001_search_indexes.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_triggers_audit.sql
│   │   └── 004_seed_data.sql
│   ├── functions/
│   │   ├── search_person.sql
│   │   ├── get_hospital_stats.sql
│   │   └── get_dashboard_stats.sql
│   └── seed/
│       └── sample_data.sql
│
├── supabase/
│   ├── functions/                  # Edge Functions
│   │   ├── ocr-process/
│   │   ├── detect-duplicates/
│   │   ├── normalize-names/
│   │   ├── compare-lists/
│   │   └── rate-limiter/
│   └── config.toml
│
├── docs/
│   ├── 01-arquitectura.md
│   ├── 02-base-de-datos.md
│   ├── 03-api.md
│   ├── 04-seguridad.md
│   └── 05-roadmap.md
│
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── test.yml
│
├── .env.example
├── .gitignore
├── vercel.json
├── package.json (root)
└── README.md
```

## 3. Flujo del Usuario (Visitante)

```
Inicio
  │
  ├──> Buscar Persona
  │      │
  │      ├──> Ingresa nombre y apellido
  │      ├──> Sistema busca en persons + vistas materializadas
  │      │
  │      ├──> [Encontrado] ──> Muestra:
  │      │       • Nombre completo
  │      │       • Estado (lesionado, trasladado, fallecido, etc.)
  │      │       • Hospital o Refugio (con mapa)
  │      │       • Fecha y hora de última actualización
  │      │       • Fuente (hospital, listas oficiales, etc.)
  │      │       • Nivel de confianza (Alto, Medio, Bajo)
  │      │       • Observaciones
  │      │       • Reportar error (enlace)
  │      │
  │      └──> [No encontrado] ──> Muestra:
  │              "No se encontró información en las fuentes
  │               verificadas disponibles hasta este momento."
  │              • Fecha y hora de la consulta
  │              • Botón: "Reportar información de esta persona"
  │
  ├──> Hospitales ──> Lista con:
  │      • Nombre, dirección, estado
  │      • Ocupación (porcentaje)
  │      • Necesidades prioritarias
  │      • Contacto
  │
  ├──> Refugios ──> Lista con:
  │      • Nombre, ubicación
  │      • Personas aproximadas
  │      • Necesidades
  │      • Contacto
  │
  ├──> Centros de Acopio ──> Lista con:
  │      • Nombre, ubicación (mapa)
  │      • Horario
  │      • Qué reciben / qué NO necesitan
  │
  ├──> Necesidades ──> Tablero con:
  │      • Prioridad (Crítico, Alto, Medio, Bajo)
  │      • Artículo, cantidad requerida, recibida, %
  │
  └──> Reportar Error ──> Formulario:
         • Tipo de reporte
         • Descripción
         • Captura opcional
         • Siempre pendiente de revisión
```

## 4. Flujo del Voluntario

```
Login (OTP / Magic Link)
  │
  ├──> Dashboard Voluntario
  │      • Mis últimas actualizaciones
  │      • Cambios pendientes de aprobación
  │
  ├──> Actualizar Persona
  │      • Buscar persona existente
  │      • Actualizar: estado, ubicación, observaciones
  │      • Subir soporte (imagen, PDF)
  │      → Queda en estado "pending_review"
  │
  ├──> Cargar Lista
  │      • Subir archivo (CSV, PDF, imagen)
  │      • IA procesa (OCR + extracción)
  │      • Voluntario revisa y confirma
  │      → Queda en estado "pending_review"
  │
  ├──> Actualizar Necesidades
  │      • Seleccionar hospital / refugio
  │      • Modificar cantidades
  │      → Queda en estado "pending_review"
  │
  └──> Reportes Asignados
         • Revisar reportes de ciudadanos
         • Marcar como "verificado" o "rechazar"
         → Si verifica, se genera actualización pendiente
```

## 5. Flujo del Administrador

```
Login (OTP + rol admin)
  │
  ├──> Dashboard
  │      • Cards: Pendientes, Usuarios, Hospitales, Refugios
  │      • Gráfica de actividad (últimas 24h / 7 días)
  │      • Alertas (duplicados, cambios sospechosos)
  │
  ├──> Cambios Pendientes
  │      • Lista priorizada (más recientes primero)
  │      • Ver detalle: antes / después
  │      • Ver archivo adjunto
  │      • Aprobar / Rechazar (con motivo)
  │
  ├──> Gestión de Usuarios
  │      • Lista de voluntarios
  │      • Activar / desactivar
  │      • Cambiar rol (volunteer → admin)
  │      • Ver historial de actividad
  │
  ├──> Hospitales / Refugios / Centros
  │      • CRUD completo
  │      • Activar / desactivar
  │      • Asignar voluntarios
  │
  ├──> Historial Completo
  │      • Filtros: fecha, usuario, tipo, entidad
  │      • Exportar (CSV)
  │
  └──> Logs del Sistema
         • Auditoría completa
         • Errores de IA
         • Intentos de acceso no autorizado
         • Rate limiting alerts
```

## 18. Buenas Prácticas — Privacidad y Mínima Exposición de Datos

### Principios

1. **Datos mínimos**: Solo almacenamos nombre, estado, y ubicación. NO almacenamos: CURP, fecha de nacimiento, domicilio particular, teléfono, ni relación con reportante.

2. **Separación de datos**: La persona reportante NUNCA queda vinculada a la persona buscada. No hay tabla "familiares".

3. **Exposición controlada**: Los resultados de búsqueda solo muestran nombre + estado + ubicación institucional (hospital/refugio). No se muestran datos de contacto de la persona.

4. **Ofuscación de resultados**: Si el nombre coincide parcialmente, se muestra una lista sin revelar cuántos registros existen ni datos sensibles adicionales.

5. **Temporalidad**: Los datos de personas localizadas pueden ser marcados para eliminación automática después de 30 días del cierre de la emergencia.

6. **Consentimiento implícito**: Todos los registros deben tener una fuente verificable (hospital, autoridad). No se aceptan reportes anónimos como fuente única.

7. **No indexación**: La página debe incluir `<meta name="robots" content="noindex">` y headers `X-Robots-Tag: noindex` para evitar que los datos personales aparezcan en buscadores.

8. **HTTPS obligatorio**: Toda comunicación viaja por TLS 1.3.

9. **Logs sin datos personales**: Los audit_logs registran qué se modificó, pero no almacenan el valor anterior/posterior de nombres completos en texto plano en los logs.

10. **Cifrado en reposo**: Supabase cifra datos en reposo por defecto. Verificar que esté habilitado.

11. **Eliminación segura**: Cuando se elimina un registro, se hace soft-delete (deleted_at). La purga real ocurre después de 90 días.

12. **API key rotación**: Las service keys se rotan cada 30 días. Nunca se exponen en client-side.
