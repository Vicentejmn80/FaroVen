'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/acopio', label: '📦 Acopio' },
  { href: '/hospitales', label: '🏥 Hospitales' },
  { href: '/refugios', label: '🏠 Refugios' },
  { href: '/buscar', label: '🔎 Buscar' },
  { href: '/reportar', label: '🚨 Reportar' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/20 bg-white/80 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      <div className="mx-auto grid w-full max-w-[500px] grid-cols-5 gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-12 items-center justify-center rounded-xl px-1 text-center text-[11px] font-medium transition active:scale-[0.97] ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
