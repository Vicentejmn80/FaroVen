import type { ReactNode } from 'react'
import { SectionTitle } from '@/components/faro/section-title'

interface ResourceSectionProps {
  id: string
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function ResourceSection({ id, title, action, children, className }: ResourceSectionProps) {
  return (
    <section id={id} className={className}>
      <SectionTitle action={action}>{title}</SectionTitle>
      <div className="mt-3">{children}</div>
    </section>
  )
}
