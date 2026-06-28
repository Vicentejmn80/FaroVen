# API REST, SEGURIDAD, DESPLIEGUE Y MONITOREO

## 6. API REST

Supabase expone automáticamente una API RESTful desde PostgreSQL. Aquí están los endpoints clave:

### Endpoints Públicos (Visitante)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/rest/v1/rpc/search_person` | Buscar persona (nombre/apellido) |
| GET | `/rest/v1/hospitals?select=*` | Listar hospitales activos |
| GET | `/rest/v1/hospitals?id=eq.{id}&select=*` | Detalle hospital |
| GET | `/rest/v1/shelters?select=*` | Listar refugios activos |
| GET | `/rest/v1/supply_centers?select=*` | Listar centros de acopio |
| GET | `/rest/v1/needs?select=*` | Listar necesidades |
| POST | `/rest/v1/reports` | Crear reporte de error |

### Endpoints Protegidos (Voluntario)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/rest/v1/updates` | Crear actualización |
| POST | `/rest/v1/rpc/process_list` | Cargar lista (PDF/CSV) |
| POST | `/storage/v1/object/attachments/` | Subir archivo |
| PATCH | `/rest/v1/needs?id=eq.{id}` | Actualizar necesidad |

### Endpoints Protegidos (Admin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| PATCH | `/rest/v1/updates?id=eq.{id}` | Aprobar/rechazar cambio |
| DELETE | `/rest/v1/persons?id=eq.{id}` | Eliminar registro |
| GET | `/rest/v1/users?select=*` | Listar usuarios |
| PATCH | `/rest/v1/users?id=eq.{id}` | Modificar usuario |
| GET | `/rest/v1/audit_logs?select=*` | Ver historial |
| GET | `/rest/v1/rpc/get_dashboard_stats` | Stats del dashboard |

### Convención de Nombres

- **Tablas**: snake_case, plural (`persons`, `hospitals`)
- **Columnas**: snake_case (`first_name`, `updated_at`)
- **Funciones**: snake_case, prefijo según módulo (`search_person`)
- **Archivos**: kebab-case (`search-person.tsx`)
- **Componentes**: PascalCase (`SearchResult`)
- **Hooks**: camelCase, prefijo `use` (`useSearch`)
- **Tipos**: PascalCase (`PersonStatus`)
- **Enums**: snake_case, UPPERCASE en SQL; PascalCase en TS
- **Rutas**: lowercase, kebab-case (`/supply-centers`)
- **Endpoints**: snake_case (`search_person`)

## 7. Seguridad

### Rate Limiting

```sql
-- Tabla para rate limiting
CREATE TABLE rate_limits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  INET NOT NULL,
  endpoint    VARCHAR(255) NOT NULL,
  hits        INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limits_ip_window ON rate_limits(ip_address, endpoint, window_start);

-- Función: verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip INET,
  p_endpoint VARCHAR,
  p_max_hits INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  v_hits INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < now() - (p_window_minutes || ' minutes')::INTERVAL;

  INSERT INTO rate_limits (ip_address, endpoint, window_start)
  VALUES (p_ip, p_endpoint, now())
  ON CONFLICT ON CONSTRAINT ... DO UPDATE SET hits = rate_limits.hits + 1;

  SELECT hits INTO v_hits FROM rate_limits
  WHERE ip_address = p_ip AND endpoint = p_endpoint
  AND window_start > now() - (p_window_minutes || ' minutes')::INTERVAL;

  RETURN v_hits <= p_max_hits;
END;
$$ LANGUAGE plpgsql;
```

### Protección contra Spam

1. **hCaptcha/reCAPTCHA v3** en formulario de reportes
2. **Rate limiting por IP**: 30 requests/minuto para anónimos, 100 para autenticados
3. **Firma de tiempo**: los reportes tienen un cooldown de 60s entre envíos desde la misma IP
4. **Filtro de contenido**: las descripciones pasan por un bloqueador de palabras clave (XSS, SQLi)
5. **Moderación**: todos los reportes entran como `pending`, nunca modifican datos directamente

### Row Level Security (RLS) - Resumen

| Tabla | Visitante | Voluntario | Admin |
|-------|-----------|------------|-------|
| persons | SELECT (active only) | SELECT | ALL |
| hospitals | SELECT (active) | SELECT | ALL |
| shelters | SELECT (active) | SELECT | ALL |
| supply_centers | SELECT (active) | SELECT | ALL |
| needs | SELECT | SELECT, UPDATE | ALL |
| updates | - | INSERT, SELECT | ALL |
| reports | INSERT | SELECT, UPDATE | ALL |
| attachments | - | INSERT | ALL |
| audit_logs | - | - | ALL |
| users | - | - | ALL |

## 8. Versionado de Registros

Cada cambio pasa por el flujo:

```
Voluntario edita → UPDATE se crea con status=pending_review
                          │
                 Admin revisa
                      │
              ┌───────┴───────┐
              │               │
          approve         reject
              │               │
        Se aplica       Se descarta
        cambio en       update.status
        tabla real      = 'rejected'
        + audit_log
```

Los valores anteriores quedan preservados en `updates.old_value`.

## 9. Estrategia de Despliegue

```yaml
# vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.supabase.co" }
      ]
    }
  ]
}
```

### Pipeline CI/CD (GitHub Actions)

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 10. Estrategia de Backups

| Tipo | Frecuencia | Retención | Método |
|------|-----------|-----------|--------|
| Completo | Diario | 30 días | `pg_dump` + Supabase Backup |
| WAL | Continuo | 7 días | Point-in-Time Recovery |
| Lógico (tablas críticas) | Cada 6h | 14 días | Custom script via Edge Function |
| Storage | Diario | 7 días | Supabase Storage backup |

Script de backup programado en Supabase:

```sql
-- Via pg_cron (edge function)
SELECT cron.schedule(
  'nightly-backup',
  '0 3 * * *',
  $$ COPY (SELECT * FROM persons WHERE updated_at > now() - interval '24 hours')
     TO '/tmp/backups/persons_daily.sql' $$
);
```

## 11. Estrategia de Monitoreo

| Aspecto | Herramienta | Alertas |
|---------|------------|---------|
| Uptime | Vercel Analytics + Uptime Robot | >99.9% |
| Errores 5xx | Vercel + Sentry | >0.1% |
| Latencia de búsqueda | Vercel Web Analytics | >2s |
| Conexiones DB | Supabase Dashboard | >80% |
| Storage usado | Supabase Dashboard | >80% |
| Rate limiting hits | Edge Function log | Threshold exceeded |
| Intentos fallidos auth | Supabase Auth | >5/min desde misma IP |
| Duplicados detectados | IA Edge Function | Nuevos duplicados encontrados |

### Logs y Alertas

- **Error tracking**: Sent.io (gratuito para proyectos open source / emergencias)
- **Logs de DB**: Supabase Logs (consulta vía SQL)
- **Alertas**: Slack webhook + correo a admins
- **Dashboard interno**: Ruta `/admin/logs` con tabla paginada desde `audit_logs`

## 12. IA — Edge Functions

```typescript
// supabase/functions/ocr-process/index.ts
import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { filePath, fileType } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Descargar archivo de Storage
  const { data: file } = await supabase.storage
    .from('attachments')
    .download(filePath)

  // 2. OCR según tipo
  let text = ''
  if (fileType === 'application/pdf') {
    // Llamar a API de OCR (Tesseract.js o Google Vision)
  } else {
    // OCR de imagen
  }

  // 3. Extraer nombres con regex
  const names = extractNames(text)

  // 4. Guardar resultados como sugerencia (no como registro)
  const { data } = await supabase.from('updates').insert({
    table_name: 'persons',
    status: 'pending_review',
    new_value: JSON.stringify(names),
    notes: 'AI OCR extraction - requires human review'
  })

  return new Response(JSON.stringify({ status: 'ok', names }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### Módulos de IA (Edge Functions)

| Función | Input | Output | Acción |
|---------|-------|--------|--------|
| `ocr-process` | Imagen/PDF | Lista de nombres | Crea `updates` pendientes |
| `detect-duplicates` | Nombre + lista | Pares con score >0.8 | Alerta al admin |
| `normalize-names` | Texto | Nombres normalizados | Sugerencia al voluntario |
| `compare-lists` | Dos listas (CSV) | Diferencias encontradas | Sugerencia al admin |
| `detect-changes` | `audit_logs` | Patrones anómalos | Alerta al admin |

TODOS los outputs de IA pasan por revisión humana antes de afectar la base de datos.
