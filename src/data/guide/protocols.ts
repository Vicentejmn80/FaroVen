import type { EmergencyProtocol } from '@/domain/guide-models'

/** Protocolos BLUF — qué hacer inmediatamente, qué evitar, consejos. */
export const EMERGENCY_PROTOCOLS: EmergencyProtocol[] = [
  {
    id: 'earthquake',
    title: 'Terremoto',
    icon: '🌎',
    summary: 'Protege tu cabeza y busca refugio estructural.',
    bluf: {
      doImmediately: [
        'Agáchate, cúbrete y agárrate bajo una mesa sólida o marco de puerta.',
        'Aléjate de ventanas, espejos y objetos que puedan caer.',
        'Si estás afuera, aléjate de edificios, postes y cables.',
        'Tras el temblor, evacúa con calma si hay daños visibles.',
      ],
      doNot: [
        'No uses ascensores durante ni después del sismo.',
        'No corras hacia salidas estrechas en pánico.',
        'No enciendas fuego si hueles gas.',
      ],
      additionalTips: [
        'Ten una mochila de emergencia accesible.',
        'Acuerda un punto de reunión familiar.',
        'Reporta derrumbes o personas atrapadas en FARO.',
      ],
    },
  },
  {
    id: 'flood',
    title: 'Inundación',
    icon: '🌧',
    summary: 'Eleva pertenencias y evacúa antes de que suba el agua.',
    bluf: {
      doImmediately: [
        'Sube a un piso alto o zona segura antes de que crezca la corriente.',
        'Desconecta electricidad si el agua aún no ha entrado.',
        'Guarda documentos y medicamentos en bolsas impermeables.',
        'Informa a vecinos vulnerables (adultos mayores, niños).',
      ],
      doNot: [
        'No cruces calles o cauces con corriente — 15 cm pueden derribarte.',
        'No manejes por zonas inundadas.',
        'No bebas agua de lluvia sin hervir.',
      ],
      additionalTips: [
        'Identifica rutas altas hacia refugios en el mapa FARO.',
        'Fotografía daños solo cuando estés seguro.',
      ],
    },
  },
  {
    id: 'fire',
    title: 'Incendio',
    icon: '🔥',
    summary: 'Evacúa primero; combate solo si es un fuego muy pequeño.',
    bluf: {
      doImmediately: [
        'Activa la alarma y evacúa por la ruta más cercana.',
        'Cierra puertas al salir para frenar la propagación.',
        'Si hay humo, gatea cerca del suelo donde hay más oxígeno.',
        'Llama a bomberos en cuanto estés a salvo.',
      ],
      doNot: [
        'No abras puertas calientes al tacto.',
        'No uses ascensores.',
        'No regreses por pertenencias.',
      ],
      additionalTips: [
        'Practica rutas de escape con tu familia.',
        'Revisa detectores de humo cada 6 meses.',
      ],
    },
  },
  {
    id: 'collapse',
    title: 'Derrumbe',
    icon: '🏠',
    summary: 'Protege vías respiratorias y señala tu ubicación.',
    bluf: {
      doImmediately: [
        'Cúbrete la boca con tela húmeda si hay polvo.',
        'Golpea tuberías o paredes en ritmo para señalar ubicación.',
        'Conserva energía y evita mover escombros pesados.',
        'Usa el teléfono con moderación para preservar batería.',
      ],
      doNot: [
        'No enciendas fósforos ni fuego si hay olor a gas.',
        'No grites continuamente — alterna señales y silencio.',
      ],
      additionalTips: [
        'Reporta la ubicación exacta en FARO para coordinar rescate.',
      ],
    },
  },
  {
    id: 'blackout',
    title: 'Apagón',
    icon: '⚡',
    summary: 'Prioriza seguridad, alimentos perecederos y comunicación.',
    bluf: {
      doImmediately: [
        'Usa linterna; evita velas cerca de cortinas.',
        'Desconecta equipos sensibles para evitar picos al volver la luz.',
        'Mantén refrigerador cerrado la mayor parte posible.',
        'Carga dispositivos con power bank mientras haya batería.',
      ],
      doNot: [
        'No operes generadores en espacios cerrados.',
        'No abras la nevera repetidamente.',
      ],
      additionalTips: [
        'Consulta centros operativos en el mapa FARO.',
        'Reporta fallas eléctricas que afecten hospitales o refugios.',
      ],
    },
  },
  {
    id: 'first-aid',
    title: 'Primeros auxilios',
    icon: '🩹',
    summary: 'Estabiliza, no cures — busca ayuda profesional.',
    bluf: {
      doImmediately: [
        'Evalúa seguridad de la escena antes de acercarte.',
        'Controla hemorragias con presión directa continua.',
        'Mantén vía aérea despejada en personas inconscientes.',
        'Llama o pide que llamen a emergencias.',
      ],
      doNot: [
        'No muevas a alguien con posible lesión de columna.',
        'No retires objetos clavados profundos.',
        'No des medicamentos sin conocimiento médico.',
      ],
      additionalTips: [
        'Un curso básico de RCP puede salvar vidas.',
        'Identifica el hospital más cercano en FARO.',
      ],
    },
  },
  {
    id: 'contaminated-water',
    title: 'Agua contaminada',
    icon: '💧',
    summary: 'Hervir, filtrar o usar pastillas antes de consumir.',
    bluf: {
      doImmediately: [
        'Hierve agua al menos 1 minuto antes de beber o cocinar.',
        'Usa envases limpios y cerrados para almacenar.',
        'Prioriza agua embotellada sellada si está disponible.',
        'Lava manos con agua tratada frecuentemente.',
      ],
      doNot: [
        'No bebas agua de lluvia sin tratar.',
        'No uses hielo de origen desconocido.',
      ],
      additionalTips: [
        'Localiza centros de acopio con agua potable en FARO.',
      ],
    },
  },
  {
    id: 'infants',
    title: 'Atención a bebés',
    icon: '👶',
    summary: 'Hidratación, temperatura y contacto seguro.',
    bluf: {
      doImmediately: [
        'Mantén al bebé abrigado pero sin sobrecalentar.',
        'Continúa lactancia o fórmula preparada con agua segura.',
        'Vigila signos de deshidratación (pañal seco, llanto débil).',
        'Busca refugio con condiciones estables.',
      ],
      doNot: [
        'No administres medicamentos sin indicación pediátrica.',
        'No dejes al bebé solo en vehículos o espacios cerrados.',
      ],
      additionalTips: [
        'Ten copias de carnet de vacunación en la mochila.',
      ],
    },
  },
  {
    id: 'elderly',
    title: 'Adultos mayores',
    icon: '👴',
    summary: 'Medicamentos, movilidad y acompañamiento.',
    bluf: {
      doImmediately: [
        'Asegura stock de medicamentos crónicos (mínimo 7 días).',
        'Facilita acceso a silla de ruedas o bastón si aplica.',
        'Mantén contacto frecuente con familiares o vecinos.',
        'Identifica refugios accesibles en el mapa.',
      ],
      doNot: [
        'No abandones medicación de presión, diabetes o corazón.',
        'No fuerces traslados sin evaluar movilidad.',
      ],
      additionalTips: [
        'Registra condiciones médicas en documento físico y digital.',
      ],
    },
  },
  {
    id: 'pets',
    title: 'Mascotas en emergencias',
    icon: '🐶',
    summary: 'Correa, agua, identificación y refugio pet-friendly.',
    bluf: {
      doImmediately: [
        'Mantén correa, arnés y transportadora accesibles.',
        'Lleva agua, comida y vacunas al evacuar.',
        'Identifica refugios que acepten mascotas en FARO.',
        'Actualiza microchip o placa con teléfono de contacto.',
      ],
      doNot: [
        'No sueltes mascotas en pánico — pueden perderse.',
        'No dejes comida expuesta que atraiga plagas.',
      ],
      additionalTips: [
        'Fotografía reciente ayuda si se pierden.',
      ],
    },
  },
]
