'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { HeaderMinimalista } from './header-minimalista'
import { BottomNav } from './bottom-nav'
import { CommandPanel } from '../command/command-panel'

interface LayoutPrincipalProps {
  children: ReactNode
}

export function LayoutPrincipal({ children }: LayoutPrincipalProps) {
  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderMinimalista
        onOpenCommandPanel={() => setIsCommandPanelOpen((v) => !v)}
        isCommandPanelOpen={isCommandPanelOpen}
      />

      <main className="mx-auto w-full max-w-[500px] px-4 pb-24 pt-4">
        {children}
      </main>

      <BottomNav />
      <CommandPanel open={isCommandPanelOpen} onClose={() => setIsCommandPanelOpen(false)} />
    </div>
  )
}
