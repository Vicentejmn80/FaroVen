import { useSearchParams, Link } from 'react-router-dom'
import { SearchBar } from '@/components/search/search-bar'
import { SearchResultCard } from '@/components/search/search-result-card'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { useSearch } from '@/hooks/useSearch'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const first_name = searchParams.get('first_name') ?? undefined
  const last_name = searchParams.get('last_name') ?? undefined
  const hasQuery = !!first_name || !!last_name

  const { data: results, isLoading, error, refetch } = useSearch({ first_name, last_name })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg sm:text-xl font-bold mb-6">Buscar Persona</h1>

      <SearchBar />

      <div className="mt-8">
        {!hasQuery && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ingresa el nombre de la persona que buscas
          </p>
        )}

        {isLoading && <LoadingSpinner />}

        {error && (
          <ErrorMessage
            title="Error al buscar"
            message="No pudimos completar la búsqueda. Intenta de nuevo."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !error && hasQuery && results && (
          <>
            {results.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">
                  No se encontró información en las fuentes verificadas
                  disponibles hasta este momento.
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Fecha de consulta: {new Date().toLocaleString('es-MX')}
                </p>
                <Link
                  to="/report"
                  className="text-sm text-primary hover:underline"
                >
                  Reportar información de esta persona
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {results.length} resultado{results.length !== 1 ? 's' : ''}
                </p>
                {results.map((result) => (
                  <SearchResultCard key={result.id} result={result} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
