import { CoordinatorWorkspace } from '@/components/coordinator/coordinator-workspace'
import type { CoordinatorModuleId } from '@/services/coordinator-service'
import type { Site } from '@/lib/types'

interface CoordinatorPanelScreenProps {
  activeModule?: CoordinatorModuleId
  onModuleChange?: (module: CoordinatorModuleId) => void
  focusReportId?: string | null
  onFocusReportClear?: () => void
  onOpenDetail?: (site: Site) => void
  onRegisterNeed?: (siteId?: string) => void
  onUpdateSaturation?: (siteId?: string) => void
  onRegisterArrival?: (siteId?: string) => void
  onRegisterDispatch?: (siteId?: string) => void
}

export function CoordinatorPanelScreen(props: CoordinatorPanelScreenProps) {
  return <CoordinatorWorkspace {...props} />
}
