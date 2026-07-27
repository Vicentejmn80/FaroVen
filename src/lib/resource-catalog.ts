/**
 * Catálogo central de recursos del Nodo Logístico.
 * El coordinador SOLO selecciona de aquí — nunca nombres libres.
 * Claves estables usadas en center_resources.resource_type.
 */

export type ResourceCategory =
  | 'alimentos'
  | 'nutricion_infantil'
  | 'medicamentos'
  | 'material_medico'
  | 'logistica'
  | 'herramientas'
  | 'apoyo'

export interface ResourceCatalogItem {
  key: string
  label: string
  category: ResourceCategory
  unit: string
  /** Mínimo recomendado para sugerir necesidad */
  minRecommended: number
}

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  alimentos: 'Alimentos',
  nutricion_infantil: 'Nutrición infantil',
  medicamentos: 'Medicamentos',
  material_medico: 'Material médico',
  logistica: 'Logística',
  herramientas: 'Herramientas',
  apoyo: 'Apoyo',
}

export const RESOURCE_CATALOG: readonly ResourceCatalogItem[] = [
  // Alimentos
  { key: 'agua', label: 'Agua', category: 'alimentos', unit: 'unidades', minRecommended: 30 },
  { key: 'harina', label: 'Harina', category: 'alimentos', unit: 'unidades', minRecommended: 20 },
  { key: 'arroz', label: 'Arroz', category: 'alimentos', unit: 'unidades', minRecommended: 20 },
  { key: 'aceite', label: 'Aceite', category: 'alimentos', unit: 'unidades', minRecommended: 15 },
  { key: 'pasta', label: 'Pasta', category: 'alimentos', unit: 'unidades', minRecommended: 20 },
  { key: 'leche', label: 'Leche', category: 'alimentos', unit: 'unidades', minRecommended: 20 },
  { key: 'alimentos', label: 'Alimentos (general)', category: 'alimentos', unit: 'raciones', minRecommended: 40 },

  // Nutrición infantil
  { key: 'leche_infantil', label: 'Leche infantil', category: 'nutricion_infantil', unit: 'unidades', minRecommended: 15 },
  { key: 'panales', label: 'Pañales', category: 'nutricion_infantil', unit: 'unidades', minRecommended: 20 },

  // Medicamentos
  { key: 'medicamentos', label: 'Medicamentos (general)', category: 'medicamentos', unit: 'unidades', minRecommended: 20 },
  { key: 'paracetamol', label: 'Paracetamol', category: 'medicamentos', unit: 'unidades', minRecommended: 20 },
  { key: 'ibuprofeno', label: 'Ibuprofeno', category: 'medicamentos', unit: 'unidades', minRecommended: 15 },
  { key: 'insulina', label: 'Insulina', category: 'medicamentos', unit: 'unidades', minRecommended: 10 },
  { key: 'loratadina', label: 'Loratadina', category: 'medicamentos', unit: 'unidades', minRecommended: 15 },

  // Material médico
  { key: 'guantes', label: 'Guantes', category: 'material_medico', unit: 'unidades', minRecommended: 50 },
  { key: 'jeringas', label: 'Jeringas', category: 'material_medico', unit: 'unidades', minRecommended: 30 },
  { key: 'gasas', label: 'Gasas', category: 'material_medico', unit: 'unidades', minRecommended: 40 },
  { key: 'suero', label: 'Suero', category: 'material_medico', unit: 'unidades', minRecommended: 20 },

  // Logística
  { key: 'colchones', label: 'Colchones', category: 'logistica', unit: 'unidades', minRecommended: 10 },
  { key: 'cobijas', label: 'Cobijas', category: 'logistica', unit: 'unidades', minRecommended: 15 },
  { key: 'linternas', label: 'Linternas', category: 'logistica', unit: 'unidades', minRecommended: 10 },
  { key: 'baterias', label: 'Baterías', category: 'logistica', unit: 'unidades', minRecommended: 20 },
  { key: 'beds', label: 'Camas', category: 'logistica', unit: 'camas', minRecommended: 5 },

  // Herramientas
  { key: 'palas', label: 'Palas', category: 'herramientas', unit: 'unidades', minRecommended: 5 },
  { key: 'picos', label: 'Picos', category: 'herramientas', unit: 'unidades', minRecommended: 5 },
  { key: 'martillos', label: 'Martillos', category: 'herramientas', unit: 'unidades', minRecommended: 5 },
  { key: 'herramientas', label: 'Herramientas (general)', category: 'herramientas', unit: 'unidades', minRecommended: 10 },

  // Apoyo humano
  { key: 'psicologos', label: 'Psicólogos', category: 'apoyo', unit: 'personas', minRecommended: 2 },
  { key: 'trabajadores_sociales', label: 'Trabajadores Sociales', category: 'apoyo', unit: 'personas', minRecommended: 2 },
  { key: 'medicos', label: 'Médicos', category: 'apoyo', unit: 'personas', minRecommended: 2 },
  { key: 'enfermeros', label: 'Enfermeros', category: 'apoyo', unit: 'personas', minRecommended: 3 },
  { key: 'personnel', label: 'Personal disponible', category: 'apoyo', unit: 'personas', minRecommended: 5 },

  // Legacy aliases kept for existing rows
  { key: 'water', label: 'Agua', category: 'alimentos', unit: 'litros', minRecommended: 30 },
  { key: 'medicine', label: 'Medicinas', category: 'medicamentos', unit: 'unidades', minRecommended: 20 },
  { key: 'food', label: 'Alimentos', category: 'alimentos', unit: 'raciones', minRecommended: 40 },
] as const

const BY_KEY = new Map(RESOURCE_CATALOG.map((item) => [item.key, item]))

export function getResourceCatalogItem(key: string): ResourceCatalogItem | undefined {
  return BY_KEY.get(key)
}

export function getResourceLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key
}

export function getResourceUnit(key: string): string {
  return BY_KEY.get(key)?.unit ?? 'unidades'
}

export function getResourceMinRecommended(key: string): number {
  return BY_KEY.get(key)?.minRecommended ?? 10
}

/** Items seleccionables (oculta aliases legacy duplicados en el picker). */
export const SELECTABLE_RESOURCE_KEYS = new Set([
  'agua',
  'harina',
  'arroz',
  'aceite',
  'pasta',
  'leche',
  'alimentos',
  'leche_infantil',
  'panales',
  'medicamentos',
  'paracetamol',
  'ibuprofeno',
  'insulina',
  'loratadina',
  'guantes',
  'jeringas',
  'gasas',
  'suero',
  'colchones',
  'cobijas',
  'linternas',
  'baterias',
  'beds',
  'palas',
  'picos',
  'martillos',
  'herramientas',
  'psicologos',
  'trabajadores_sociales',
  'medicos',
  'enfermeros',
  'personnel',
])

export function listSelectableResources(): ResourceCatalogItem[] {
  return RESOURCE_CATALOG.filter((item) => SELECTABLE_RESOURCE_KEYS.has(item.key))
}

export function groupSelectableByCategory(): Array<{
  category: ResourceCategory
  label: string
  items: ResourceCatalogItem[]
}> {
  const groups = new Map<ResourceCategory, ResourceCatalogItem[]>()
  for (const item of listSelectableResources()) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }
  return (Object.keys(RESOURCE_CATEGORY_LABELS) as ResourceCategory[]).map((category) => ({
    category,
    label: RESOURCE_CATEGORY_LABELS[category],
    items: groups.get(category) ?? [],
  }))
}

/** Resuelve clave de catálogo desde texto libre (categoría del caso). */
export function resolveCatalogKey(input?: string | null): string | null {
  if (!input?.trim()) return null
  const n = input.trim().toLowerCase()
  const byKey = BY_KEY.get(n)
  if (byKey) return byKey.key
  const byLabel = RESOURCE_CATALOG.find((item) => item.label.toLowerCase() === n)
  if (byLabel) return byLabel.key
  const partial = RESOURCE_CATALOG.find(
    (item) => n.includes(item.label.toLowerCase()) || n.includes(item.key),
  )
  return partial?.key ?? null
}

/** Mapea clave de catálogo → categoría de necesidad FARO (RegisterNeedFlow). */
export function catalogKeyToNeedCategory(key: string): string {
  const item = BY_KEY.get(key)
  if (!item) return 'otros'
  switch (item.category) {
    case 'alimentos':
      return key === 'agua' || key === 'water' ? 'agua' : 'alimentos'
    case 'nutricion_infantil':
      return key === 'panales' ? 'panales' : 'alimentos'
    case 'medicamentos':
      return 'medicamentos'
    case 'material_medico':
      return 'medicamentos'
    case 'logistica':
      return key === 'beds' || key === 'colchones' ? 'refugio' : 'energia'
    case 'herramientas':
      return 'herramientas'
    case 'apoyo':
      if (key === 'psicologos') return 'apoyo-psicologico'
      if (key === 'medicos' || key === 'enfermeros') return 'atencion-medica'
      return 'voluntarios'
    default:
      return 'otros'
  }
}
