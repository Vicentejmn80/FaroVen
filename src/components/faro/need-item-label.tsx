import { getNeedIcon } from '@/lib/need-catalog'
import { cn } from '@/lib/utils'

interface NeedItemLabelProps {
  name: string
  className?: string
  iconClassName?: string
}

export function NeedItemLabel({ name, className, iconClassName }: NeedItemLabelProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span aria-hidden className={cn('text-[13px] leading-none', iconClassName)}>
        {getNeedIcon(name)}
      </span>
      <span>{name}</span>
    </span>
  )
}
