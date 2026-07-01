import { cn } from '@/lib/utils'

/** Skeleton loader sutil — pulso lento, nunca llamativo. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-white/[0.06]',
        className,
      )}
    />
  )
}
