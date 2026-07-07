import { cn } from '@/lib/utils'

interface FaroIconProps {
  size?: number
  className?: string
  title?: string
}

/**
 * Isotipo FARO — logo oficial (faro sobre fondo azul).
 * Usa el PNG generado en public/icons/icon-192.png.
 */
export function FaroIcon({ size = 24, className, title }: FaroIconProps) {
  return (
    <img
      src="/icons/icon-192.png"
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      title={title}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 rounded-[22%]', className)}
      style={{ width: size, height: size }}
    />
  )
}
