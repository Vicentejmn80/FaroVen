import { cn } from '@/lib/utils'

/** Azul de marca FARO — tu isotipo original, sin alterar la forma. */
export const FARO_BRAND_CYAN = '#00E5FF'

/** Proporción del PNG original (738×842). */
const FARO_ICON_ASPECT = 738 / 842

interface FaroIconProps {
  size?: number
  className?: string
  title?: string
}

/**
 * Isotipo FARO — imagen oficial del faro (haz solo a la derecha), teñida en azul.
 * La forma viene de public/icons/faro-logo.png tal cual la enviaste.
 */
export function FaroIcon({ size = 24, className, title }: FaroIconProps) {
  const height = size
  const width = Math.round(size * FARO_ICON_ASPECT)

  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn('inline-block shrink-0 bg-[#00E5FF]', className)}
      style={{
        width,
        height,
        WebkitMaskImage: 'url(/icons/faro-logo.png)',
        maskImage: 'url(/icons/faro-logo.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}
