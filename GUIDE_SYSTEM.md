# FARO — Guide System (Centro de Recursos)

Documentación del módulo de recursos para emergencias.  
Fecha: 2 de julio de 2026.

---

## 1. Visión

La pestaña **Recursos** (antes "Guía") es el **Centro de Recursos** de FARO: un hub operativo donde cualquier ciudadano encuentra información crítica en segundos, organizada por módulos independientes y diseñada para consulta bajo estrés.

No es una página de texto. Es una experiencia tipo Apple: cards grandes, jerarquía clara, microanimaciones y acciones directas (llamar, copiar, marcar checklist).

---

## 2. Arquitectura implementada

```
src/
├── domain/guide-models.ts          # Tipos del dominio
├── data/guide/                     # Contenido editable (sin UI)
│   ├── emergency-contacts.ts
│   ├── protocols.ts
│   ├── emergency-kit.ts
│   ├── official-resources.ts
│   ├── faq.ts
│   ├── faro-about.ts
│   └── index.ts
├── lib/guide-storage.ts            # Persistencia local (kit + feedback)
├── repositories/guide-repository.ts
├── services/guide-service.ts
├── hooks/useGuideResources.ts
├── components/guide/
│   ├── resources-hub.tsx           # Orquestador principal
│   ├── shared/                     # ResourceSection, ResourceCard, ModuleNav
│   ├── emergency-contacts/
│   ├── protocols/
│   ├── checklists/
│   ├── official/
│   ├── verified/
│   ├── faq/
│   ├── app-status/
│   ├── about/
│   └── contact/
└── screens/activity-screen.tsx     # Shell del Centro de Recursos
```

### Flujo de datos

```
data/guide/*.ts
      ↓
guideRepository (lectura + feedback local)
      ↓
guideService (+ merge eventos verificados en vivo)
      ↓
useGuideResources / useEmergencyKitChecklist
      ↓
ResourcesHub → secciones modulares
```

**Regla:** ningún componente importa datos directamente. Todo pasa por repository/service.

---

## 3. Módulos implementados

| # | Módulo | ID anchor | Descripción |
|---|--------|-----------|-------------|
| 1 | Emergencia inmediata | `guide-emergency` | Teléfonos con Llamar / Copiar |
| 2 | Qué hacer | `guide-protocols` | Protocolos BLUF (10 escenarios) |
| 3 | Mochila de emergencia | `guide-kit` | Checklist interactivo + localStorage |
| 4 | Recursos oficiales | `guide-official` | Instituciones con detalle |
| 5 | Información verificada | `guide-verified` | Comunicados + eventos FARO en vivo |
| 6 | FAQ | `guide-faq` | Accordion elegante |
| 7 | Estado de la app | `guide-status` | Versión, sync, offline |
| 8 | Ayuda sobre FARO | `guide-about` | Qué es, cómo colaborar |
| 9 | Contactar equipo | `guide-contact` | Formulario (localStorage) |

Navegación rápida: chips horizontales (`ModuleNav`) hacen scroll suave al módulo.

---

## 4. Componentes creados

### Shared
- `ResourceSection` — wrapper con `SectionTitle` y anchor ID
- `ResourceCard` — card táctil reutilizable con icono, título, chevron
- `ModuleNav` — chips de navegación horizontal

### Por módulo
- `EmergencyContactCard` / `EmergencyContactsSection`
- `ProtocolLibrarySection` / `ProtocolDetail` (formato BLUF)
- `EmergencyKitSection` (progress bar + toggle)
- `OfficialResourcesSection` / `OfficialResourceDetail`
- `VerifiedInfoSection` (sello verificado + timestamp)
- `FaqSection` (accordion animado)
- `AppStatusSection`
- `FaroAboutSection`
- `ContactFormSection`

### Orquestador
- `ResourcesHub` — estado de navegación, detalle de protocolo/recurso, integración con FARO context

---

## 5. Organización de la información

### Protocolos BLUF

Cada protocolo en `data/guide/protocols.ts` sigue:

```typescript
{
  id: 'earthquake',
  title: 'Terremoto',
  icon: '🌎',
  summary: '...',
  bluf: {
    doImmediately: string[]   // Qué hacer YA
    doNot: string[]           // Qué NO hacer
    additionalTips: string[]  // Consejos extra
  }
}
```

### Teléfonos de emergencia

Centralizados en `data/guide/emergency-contacts.ts`:

```typescript
{
  id: '911',
  name: 'Emergencias 911',
  description: '...',
  phone: '911',
  icon: '☎️',
  priority: 1,  // orden de visualización
}
```

### Información verificada

Combina dos fuentes:
1. **Seed estático** — `VERIFIED_SEED_ANNOUNCEMENTS` en `faro-about.ts`
2. **Eventos en vivo** — `guideService.getVerifiedAnnouncements(events)` transforma eventos operativos del timeline FARO

Solo comunicados con sello "Verificado". Alineado con la misión anti-desinformación.

### Checklist mochila

Estado en `localStorage` (`faro.emergency-kit.v1`) vía `useEmergencyKitChecklist`.

### Feedback al equipo

Guardado local en `faro.guide-feedback.v1`. Listo para conectar a Supabase Edge Function en el futuro.

---

## 6. Cómo agregar un nuevo protocolo

1. Abrir `src/data/guide/protocols.ts`
2. Agregar objeto al array `EMERGENCY_PROTOCOLS`:

```typescript
{
  id: 'landslide',
  title: 'Deslizamiento',
  icon: '⛰',
  summary: 'Alejarse de laderas inestables.',
  bluf: {
    doImmediately: ['...'],
    doNot: ['...'],
    additionalTips: ['...'],
  },
},
```

3. No tocar componentes. Aparece automáticamente en "Qué hacer".

---

## 7. Cómo agregar un nuevo teléfono de emergencia

1. Abrir `src/data/guide/emergency-contacts.ts`
2. Agregar entrada con `priority` único (menor = más arriba):

```typescript
{
  id: 'gas-emergency',
  name: 'Fuga de gas',
  description: 'Reportar olor a gas en vía pública',
  phone: '0800-GAS',
  icon: '🔥',
  priority: 8,
},
```

---

## 8. Cómo internacionalizar (futuro)

La arquitectura está preparada para i18n:

1. **Mover datos a locale files:**
   ```
   src/data/guide/locales/es/emergency-contacts.ts
   src/data/guide/locales/en/emergency-contacts.ts
   ```

2. **Inyectar locale en repository:**
   ```typescript
   getEmergencyContacts(locale: string): EmergencyContact[]
   ```

3. **Usar claves semánticas** en lugar de texto embebido en IDs (`id: 'earthquake'` se mantiene; `title` viene del locale).

4. **Números de emergencia por región:** separar `EMERGENCY_CONTACTS_VE`, `EMERGENCY_CONTACTS_CO`, etc., seleccionados por `profile.organization_id` o geolocalización.

5. **RTL / accesibilidad:** los componentes ya usan tokens del Design System; solo traducir strings en data layer.

---

## 9. Escalabilidad futura

El hub está diseñado para agregar módulos sin reescribir la pantalla:

| Feature futuro | Cómo integrarlo |
|----------------|-----------------|
| Alertas oficiales | Nuevo módulo + `data/guide/alerts.ts` + feed Supabase |
| Noticias verificadas | Extender `VerifiedInfoSection` con tabla `verified_announcements` |
| Guías PDF | `ResourceCard` con link + cache PWA |
| Videos educativos | Modal con `<video>` o embed |
| Mapas de evacuación | Layer en MapCanvas + enlace desde protocolos |
| Refugios temporales | Query a `shelters` filtrados |
| Cursos | Módulo + progreso en localStorage |
| Contenido offline | Precache de `data/guide/*` en service worker |

Agregar un módulo:
1. Crear sección en `components/guide/<modulo>/`
2. Agregar entrada en `GUIDE_MODULES` (`data/guide/index.ts`)
3. Agregar anchor en `MODULE_ANCHOR` (`resources-hub.tsx`)
4. Renderizar en `ResourcesHub`

---

## 10. Cambios en navegación

- Tab label: **Guía → Recursos**
- Icono: `BookOpen` (ciudadanos y coordinadores)
- Tab ID interno: `activity` (sin breaking change en rutas)

---

## 11. Checklist de validación

- [ ] Tab "Recursos" visible en navegación inferior y rail desktop
- [ ] Chips de módulos hacen scroll suave a cada sección
- [ ] Botón "Llamar" abre dialer (`tel:`)
- [ ] Botón "Copiar" copia número y muestra toast
- [ ] Protocolo abre ficha BLUF con volver atrás
- [ ] Checklist persiste al recargar página
- [ ] Recurso oficial abre detalle con web/teléfonos
- [ ] Información verificada muestra eventos del timeline
- [ ] FAQ accordion abre/cierra con animación
- [ ] Estado muestra versión, sync y modo offline
- [ ] Formulario de contacto guarda y muestra confirmación
- [ ] Build production sin errores TypeScript

---

## 12. Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `src/screens/activity-screen.tsx` | Reemplazado por Centro de Recursos |
| `src/components/faro/app-navigation.tsx` | Label + icono Recursos |
| `src/components/guide/**` | **NUEVO** — 20+ componentes |
| `src/data/guide/**` | **NUEVO** — contenido centralizado |
| `src/domain/guide-models.ts` | **NUEVO** — tipos |
| `src/repositories/guide-repository.ts` | **NUEVO** |
| `src/services/guide-service.ts` | **NUEVO** |
| `src/hooks/useGuideResources.ts` | **NUEVO** |
| `src/lib/guide-storage.ts` | **NUEVO** |

El legacy `src/data/guide-library.ts` se mantiene por compatibilidad con `faro-context` pero ya no alimenta la pantalla principal.
