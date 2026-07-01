import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { LayoutPrincipal } from '../../components/layout/layout-principal'

export const metadata: Metadata = {
  title: 'FaroVen',
  description: 'App operativa de respuesta rápida para emergencias',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <LayoutPrincipal>{children}</LayoutPrincipal>
      </body>
    </html>
  )
}
