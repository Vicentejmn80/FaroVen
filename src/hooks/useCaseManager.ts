import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from './query-keys'
import { caseManagerService } from '@/services/case-manager-service'
import { useAuth } from '@/store/auth-context'
import type { ConvertReportWizardData } from '@/services/case-manager-service'

export function useReportAnalysis(reportId: string | null) {
  return useQuery({
    queryKey: [FARO_QUERY_KEYS.reportAnalysis, reportId],
    queryFn: () => caseManagerService.analyzeReport(reportId!),
    enabled: !!reportId,
    staleTime: 30_000,
  })
}

export function useConvertReportToCase() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (data: ConvertReportWizardData) =>
      caseManagerService.convertReportToCase(data, user?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.reports] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.reportAnalysis] })
    },
  })
}
