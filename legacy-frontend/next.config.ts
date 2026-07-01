import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Scope Next route discovery to `.next.*` files only, so legacy `src/pages`
  // (used by Vite + React Router) is ignored during App Router builds.
  pageExtensions: ['next.tsx', 'next.ts', 'next.jsx', 'next.js'],
  outputFileTracingRoot: process.cwd(),
  eslint: {
    // Temporary while Vite `src/pages` coexists during migration.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporary while Vite `src/pages` coexists during migration.
    ignoreBuildErrors: true,
  },
}

export default nextConfig
