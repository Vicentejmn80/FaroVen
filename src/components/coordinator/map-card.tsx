import { GlassCard } from '@/components/ui/glass-card'
import { SectionHeader } from './section-header'
import { Map } from 'lucide-react'

interface MapCardProps {
  children: React.ReactNode
  className?: string
}

export function MapCard({ children, className }: MapCardProps) {
  return (
    <GlassCard inset={false} className={`overflow-hidden ${className ?? ''}`}>
      <SectionHeader
        title="Mapa del centro"
        subtitle="Ubicación y elementos relacionados"
        icon={Map}
        className="px-4 pt-4 pb-2"
      />
      <div className="h-[280px] w-full lg:h-[360px]">{children}</div>
    </GlassCard>
  )
}
