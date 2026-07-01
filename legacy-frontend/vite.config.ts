import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      // Punto de entrada principal + prototipos visuales aislados (no afectan la app actual).
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'prototype-v2': path.resolve(__dirname, 'prototype-v2.html'),
        'prototype-v3': path.resolve(__dirname, 'prototype-v3.html'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
