import { SATURATION_NEED_PRESETS } from '@/lib/saturation-needs'

export type NeedCategoryKey = (typeof SATURATION_NEED_PRESETS)[number]['key']

export const NEED_CATEGORIES = SATURATION_NEED_PRESETS

export const NEED_CATEGORY_ICONS: Partial<Record<NeedCategoryKey, string>> = {
  agua: '💧',
  alimentos: '🍞',
  medicamentos: '💊',
  'atencion-medica': '🏥',
  refugio: '🏠',
  ropa: '🧥',
  higiene: '🧼',
  panales: '👶',
  'apoyo-psicologico': '🧠',
  transporte: '🚌',
  energia: '⚡',
  comunicacion: '📡',
  herramientas: '🔧',
  voluntarios: '🤝',
  otros: '📦',
}

export const NEED_ITEM_PRESETS: Partial<Record<NeedCategoryKey, readonly string[]>> = {
  agua: ['Agua'],
  alimentos: ['Alimentos (general)', 'Harina', 'Arroz', 'Aceite', 'Pasta', 'Leche', 'Leche infantil'],
  medicamentos: [
    'Medicamentos (general)',
    'Paracetamol',
    'Ibuprofeno',
    'Insulina',
    'Loratadina',
    'Guantes',
    'Jeringas',
    'Gasas',
    'Suero',
  ],
  'atencion-medica': ['Médicos', 'Enfermeros'],
  refugio: ['Colchones', 'Cobijas', 'Camas'],
  ropa: ['Cobijas'],
  higiene: ['Pañales'],
  panales: ['Pañales'],
  'apoyo-psicologico': [
    'Psicólogos',
    'Trabajadores Sociales',
    'Psicólogo clínico',
    'Psicólogo infantil',
    'Primeros auxilios psicológicos',
  ],
  energia: ['Linternas', 'Baterías'],
  herramientas: ['Palas', 'Picos', 'Martillos', 'Herramientas (general)'],
  voluntarios: ['Personal disponible', 'Médicos', 'Enfermeros', 'Trabajadores Sociales'],
}

const PSYCHOLOGICAL_KEYWORDS = [
  'psicolog',
  'psiquiatr',
  'salud mental',
  'apoyo emocional',
  'apoyo psicol',
  'terapia grupal',
  'consejer',
  'primeros auxilios psicol',
  'espacio seguro',
  'atención a crisis',
  'atencion a crisis',
]

const CATEGORY_LABEL_BY_KEY = Object.fromEntries(
  NEED_CATEGORIES.map((category) => [category.key, category.label]),
) as Record<NeedCategoryKey, string>

export function getNeedCategoryLabel(key: NeedCategoryKey): string {
  return CATEGORY_LABEL_BY_KEY[key] ?? key
}

export function getNeedIcon(itemName: string): string {
  const lower = itemName.toLowerCase()
  if (PSYCHOLOGICAL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return NEED_CATEGORY_ICONS['apoyo-psicologico'] ?? '🧠'
  }
  for (const category of NEED_CATEGORIES) {
    if (lower.includes(category.label.toLowerCase())) {
      return NEED_CATEGORY_ICONS[category.key] ?? '📦'
    }
  }
  return '📦'
}

export function resolveNeedItemName(
  categoryKey: NeedCategoryKey,
  presetItem: string,
  customLabel: string,
): string {
  // Solo "otros" permite etiqueta libre; el resto debe venir del catálogo.
  if (categoryKey === 'otros') {
    return customLabel.trim()
  }
  const presets = NEED_ITEM_PRESETS[categoryKey]
  if (presets?.length) {
    if (presetItem && presets.includes(presetItem)) return presetItem
    return presets[0]
  }
  return getNeedCategoryLabel(categoryKey)
}

export function qtyPlaceholderForCategory(categoryKey: NeedCategoryKey, itemName: string): string {
  if (categoryKey === 'apoyo-psicologico') {
    const lower = itemName.toLowerCase()
    if (lower.includes('sesion') || lower.includes('terapia')) return 'Ej. 10 sesiones'
    if (lower.includes('voluntario') || lower.includes('espacio')) return 'Ej. 5'
    return 'Ej. 3 especialistas'
  }
  return 'Ej. 50'
}
