import type { FaroTeamContact } from '@/domain/guide-models'
import { FARO_LEGAL_META, activeContactEmail } from '@/data/legal/faro-legal-meta'

/** Contacto directo del equipo FARO — visible en Recursos. */
export const FARO_TEAM_CONTACT: FaroTeamContact = {
  name: FARO_LEGAL_META.teamName,
  role: FARO_LEGAL_META.projectNature,
  email: activeContactEmail('contact'),
  emailNote: `Privacidad: ${FARO_LEGAL_META.emails.privacy} · Soporte: ${FARO_LEGAL_META.emails.support} · Legal: ${FARO_LEGAL_META.emails.legal}`,
}
