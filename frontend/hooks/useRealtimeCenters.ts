'use client'

import { useEffect } from 'react'
import { supabase } from '../lib/supabase/client'

interface UseRealtimeCentersOptions {
  onOperationalReportChanged: () => void
}

export function useRealtimeCenters({ onOperationalReportChanged }: UseRealtimeCentersOptions) {
  useEffect(() => {
    const channel = supabase
      .channel('operational-reports-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operational_reports',
        },
        () => {
          onOperationalReportChanged()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [onOperationalReportChanged])
}
