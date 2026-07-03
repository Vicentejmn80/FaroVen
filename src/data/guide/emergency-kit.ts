import type { EmergencyKitItem } from '@/domain/guide-models'

export const EMERGENCY_KIT_ITEMS: EmergencyKitItem[] = [
  { id: 'water', label: 'Agua potable', hint: '4 L por persona / día', essential: true },
  { id: 'flashlight', label: 'Linterna', hint: 'Con pilas extra', essential: true },
  { id: 'meds', label: 'Medicamentos', hint: 'Prescripción + básicos', essential: true },
  { id: 'radio', label: 'Radio a pilas', hint: 'Noticias oficiales', essential: false },
  { id: 'batteries', label: 'Pilas', essential: true },
  { id: 'powerbank', label: 'Power bank', essential: true },
  { id: 'documents', label: 'Documentos', hint: 'Cédula, pasaporte, pólizas', essential: true },
  { id: 'food', label: 'Comida no perecedera', hint: '3 días mínimo', essential: true },
  { id: 'whistle', label: 'Silbato', hint: 'Señal de auxilio', essential: false },
  { id: 'clothes', label: 'Ropa y calzado', hint: 'Abrigo y repuesto', essential: true },
  { id: 'first-aid-kit', label: 'Botiquín', essential: true },
  { id: 'cash', label: 'Efectivo', hint: 'Pequeñas denominaciones', essential: false },
  { id: 'hygiene', label: 'Higiene personal', essential: false },
  { id: 'mask', label: 'Mascarillas', essential: false },
]
