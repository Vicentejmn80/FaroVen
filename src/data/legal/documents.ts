import type { LegalDocument } from '@/domain/legal-models'
import { FARO_LEGAL_META, activeContactEmail, legalEmailLine } from '@/data/legal/faro-legal-meta'

const M = FARO_LEGAL_META

export const LEGAL_VERSIONS = {
  terms: { version: '1.2', updatedAt: '2026-07-14', effectiveAt: '2026-07-14' },
  privacy: { version: '1.2', updatedAt: '2026-07-14', effectiveAt: '2026-07-14' },
  notice: { version: '1.2', updatedAt: '2026-07-14', effectiveAt: '2026-07-14' },
  cookies: { version: '1.0', updatedAt: '2026-07-14', effectiveAt: '2026-07-14' },
} as const

export interface LegalChangelogEntry {
  version: string
  date: string
  title: string
  changes: string[]
}

export const LEGAL_CHANGELOG: LegalChangelogEntry[] = [
  {
    version: '1.2',
    date: '2026-07-14',
    title: 'Refuerzo de protección legal y cookies',
    changes: [
      'Correos institucionales @faro.org como canal oficial de contacto',
      'Eliminación del teléfono como canal de contacto del proyecto',
      'Cláusulas sobre evolución del proyecto, verificación sin garantía, uso bajo propio criterio y fuerza mayor',
      'Política de Cookies publicada',
      'Tres consentimientos explícitos en el registro con registro en base de datos',
    ],
  },
  {
    version: '1.1',
    date: '2026-07-14',
    title: 'Identidad institucional Equipo FARO',
    changes: [
      'Titular unificado como Equipo FARO (fundador solo en Acerca de)',
      'Estados de verificación documentados',
      'Secciones sobre voluntarios, moderación y fotografías sensibles',
    ],
  },
  {
    version: '1.0',
    date: '2026-07-13',
    title: 'Primera publicación',
    changes: [
      'Términos de Servicio, Política de Privacidad y Aviso Legal iniciales',
      'Páginas de Contacto y Acerca de FARO',
    ],
  },
]

export const TERMS_OF_SERVICE: LegalDocument = {
  id: 'terms',
  title: 'Términos de Servicio',
  subtitle: 'Condiciones de uso de la plataforma FARO en Venezuela',
  version: LEGAL_VERSIONS.terms.version,
  updatedAt: LEGAL_VERSIONS.terms.updatedAt,
  effectiveAt: LEGAL_VERSIONS.terms.effectiveAt,
  sections: [
    {
      id: 'identification',
      title: 'Identificación del titular',
      body:
        `${M.projectName} es una ${M.projectNature} administrada por ${M.dataController}, ` +
        `con operación desde ${M.locationLabel}. Sitio web: ${M.platformUrl}. ` +
        `${legalEmailLine('contact', 'Consultas generales')}.`,
    },
    {
      id: 'object',
      title: '1. Objeto de la plataforma',
      body:
        `${M.projectName} es una plataforma de impacto social diseñada para facilitar la coordinación de ` +
        `ayuda humanitaria en Venezuela, conectando a ciudadanos, voluntarios, gestores de casos, coordinadores de ` +
        `centros de acopio y organizaciones mediante el intercambio de información. ${M.projectName} no presta ` +
        `directamente servicios médicos, de seguridad, financieros ni de emergencia: actúa como intermediario ` +
        `tecnológico que permite que las partes interesadas se pongan en contacto entre sí.`,
    },
    {
      id: 'acceptance',
      title: '2. Aceptación de los Términos',
      body:
        'Al acceder y utilizar FARO, declaras que has leído, entendido y aceptado estos Términos de Servicio. Si no ' +
        'estás de acuerdo, debes abstenerse de usar la plataforma. El registro de cuenta operativa requiere: (1) ' +
        'aceptación expresa de estos Términos; (2) confirmación de haber leído la Política de Privacidad; y (3) ' +
        'autorización expresa del tratamiento de datos personales conforme a dicha Política.',
    },
    {
      id: 'registration',
      title: '3. Registro y veracidad de la información',
      body:
        'Te comprometes a proporcionar información veraz, exacta y actualizada al registrarte o al crear reportes, ' +
        'casos o actualizaciones operativas. Eres el único responsable de la información que suministres y de las ' +
        'acciones que realices con tu cuenta. FARO puede suspender o cancelar cuentas que suministren información ' +
        'falsa, engañosa o que infrinja estos Términos.',
    },
    {
      id: 'acceptable-use',
      title: '4. Uso permitido de la plataforma',
      body: 'Debes utilizar FARO únicamente para fines lícitos y en coherencia con su objetivo humanitario.',
      bullets: [
        'Coordinar ayuda, mapear necesidades y conectar recursos con personas u organizaciones.',
        'Publicar reportes útiles, verificables y respetuosos con la dignidad de las personas afectadas.',
        'Colaborar con protocolos oficiales y autoridades competentes cuando corresponda.',
      ],
    },
    {
      id: 'prohibited',
      title: '5. Conductas prohibidas',
      body: 'Queda expresamente prohibido:',
      bullets: [
        'Publicar contenidos que inciten a la violencia, al odio, a la discriminación o a actividades delictivas.',
        'Utilizar la plataforma para fraudes, estafas o cualquier actividad contraria al orden público.',
        'Recopilar información de otros usuarios para fines distintos a la coordinación humanitaria.',
        'Intentar vulnerar la seguridad de la plataforma o acceder sin autorización a sistemas, cuentas o datos ajenos.',
        'Suplantar identidad o usar credenciales de terceros.',
      ],
    },
    {
      id: 'user-content',
      title: '6. Contenidos aportados por los usuarios',
      body:
        'Los reportes, solicitudes de ayuda, ofertas de apoyo, comentarios y demás contenidos generados por los ' +
        'usuarios son de exclusiva responsabilidad de quienes los publican. FARO no garantiza la exactitud, ' +
        'completitud o actualidad de la información aportada por terceros, ni asume la obligación de verificarla ' +
        'de manera previa. No obstante, FARO puede eliminar o bloquear contenidos contrarios a estos Términos, a ' +
        'la ley o a principios básicos de protección de personas en situación de crisis.',
    },
    {
      id: 'verification-states',
      title: 'Estados de verificación de la información',
      body:
        'No toda la información publicada en FARO está verificada al momento de su publicación. Los reportes y casos ' +
        'pueden transitar por los siguientes estados oficiales:',
      bullets: [
        'Reportado: información enviada por un ciudadano u operador, aún sin validación.',
        'En revisión: un coordinador o administrador está evaluando el contenido.',
        'Verificado: la información fue revisada y confirmada por un operador autorizado.',
        'En atención: existe seguimiento activo sobre el caso o necesidad reportada.',
        'Resuelto: el caso fue cerrado o la necesidad dejó de estar activa según criterios operativos.',
      ],
      emphasis: 'info',
    },
    {
      id: 'verification-disclaimer',
      title: 'Aclaración sobre reportes ciudadanos',
      body:
        'Un reporte en estado “Reportado” no implica que FARO haya validado su contenido. Los usuarios deben ' +
        'interpretar la información según su estado visible y, cuando sea posible, contrastarla con fuentes oficiales ' +
        'o con actualizaciones verificadas en la plataforma.',
    },
    {
      id: 'verification-no-guarantee',
      title: 'Sin garantía de verificación',
      body:
        'Aunque FARO cuenta con mecanismos de validación realizados por gestores y coordinadores, ninguna verificación ' +
        'constituye una garantía absoluta sobre la autenticidad, exactitud o integridad de los hechos reportados. Los ' +
        'estados visibles en la plataforma reflejan el proceso operativo interno, no una certificación legal ni oficial ' +
        'de los contenidos.',
      emphasis: 'warning',
    },
    {
      id: 'user-decision-responsibility',
      title: 'Uso bajo propio criterio',
      body:
        'Las decisiones que los usuarios adopten utilizando información obtenida en FARO —incluida la ubicación de centros, ' +
        'reportes, estados de verificación o recomendaciones de terceros— son de su exclusiva responsabilidad. FARO no ' +
        'instruye ni garantiza que debas actuar de determinada manera con base en la plataforma. Los usuarios deben ' +
        'evaluar cada situación con criterio propio y, cuando corresponda, contrastar con fuentes oficiales.',
    },
    {
      id: 'help-nature',
      title: '7. Naturaleza de la ayuda coordinada',
      body:
        'FARO no controla ni dirige las acciones de voluntarios, gestores de casos, centros de acopio u ' +
        'organizaciones conectadas a través de la plataforma. Toda coordinación y prestación de ayuda se realiza ' +
        'bajo la responsabilidad de los propios participantes. FARO no garantiza que una solicitud será atendida ' +
        'ni que el apoyo ofrecido se ajustará a las expectativas del solicitante.',
    },
    {
      id: 'volunteers',
      title: 'Responsabilidad de los voluntarios',
      body:
        'Los voluntarios que participan en actividades relacionadas con FARO lo hacen de manera libre y voluntaria. ' +
        'FARO no mantiene relación laboral, contractual ni de representación oficial con ellos, salvo autorización ' +
        'expresa y documentada del Equipo FARO. Los voluntarios no representan oficialmente a FARO en terreno. Toda ' +
        'actuación presencial es responsabilidad del propio voluntario y, en su caso, de la organización que lo coordine.',
      bullets: [
        'Actuar con prudencia y respeto a la dignidad de las personas.',
        'Seguir las indicaciones de las organizaciones o coordinadores que los vinculen.',
        'No presentarse como empleado, funcionario ni vocero oficial de FARO sin autorización.',
      ],
    },
    {
      id: 'case-managers',
      title: '8. Responsabilidad de los gestores de casos',
      body:
        'Los gestores de casos que utilicen FARO son responsables de la información que registran, del seguimiento ' +
        'que documentan y de las decisiones operativas que adopten fuera de la plataforma. Deben actuar con ' +
        'diligencia, respetar la confidencialidad de las personas atendidas y no exponer datos sensibles sin ' +
        'justificación humanitaria. FARO no supervisa ni valida cada actuación individual del gestor; su función ' +
        'es facilitar el registro y la coordinación. Cualquier daño derivado de actuaciones del gestor en terreno ' +
        'corresponde a quien las ejecuta y, en su caso, a la organización que lo representa.',
      bullets: [
        'Registrar solo información necesaria y proporcionada para la coordinación del caso.',
        'Actualizar o cerrar casos cuando la situación lo requiera.',
        'No sustituir protocolos oficiales, médicos ni de emergencia.',
      ],
    },
    {
      id: 'coordinators-orgs',
      title: '9. Responsabilidad de coordinadores y organizaciones',
      body:
        'Los coordinadores deben mantener actualizados los estados del centro asignado y validar reportes con ' +
        'criterio profesional. Las organizaciones son responsables de sus operaciones, personal y de la veracidad ' +
        'de los datos que publican o autorizan a publicar en FARO.',
    },
    {
      id: 'emergency-data',
      title: '10. Uso de datos en contextos de emergencia',
      body:
        'En situaciones de emergencia o crisis humanitaria, FARO puede procesar datos de ubicación, contacto y ' +
        'reportes operativos estrictamente necesarios para coordinar ayuda. Este tratamiento se realiza conforme a ' +
        'la Política de Privacidad y con base en tu consentimiento y en la finalidad humanitaria informada. ' +
        'Debes evitar publicar datos personales de terceros (documentos de identidad, historiales médicos, etc.) ' +
        'salvo que sea indispensable, proporcionado y con las salvaguardas que exija la situación. FARO aplica ' +
        'principios de minimización de datos y no utiliza la información de emergencia con fines comerciales.',
      emphasis: 'info',
    },
    {
      id: 'sensitive-media',
      title: 'Fotografías e información sensible',
      body:
        'Quien publique fotografías, imágenes o descripciones en FARO declara contar con la autorización necesaria ' +
        'cuando corresponda. Debe evitar publicar:',
      bullets: [
        'Imágenes de menores de edad, salvo situación estrictamente necesaria y con las máximas salvaguardas.',
        'Información médica innecesaria o diagnósticos de terceros.',
        'Documentos de identidad, credenciales o datos que permitan suplantación.',
        'Contenido que vulnere la dignidad o la intimidad de personas afectadas.',
      ],
    },
    {
      id: 'content-moderation',
      title: 'Moderación de contenido',
      body:
        'El Equipo FARO puede eliminar, ocultar o limitar contenidos cuando sea necesario para proteger a la ' +
        'comunidad. Esta moderación puede aplicarse, entre otros casos, cuando el contenido:',
      bullets: [
        'Ponga en riesgo a personas o exponga datos personales sin justificación.',
        'Contenga información falsa, engañosa o que promueva fraude.',
        'Vulnere la privacidad, la dignidad o el honor de terceros.',
        'Interfiera de forma grave con operaciones humanitarias coordinadas en la plataforma.',
      ],
      emphasis: 'info',
    },
    {
      id: 'liability',
      title: '11. Limitación de responsabilidad',
      body:
        'En la medida permitida por la Constitución y las leyes de la República Bolivariana de Venezuela, FARO, ' +
        'el Equipo FARO y sus colaboradores no serán responsables por daños directos o indirectos, ' +
        'pérdidas o perjuicios derivados del uso o imposibilidad de uso de la plataforma; por acciones u omisiones ' +
        'de voluntarios, organizaciones o terceros vinculados a través de FARO; ni por errores, interrupciones, ' +
        'retrasos o fallas técnicas. Nada de lo previsto excluye responsabilidad que no pueda limitarse conforme a la ley.',
    },
    {
      id: 'founder-exoneration',
      title: '12. Exoneración del equipo y del proyecto',
      body:
        `El ${M.teamName} actúa como administrador de la plataforma tecnológica, no como prestador directo de ayuda ` +
        `humanitaria. Las reclamaciones relacionadas con el uso de FARO deben dirigirse al proyecto y la plataforma ` +
        `en general, no personalmente contra integrantes del equipo, salvo que la ley disponga lo contrario o exista ` +
        `sentencia firme que establezca responsabilidad individual.`,
    },
    {
      id: 'platform-evolution',
      title: 'Evolución continua y funcionalidades en prueba',
      body:
        'FARO es un proyecto en evolución continua. Algunas funcionalidades pueden encontrarse en fase beta, ' +
        'experimental o piloto. Los usuarios entienden que determinadas funciones pueden modificarse, suspenderse o ' +
        'eliminarse sin previo aviso cuando ello sea necesario para mejorar la seguridad o el funcionamiento de la plataforma.',
      emphasis: 'info',
    },
    {
      id: 'availability',
      title: '13. Disponibilidad y mantenimiento',
      body:
        'FARO se ofrece "tal cual" y "según disponibilidad". La plataforma puede suspenderse, interrumpirse o limitarse ' +
        'por mantenimiento programado o urgente, actualizaciones, fallas técnicas o causas ajenas a sus administradores. ' +
        'No se garantiza disponibilidad ininterrumpida ni ausencia de errores.',
    },
    {
      id: 'force-majeure',
      title: 'Fuerza mayor y eventos externos',
      body:
        'El Equipo FARO no será responsable por interrupciones, pérdidas de datos o imposibilidad de uso de la plataforma ' +
        'derivadas de eventos fuera de su control razonable, incluyendo —sin limitarse— terremotos, inundaciones, ' +
        'apagones, fallas eléctricas o de telecomunicaciones, interrupciones de acceso a Internet, ataques informáticos, ' +
        'fallas o indisponibilidad de proveedores (como Supabase o Vercel), decisiones de autoridades o conflictos sociales ' +
        'que afecten la operación normal del servicio.',
    },
    {
      id: 'suspension',
      title: '14. Suspensión de cuentas',
      body:
        'FARO puede suspender o limitar cuentas que violen estos Términos, pongan en riesgo a personas o afecten ' +
        'la operación de la plataforma, previa valoración razonable de la situación.',
    },
    {
      id: 'ip',
      title: '15. Propiedad intelectual',
      body:
        'El diseño, código, marca y contenidos propios de FARO están protegidos. No puedes copiar, modificar ni ' +
        'distribuir elementos de la plataforma sin autorización, salvo uso personal permitido por la ley.',
    },
    {
      id: 'changes',
      title: '16. Modificaciones de estos Términos',
      body:
        'FARO puede modificar estos Términos publicando la nueva versión en la plataforma con la fecha de ' +
        'actualización y el número de versión. Si los cambios son relevantes (por ejemplo, modificaciones a la ' +
        'limitación de responsabilidad o al tratamiento de datos), procuraremos notificarte por correo electrónico ' +
        'o mediante un aviso visible dentro de la aplicación. El uso continuado después de la publicación implica ' +
        'aceptación de los nuevos términos.',
    },
    {
      id: 'privacy-ref',
      title: '17. Política de Privacidad',
      body:
        'El tratamiento de datos personales se rige por la Política de Privacidad de FARO, que forma parte integrante ' +
        'de este marco legal. Consulta ese documento para conocer qué datos recopilamos y cómo ejercer tus derechos.',
    },
    {
      id: 'law',
      title: '18. Ley aplicable y jurisdicción',
      body:
        'Estos Términos se rigen por la Constitución de la República Bolivariana de Venezuela (arts. 28, 60 y ' +
        'relacionados), las leyes aplicables y la doctrina del hábeas data. Cualquier controversia se someterá a los ' +
        'tribunales competentes en el territorio venezolano.',
    },
    {
      id: 'contact',
      title: '19. Contacto',
      body:
        `${legalEmailLine('contact', 'Consultas generales')}. ` +
        `${legalEmailLine('legal', 'Asuntos legales')}. ` +
        `${legalEmailLine('privacy', 'Asuntos de privacidad')}.`,
    },
  ],
}

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy',
  title: 'Política de Privacidad',
  subtitle: 'Protección de datos personales en FARO (Venezuela)',
  version: LEGAL_VERSIONS.privacy.version,
  updatedAt: LEGAL_VERSIONS.privacy.updatedAt,
  effectiveAt: LEGAL_VERSIONS.privacy.effectiveAt,
  sections: [
    {
      id: 'controller',
      title: '1. Responsable del tratamiento',
      body:
        `FARO es administrado por ${M.dataController}, con sede en ${M.locationLabel}. ` +
        `Plataforma: ${M.platformUrl}. ${legalEmailLine('privacy', 'Consultas de privacidad')}.`,
    },
    {
      id: 'constitutional-framework',
      title: '2. Marco constitucional',
      body:
        'De conformidad con el artículo 28 de la Constitución de la República Bolivariana de Venezuela, toda persona ' +
        'tiene derecho a acceder a los datos que sobre sí misma consten en registros públicos o privados, conocer ' +
        'el uso y la finalidad de dicha información, y solicitar su actualización, rectificación o destrucción cuando ' +
        'sean erróneos o afecten ilegítimamente sus derechos. FARO se inspira además en buenas prácticas ' +
        'internacionales de protección de datos, sin que ello implique la aplicación directa de normas extranjeras.',
    },
    {
      id: 'data-collected',
      title: '3. Datos que recopilamos',
      body: 'Al utilizar FARO podemos recopilar:',
      bullets: [
        'Identificación: nombre completo.',
        'Contacto: correo electrónico, teléfono.',
        'Ubicación: ciudad, estado, parroquia o coordenadas aproximadas asociadas a reportes o centros.',
        'Rol y actividad: ciudadano, voluntario, gestor de casos, coordinador u organización; reportes y actualizaciones.',
        'Preferencias: notificaciones push, configuración de alertas.',
        'Técnicos: dirección IP, tipo de dispositivo, sistema operativo, registros de acceso y auditoría de seguridad.',
      ],
    },
    {
      id: 'data-not-collected',
      title: '4. Datos que NO recopilamos',
      body:
        'No solicitamos documentos de identidad, datos bancarios ni historiales clínicos como requisito general de uso. ' +
        'No vendemos datos personales. Si un usuario incluye datos sensibles en un reporte, es responsabilidad de quien ' +
        'los publica; FARO desalienta esa práctica salvo necesidad humanitaria justificada.',
    },
    {
      id: 'purposes',
      title: '5. Finalidades del tratamiento',
      body: 'Utilizamos los datos para:',
      bullets: [
        'Coordinar ayuda humanitaria: conectar solicitudes con voluntarios, centros y organizaciones.',
        'Comunicación operativa: notificaciones sobre casos, centros y avisos de seguridad.',
        'Seguridad: detectar usos indebidos, proteger cuentas y registrar eventos críticos.',
        'Mejora del servicio: estadísticas agregadas o anonimizadas cuando sea posible.',
      ],
    },
    {
      id: 'legal-basis',
      title: '6. Base legal y consentimiento',
      body:
        'El tratamiento se basa en tu consentimiento libre, expreso e informado al registrarte o usar funciones que ' +
        'requieren datos, y en la necesidad del tratamiento para cumplir la finalidad humanitaria declarada. ' +
        `Puedes retirar tu consentimiento en cualquier momento enviando un correo a ${activeContactEmail('privacy')}. El retiro ` +
        'del consentimiento no afecta la legalidad del tratamiento basado en consentimiento previo a su retiro. ' +
        'También puedes solicitar la eliminación de tu cuenta o datos según se indica más adelante.',
    },
    {
      id: 'location-emergency',
      title: '7. Datos de ubicación en emergencias',
      body:
        'En contextos de emergencia, FARO puede procesar ubicación aproximada o coordenadas asociadas a reportes ' +
        'ciudadanos, centros de acopio u hospitales para mostrar información en el mapa y facilitar la coordinación. ' +
        'Solo recopilamos ubicación cuando tú o un coordinador autorizado la proporciona en el flujo de la app. ' +
        'Puedes evitar compartir ubicación precisa usando descripciones generales cuando la situación lo permita. ' +
        'La ubicación no se usa con fines publicitarios ni de perfilamiento comercial.',
      emphasis: 'info',
    },
    {
      id: 'third-parties',
      title: '8. Proveedores tecnológicos',
      body: 'Para operar FARO utilizamos:',
      bullets: [
        `Supabase: autenticación, base de datos PostgreSQL, almacenamiento de archivos y funciones de backend.`,
        `OneSignal: envío de notificaciones push a navegadores y dispositivos móviles.`,
        `Vercel: hosting del frontend y distribución de la aplicación web (${M.platformUrl}).`,
      ],
    },
    {
      id: 'international-transfer',
      title: '9. Transferencias internacionales',
      body:
        'Supabase, OneSignal y Vercel pueden procesar datos en servidores fuera de Venezuela. Esas transferencias ' +
        'ocurren bajo las condiciones de seguridad y confidencialidad de cada proveedor. FARO solo comparte los ' +
        'datos estrictamente necesarios para prestar el servicio.',
    },
    {
      id: 'push-onesignal',
      title: '10. Notificaciones push y OneSignal',
      body:
        'Si activas las notificaciones push, OneSignal recibe un identificador de dispositivo (player ID) vinculado a ' +
        'tu cuenta de FARO para enviar alertas operativas. Puedes desactivar las notificaciones desde la configuración ' +
        'de tu dispositivo o desde Preferencias de notificaciones en FARO. No enviamos publicidad a través de OneSignal.',
    },
    {
      id: 'backup',
      title: '11. Respaldo y recuperación de datos',
      body:
        'Supabase mantiene copias de seguridad periódicas de la base de datos para recuperación ante fallos técnicos. ' +
        'Los respaldos están sujetos a las políticas del proveedor y a controles de acceso restringido. FARO no ' +
        'exporta ni vende copias de datos personales. En caso de incidente, procuraremos restaurar el servicio y ' +
        'notificar a usuarios afectados cuando sea razonable y necesario.',
    },
    {
      id: 'rights',
      title: '12. Derechos de los usuarios (ARCO)',
      body: 'Reconocemos los siguientes derechos:',
      bullets: [
        'Acceso: conocer qué datos personales tratamos y con qué finalidad.',
        'Rectificación: corregir datos inexactos o incompletos.',
        'Actualización: completar o actualizar tu información.',
        'Oposición: oponerte a ciertos tratamientos cuando existan razones fundadas.',
        'Supresión: solicitar eliminación de datos, salvo obligación legal de conservación.',
      ],
    },
    {
      id: 'exercise-rights',
      title: '13. Cómo ejercer tus derechos',
      body:
        `Escribe a ${activeContactEmail('privacy')} indicando tu nombre completo, medio de contacto y el detalle de la solicitud. ` +
        `FARO procurará responder en un plazo razonable (orientativo: ${M.privacyResponseDays} días hábiles). ` +
        `Si la solicitud es rechazada, informaremos los motivos. También puedes acudir a la vía del hábeas data ante ` +
        `tribunales competentes conforme a la Constitución y la Ley Orgánica del Tribunal Supremo de Justicia.`,
    },
    {
      id: 'security',
      title: '14. Seguridad de la información',
      body:
        'Implementamos medidas técnicas y organizativas razonables: control de acceso por roles (RLS en base de datos), ' +
        'cifrado en tránsito (HTTPS/TLS), auditoría de eventos de autenticación y minimización de datos. Ningún sistema ' +
        'es completamente seguro; no podemos garantizar seguridad absoluta.',
    },
    {
      id: 'retention',
      title: '15. Plazos de conservación',
      body:
        'Conservamos los datos el tiempo necesario para las finalidades descritas y para registros básicos de ' +
        'operación y seguridad. Cuando ya no sean necesarios, procuramos eliminarlos o anonimizarlos, salvo obligación ' +
        'legal o interés legítimo documentado (por ejemplo, auditoría de incidentes).',
    },
    {
      id: 'cookies',
      title: '16. Cookies y almacenamiento local',
      body:
        'FARO no utiliza cookies publicitarias ni de seguimiento comercial. Usamos almacenamiento local del navegador, ' +
        'tokens de sesión de Supabase y tecnologías similares para mantener tu acceso, preferencias operativas y estado ' +
        'de la aplicación (PWA). OneSignal puede utilizar identificadores técnicos para notificaciones push. Vercel ' +
        'puede registrar datos técnicos de acceso para operar el hosting. Consulta la Política de Cookies para el detalle.',
    },
    {
      id: 'minors',
      title: '17. Menores de edad',
      body:
        'FARO está orientada principalmente a personas mayores de 18 años. Si un menor utiliza la plataforma, se ' +
        `recomienda hacerlo con apoyo de sus representantes legales. Solicitudes de eliminación: ${activeContactEmail('privacy')}.`,
    },
    {
      id: 'changes',
      title: '18. Cambios en esta Política',
      body:
        'Podemos modificar esta Política publicando la nueva versión en la plataforma con la fecha de actualización. ' +
        'El uso continuado después de la modificación implica conocimiento de los cambios. Cambios relevantes pueden ' +
        'requerir nueva aceptación al iniciar sesión.',
    },
    {
      id: 'consent',
      title: '20. Consentimiento',
      body:
        'El registro en FARO requiere tres manifestaciones separadas: aceptación de los Términos de Servicio, ' +
        'confirmación de haber leído esta Política de Privacidad y autorización expresa del tratamiento de datos ' +
        'personales conforme a ella. Cada consentimiento se registra con fecha, hora y versión del documento aceptado.',
      emphasis: 'info',
    },
    {
      id: 'contact',
      title: '21. Contacto de privacidad',
      body:
        `${legalEmailLine('privacy', 'Privacidad y datos personales')}. ` +
        `${legalEmailLine('contact', 'Consultas generales')}.`,
    },
  ],
}

export const LEGAL_NOTICE: LegalDocument = {
  id: 'notice',
  title: 'Aviso Legal',
  subtitle: 'Información general y límites de responsabilidad',
  version: LEGAL_VERSIONS.notice.version,
  updatedAt: LEGAL_VERSIONS.notice.updatedAt,
  effectiveAt: LEGAL_VERSIONS.notice.effectiveAt,
  sections: [
    {
      id: 'ownership',
      title: '1. Titularidad del sitio',
      body:
        `FARO es una ${M.projectNature} administrada por ${M.dataController}, con sede en ${M.locationLabel}. ` +
        `Sitio: ${M.platformUrl}. Información del proyecto: sección "Acerca de FARO". ` +
        `${legalEmailLine('contact', 'Contacto')}.`,
    },
    {
      id: 'information-nature',
      title: '2. Naturaleza de la información',
      body:
        'La información en FARO —reportes, solicitudes, mapas y actualizaciones— tiene carácter informativo y de ' +
        'coordinación comunitaria. No todo el contenido está verificado al publicarse: los estados oficiales ' +
        '(Reportado, En revisión, Verificado, En atención, Resuelto) indican el grado de validación. A pesar de los ' +
        'esfuerzos por mejorar la calidad, FARO no garantiza exactitud, completitud ni actualización permanente de todos los datos.',
    },
    {
      id: 'venezuela-context',
      title: '3. Coordinación humanitaria en Venezuela',
      body:
        'FARO opera en el contexto de la República Bolivariana de Venezuela como proyecto de innovación social y ' +
        'herramienta de solidaridad y coordinación civil. No sustituye planes oficiales de protección civil, respuesta ' +
        'estatal ni operaciones de organismos internacionales. Complementa redes de ayuda respetando la dignidad, ' +
        'privacidad y seguridad de las personas, en línea con los derechos reconocidos en la Constitución (arts. 28 y 60).',
      emphasis: 'info',
    },
    {
      id: 'emergency',
      title: '4. No somos un servicio de emergencia',
      body:
        'Si existe una emergencia que ponga en riesgo la vida o la integridad física, contacte inmediatamente a los ' +
        'servicios oficiales de emergencia y autoridades competentes en su localidad. FARO no es una línea de atención ' +
        'inmediata. La información publicada puede no reflejar en tiempo real cada situación.',
      emphasis: 'warning',
    },
    {
      id: 'medical',
      title: '5. Descargo médico y profesional',
      body:
        'Contenidos sobre salud o primeros auxilios son informativos y no constituyen diagnóstico ni tratamiento médico. ' +
        'FARO no sustituye consulta con profesionales de la salud acreditados. Tampoco proporciona asesoría legal o ' +
        'financiera especializada.',
    },
    {
      id: 'third-party-info',
      title: '6. Dependencia de información de terceros',
      body:
        'Gran parte de la información en FARO proviene de ciudadanos, coordinadores y organizaciones. FARO no controla ' +
        'ni garantiza las actuaciones de esos terceros. Los enlaces a sitios externos se ofrecen como referencia; FARO ' +
        'no respalda ni se responsabiliza por contenidos, políticas o prácticas de terceros.',
    },
    {
      id: 'tech-platform',
      title: '7. FARO como facilitador tecnológico',
      body:
        'FARO actúa como intermediario tecnológico: conecta, visibiliza y organiza datos para mejorar la coordinación. ' +
        'No entrega ayuda directa, no garantiza resultados ni representa al Estado.',
    },
    {
      id: 'org-responsibility',
      title: '8. Responsabilidad de organizaciones y publicadores',
      body:
        'Cada organización y cada usuario que publica información es responsable de su veracidad, licitud y actualización. ' +
        'FARO puede retirar contenidos que violen sus políticas o la ley.',
    },
    {
      id: 'cross-links',
      title: '9. Documentos relacionados',
      body:
        'Este Aviso complementa los Términos de Servicio y la Política de Privacidad. Te recomendamos leer los tres ' +
        'documentos para conocer tus derechos y obligaciones al usar FARO.',
    },
  ],
}

export const ABOUT_FARO_SECTIONS: LegalDocument = {
  id: 'about',
  title: 'Acerca de FARO',
  subtitle: 'Misión, historia y equipo detrás de la plataforma',
  version: LEGAL_VERSIONS.terms.version,
  updatedAt: LEGAL_VERSIONS.terms.updatedAt,
  effectiveAt: LEGAL_VERSIONS.terms.effectiveAt,
  sections: [
    {
      id: 'intro',
      title: 'Qué es FARO',
      body:
        'FARO es una iniciativa tecnológica humanitaria de impacto social creada para apoyar la coordinación de ayuda ' +
        'en Venezuela. Facilita el encuentro entre quienes necesitan apoyo y quienes pueden ofrecerlo, mediante un ' +
        'mapa operativo de hospitales, refugios y centros de acopio.',
    },
    {
      id: 'mission',
      title: 'Nuestra misión',
      body:
        'Coordinar información humanitaria confiable para que ciudadanos, voluntarios y organizaciones actúen con ' +
        'claridad y rapidez, siempre en apoyo de los canales oficiales y sin sustituirlos.',
    },
    {
      id: 'vision',
      title: 'Nuestra visión',
      body:
        'Ser una plataforma de referencia para la coordinación humanitaria en situaciones críticas, fortaleciendo ' +
        'redes de solidaridad con tecnología accesible, segura y respetuosa de la privacidad.',
    },
    {
      id: 'history',
      title: 'Nuestra historia',
      body:
        'FARO nació tras una emergencia, con el propósito de conectar más rápido a quienes necesitan ayuda con quienes ' +
        'pueden ofrecerla. Lo que comenzó como una respuesta urgente evolucionó hacia una plataforma pensada para ' +
        'fortalecer la coordinación humanitaria con tecnología accesible, confiable y centrada en las personas.',
    },
    {
      id: 'how',
      title: 'Cómo funciona FARO',
      body:
        'Ciudadanos reportan información; coordinadores verifican y actualizan centros; organizaciones ejecutan la ' +
        'respuesta en terreno. FARO consolida estos datos en un mapa y panel operativo en tiempo casi real.',
    },
    {
      id: 'roles',
      title: 'Papel de cada actor',
      body: 'FARO conecta distintos perfiles con responsabilidades claras:',
      bullets: [
        'Ciudadanos: consultan el mapa y envían reportes sin necesidad de cuenta.',
        'Voluntarios: apoyan en terreno siguiendo protocolos y coordinación local.',
        'Gestores de casos: documentan seguimiento y estado de solicitudes.',
        'Coordinadores: actualizan saturación, necesidades e inventario de su centro.',
        'Organizaciones: definen capacidad operativa y validan información institucional.',
      ],
    },
    {
      id: 'team',
      title: 'Nuestro equipo',
      body:
        `FARO es impulsado por el ${M.teamName}, un grupo de personas comprometidas con la coordinación humanitaria ` +
        `mediante tecnología. En esta etapa opera como proyecto de innovación social de impacto humanitario.`,
      bullets: [
        `Fundador y ${M.founderRole}: ${M.founderName}`,
        'Colaboradores técnicos y operativos en desarrollo, moderación y mejora continua.',
      ],
    },
    {
      id: 'technology',
      title: 'Tecnología',
      body: 'FARO está construido con herramientas modernas y de código abierto:',
      bullets: [
        'Frontend: React + Vite, desplegado en Vercel.',
        'Backend: Supabase (autenticación, base de datos PostgreSQL, almacenamiento).',
        'Notificaciones: OneSignal para alertas push operativas.',
        'Seguridad: control de acceso por roles, auditoría y cifrado en tránsito.',
      ],
    },
    {
      id: 'legal-links',
      title: 'Marco legal',
      body:
        'Para conocer las reglas de uso y el tratamiento de tus datos, revisa los Términos de Servicio y la ' +
        'Política de Privacidad disponibles en el pie de página de la aplicación.',
    },
  ],
}

export const CONTACT_PAGE_CONTENT: LegalDocument = {
  id: 'contact',
  title: 'Contacto',
  subtitle: `Equipo ${M.projectName} · ${M.locationLabel}`,
  version: LEGAL_VERSIONS.terms.version,
  updatedAt: LEGAL_VERSIONS.terms.updatedAt,
  effectiveAt: LEGAL_VERSIONS.terms.effectiveAt,
  sections: [
    {
      id: 'intro',
      title: 'Cómo contactarnos',
      body:
        `FARO es una plataforma de coordinación humanitaria administrada por ${M.dataController}. ` +
        `Los medios de contacto oficiales son el correo electrónico institucional y el formulario web de esta sección. ` +
        `Procuramos responder en un plazo razonable, considerando la naturaleza del proyecto y nuestras capacidades técnicas.`,
    },
    {
      id: 'channels',
      title: 'Canales de contacto',
      body: 'Puedes escribirnos según el tipo de consulta:',
      bullets: [
        legalEmailLine('contact', 'Consultas generales'),
        legalEmailLine('support', 'Soporte técnico y reportes de fallos'),
        legalEmailLine('privacy', 'Privacidad y datos personales (acceso, rectificación, eliminación)'),
        legalEmailLine('legal', 'Asuntos legales y reclamaciones'),
        'Formulario web: disponible en esta misma sección de Contacto.',
      ],
    },
    {
      id: 'privacy-notice',
      title: 'Aviso de privacidad del formulario',
      body:
        'Los datos que envíes por el formulario (nombre, correo y mensaje) se utilizan únicamente para atender tu ' +
        'consulta y mejorar el servicio. No los vendemos ni los usamos con fines publicitarios. Puedes solicitar la ' +
        `eliminación de tu mensaje escribiendo a ${activeContactEmail('privacy')}.`,
    },
  ],
}

export const COOKIES_POLICY: LegalDocument = {
  id: 'cookies',
  title: 'Política de Cookies',
  subtitle: 'Uso de cookies y tecnologías similares en FARO',
  version: LEGAL_VERSIONS.cookies.version,
  updatedAt: LEGAL_VERSIONS.cookies.updatedAt,
  effectiveAt: LEGAL_VERSIONS.cookies.effectiveAt,
  sections: [
    {
      id: 'intro',
      title: '1. Introducción',
      body:
        `Esta Política describe cómo ${M.projectName}, administrado por ${M.dataController}, utiliza cookies, ` +
        'almacenamiento local del navegador y tecnologías similares. FARO no utiliza cookies publicitarias ni de ' +
        'seguimiento comercial.',
    },
    {
      id: 'what-are-cookies',
      title: '2. Qué son las cookies',
      body:
        'Las cookies son pequeños archivos de texto que un sitio web o aplicación puede almacenar en tu dispositivo. ' +
        'El almacenamiento local del navegador cumple una función similar para guardar preferencias y estado de sesión ' +
        'sin necesidad de cookies clásicas en todos los casos.',
    },
    {
      id: 'essential',
      title: '3. Cookies y almacenamiento esenciales',
      body: 'FARO utiliza tecnologías estrictamente necesarias para el funcionamiento de la plataforma:',
      bullets: [
        'Sesión de autenticación (Supabase Auth): tokens para mantener tu acceso seguro.',
        'Preferencias operativas: configuración de la interfaz y estado de la aplicación (PWA).',
        'Consentimiento legal pendiente: registro temporal hasta sincronizar aceptaciones en el servidor.',
      ],
    },
    {
      id: 'third-party',
      title: '4. Proveedores que pueden usar cookies o identificadores',
      body:
        'Algunos servicios integrados pueden establecer cookies o identificadores técnicos en tu dispositivo:',
      bullets: [
        'Supabase: autenticación, base de datos y almacenamiento — cookies o tokens de sesión.',
        'OneSignal: notificaciones push — identificadores técnicos para entregar alertas operativas.',
        'Vercel: hosting y entrega de la aplicación — cookies técnicas y registros de acceso.',
        'Cloudflare Turnstile (si está activo): verificación anti-bots en formularios sensibles.',
      ],
    },
    {
      id: 'no-advertising',
      title: '5. Sin publicidad ni perfiles comerciales',
      body:
        'FARO no vende datos personales ni utiliza cookies para publicidad dirigida. No creamos perfiles comerciales ' +
        'de usuarios con fines de marketing.',
    },
    {
      id: 'control',
      title: '6. Cómo gestionar cookies',
      body:
        'Puedes configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que deshabilitar cookies ' +
        'esenciales puede impedir el inicio de sesión o el funcionamiento correcto de FARO. Para notificaciones push, ' +
        'puedes revocar el permiso desde la configuración de tu dispositivo o navegador.',
    },
    {
      id: 'updates',
      title: '7. Cambios en esta Política',
      body:
        'Podemos actualizar esta Política publicando la nueva versión en la plataforma. La fecha y el número de versión ' +
        'indican la vigencia del documento.',
    },
    {
      id: 'contact',
      title: '8. Contacto',
      body:
        `${legalEmailLine('privacy', 'Privacidad y datos')}. ` +
        `${legalEmailLine('contact', 'Consultas generales')}.`,
    },
  ],
}
