import type { OfficialResource } from '@/domain/guide-models'

export const OFFICIAL_RESOURCES: OfficialResource[] = [
  {
    id: 'civil-protection',
    name: 'Protección Civil',
    description: 'Coordinación nacional de emergencias, refugios y evaluación de riesgos.',
    icon: '🛟',
    website: 'https://www.inpc.gob.ve',
    phones: ['0800-PCIVIL'],
    social: [{ label: 'Instagram', url: 'https://instagram.com/inpc_ve' }],
  },
  {
    id: 'firefighters',
    name: 'Cuerpo de Bomberos',
    description: 'Incendios, rescates urbanos y prevención.',
    icon: '🚒',
    phones: ['171', '911'],
  },
  {
    id: 'red-cross',
    name: 'Cruz Roja Venezolana',
    description: 'Asistencia humanitaria, primeros auxilios y apoyo comunitario.',
    icon: '➕',
    website: 'https://www.cruzrojavenezolana.org.ve',
    phones: ['0212-408-0404'],
    social: [{ label: 'Web', url: 'https://www.cruzrojavenezolana.org.ve' }],
  },
  {
    id: 'health-ministry',
    name: 'Ministerio de Salud',
    description: 'Políticas sanitarias, epidemiología y orientación médica pública.',
    icon: '🏥',
    website: 'https://www.mpps.gob.ve',
  },
  {
    id: 'inameh',
    name: 'INAMEH',
    description: 'Instituto Nacional de Meteorología e Hidrología — alertas climáticas.',
    icon: '🌦',
    website: 'https://www.inameh.gob.ve',
    social: [
      { label: 'Twitter/X', url: 'https://twitter.com/inameh' },
    ],
  },
  {
    id: 'civil-defense',
    name: 'Defensa Civil',
    description: 'Apoyo en desastres, evacuaciones y protección comunitaria.',
    icon: '🛡',
    phones: ['911'],
  },
  {
    id: 'governorates',
    name: 'Gobernaciones',
    description: 'Coordinación regional de emergencias y refugios locales.',
    icon: '🏛',
    website: 'https://www.gobiernoenlinea.gob.ve',
  },
]
