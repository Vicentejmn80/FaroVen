import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FARO_QUERY_KEYS } from '@/hooks/query-keys'
import { operationalWizardService, type OperationalWizardInput } from '@/services/operational-wizard-service'

export function useCreateOperationalCaseFromWizard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: OperationalWizardInput) =>
      operationalWizardService.createOperationalCaseFromReportWizard(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.cases] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.reports] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.publicNeeds] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.reportAnalysis] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.inventoryReservations] })
      qc.invalidateQueries({ queryKey: [FARO_QUERY_KEYS.coverage] })
    },
  })
}

