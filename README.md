# Operación Rescate

Plataforma ligera para consultar necesidades verificadas y que coordinadores en hospitales o centros de acopio actualicen datos en sitio.

## Estructura

- `frontend/` — app React + Vite (desplegar en Vercel)
- `supabase/migrations/` — SQL para Supabase SQL Editor

## Desarrollo local

```bash
cd frontend
cp .env.example .env
# Edita .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Vercel

1. Importa este repo en [vercel.com](https://vercel.com)
2. **Root Directory:** `frontend`
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. Variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. En Supabase → Authentication → URL Configuration, agrega tu URL de Vercel en Redirect URLs

## Supabase

Ejecuta las migraciones en orden en SQL Editor (ver `supabase/README.md`).
