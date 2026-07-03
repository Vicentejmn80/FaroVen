import type { FaroAboutBlock, VerifiedAnnouncement } from '@/domain/guide-models'

export const FARO_ABOUT_BLOCKS: FaroAboutBlock[] = [
  {
    id: 'what-is-faro',
    title: 'Qué es FARO',
    body: 'FARO es un sistema operativo para emergencias humanitarias. Conecta ciudadanos, coordinadores y administradores en un mapa vivo de hospitales, refugios y centros de acopio.',
  },
  {
    id: 'how-it-works',
    title: 'Cómo funciona',
    body: 'Los coordinadores actualizan saturación, necesidades e inventario. Los ciudadanos reportan y consultan. Los administradores verifican y asignan responsables.',
  },
  {
    id: 'who-updates',
    title: 'Quién actualiza la información',
    body: 'Coordinadores verificados en cada centro y administradores regionales. Los reportes ciudadanos complementan pero requieren revisión.',
  },
  {
    id: 'map-states',
    title: 'Estados del mapa',
    body: 'Verde: operativo. Amarillo: atención. Rojo: crítico o saturado. Cada punto refleja la última actualización conocida.',
  },
  {
    id: 'collaborate',
    title: 'Cómo colaborar',
    body: 'Reporta información útil, comparte ubicaciones verificadas y evita difundir rumores. Usa solo fuentes oficiales o confirmadas en FARO.',
  },
  {
    id: 'coordinator-path',
    title: 'Convertirse en coordinador',
    body: 'Si representas un hospital, refugio o acopio, solicita acceso desde Perfil. Tras aprobación podrás gestionar tu centro en tiempo real.',
  },
]

/** Comunicados base — se complementan con eventos verificados en vivo. */
export const VERIFIED_SEED_ANNOUNCEMENTS: VerifiedAnnouncement[] = [
  {
    id: 'seed-welcome',
    title: 'FARO en operación',
    body: 'Este módulo muestra únicamente comunicados verificados por coordinadores y administradores. No incluye rumores ni noticias no confirmadas.',
    source: 'Equipo FARO',
    verifiedAt: '2026-07-01T12:00:00Z',
    kind: 'info',
  },
]
