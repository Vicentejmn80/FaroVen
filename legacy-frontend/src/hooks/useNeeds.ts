import { useNeedsWithLocations } from '@/hooks/useQuickUpdate'

/** @deprecated use useNeedsWithLocations from useQuickUpdate */
export function useNeeds() {
  return useNeedsWithLocations()
}
