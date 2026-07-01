import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container flex-1 py-4 sm:py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
