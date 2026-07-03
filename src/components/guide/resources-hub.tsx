import { useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useEmergencyKitChecklist, useGuideResources } from '@/hooks/useGuideResources'
import { guideService } from '@/services/guide-service'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { useFaro } from '@/store/faro-context'
import { useToast } from '@/store/toast-context'
import type { GuideModuleId } from '@/domain/guide-models'
import { ModuleNav } from './shared/module-nav'
import { EmergencyContactsSection } from './emergency-contacts/emergency-contacts-section'
import { ProtocolLibrarySection } from './protocols/protocol-library-section'
import { ProtocolDetail } from './protocols/protocol-detail'
import { EmergencyKitSection } from './checklists/emergency-kit-section'
import { OfficialResourcesSection } from './official/official-resources-section'
import { OfficialResourceDetail } from './official/official-resource-detail'
import { VerifiedInfoSection } from './verified/verified-info-section'
import { FaqSection } from './faq/faq-section'
import { AppStatusSection } from './app-status/app-status-section'
import { FaroAboutSection } from './about/faro-about-section'
import { ContactFormSection } from './contact/contact-form-section'

const MODULE_ANCHOR: Record<GuideModuleId, string> = {
  emergency: 'guide-emergency',
  protocols: 'guide-protocols',
  kit: 'guide-kit',
  official: 'guide-official',
  verified: 'guide-verified',
  faq: 'guide-faq',
  status: 'guide-status',
  about: 'guide-about',
  contact: 'guide-contact',
}

export function ResourcesHub() {
  const { showToast } = useToast()
  const network = useNetworkStatus()
  const { cachedAt, loadError, state } = useFaro()
  const resources = useGuideResources()
  const kit = useEmergencyKitChecklist()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [activeModule, setActiveModule] = useState<GuideModuleId | null>(null)
  const [protocolId, setProtocolId] = useState<string | null>(null)
  const [officialId, setOfficialId] = useState<string | null>(null)
  const [feedbackBusy, setFeedbackBusy] = useState(false)

  const protocol = useMemo(
    () => (protocolId ? guideService.getProtocolById(protocolId) : null),
    [protocolId],
  )
  const official = useMemo(
    () => (officialId ? guideService.getOfficialResourceById(officialId) : null),
    [officialId],
  )

  const verifiedAnnouncements = useMemo(
    () => guideService.getVerifiedAnnouncements(state.events),
    [state.events],
  )

  const appStatus = useMemo(
    () =>
      guideService.getAppStatus({
        networkOnline: network.state === 'online',
        cachedAt,
        loadError,
      }),
    [network.state, cachedAt, loadError],
  )

  const scrollToModule = useCallback((id: GuideModuleId) => {
    setActiveModule(id)
    setProtocolId(null)
    setOfficialId(null)
    const anchor = document.getElementById(MODULE_ANCHOR[id])
    anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleCall = useCallback((phone: string) => {
    window.location.href = `tel:${phone.replace(/\s/g, '')}`
  }, [])

  const handleCopy = useCallback(
    async (phone: string, label: string) => {
      try {
        await navigator.clipboard.writeText(phone)
        showToast(`${label}: número copiado`, 'success')
      } catch {
        showToast('No se pudo copiar el número', 'warning')
      }
    },
    [showToast],
  )

  const handleFeedback = useCallback(
    async (input: { category: Parameters<typeof guideService.submitFeedback>[0]['category']; message: string; email?: string }) => {
      setFeedbackBusy(true)
      try {
        await guideService.submitFeedback(input)
        showToast('Mensaje enviado. El equipo FARO fue notificado.', 'success')
      } catch (err) {
        showToast(humanizeSupabaseError(err), 'warning')
      } finally {
        setFeedbackBusy(false)
      }
    },
    [showToast],
  )

  if (protocol) {
    return (
      <div ref={scrollRef} className="space-y-4 pt-2">
        <ProtocolDetail protocol={protocol} onBack={() => setProtocolId(null)} />
      </div>
    )
  }

  if (official) {
    return (
      <div ref={scrollRef} className="space-y-4 pt-2">
        <OfficialResourceDetail resource={official} onBack={() => setOfficialId(null)} onCall={handleCall} />
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="space-y-8 pb-8 pt-2">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1 px-1"
      >
        <p className="text-sm text-ink-muted">Información crítica, verificada y lista para actuar.</p>
      </motion.div>

      <ModuleNav
        modules={resources.modules.map((m) => ({ id: m.id, label: m.label }))}
        active={activeModule}
        onSelect={scrollToModule}
      />

      <EmergencyContactsSection contacts={resources.contacts} onCall={handleCall} onCopy={handleCopy} />

      <ProtocolLibrarySection protocols={resources.protocols} onSelect={setProtocolId} />

      <EmergencyKitSection
        items={resources.kitItems}
        checked={kit.checked}
        completedCount={kit.completedCount}
        onToggle={kit.toggle}
        onReset={kit.reset}
      />

      <OfficialResourcesSection resources={resources.officialResources} onSelect={setOfficialId} />

      <VerifiedInfoSection announcements={verifiedAnnouncements} />

      <FaqSection items={resources.faq} />

      <AppStatusSection status={appStatus} />

      <FaroAboutSection blocks={resources.aboutBlocks} />

      <ContactFormSection
        teamContact={resources.teamContact}
        onSubmit={handleFeedback}
        onCall={handleCall}
        onCopy={handleCopy}
        busy={feedbackBusy}
      />
    </div>
  )
}
