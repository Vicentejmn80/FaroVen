import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { searchProfiles, type DevProfileRow } from '@/services/dev-service'
import { useToast } from '@/store/toast-context'
import { timeAgo } from '@/lib/utils'

interface UserSearchInputProps {
  onSelect: (user: DevProfileRow) => void
}

export function UserSearchInput({ onSelect }: UserSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DevProfileRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const { showToast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const rows = await searchProfiles(q)
      setResults(rows)
    } catch {
      showToast('Error al buscar usuarios', 'warning')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por nombre, correo o ID..."
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-10 text-sm text-ink outline-none focus:border-info/60"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
              setOpen(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-subtle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <GlassCard className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto p-1">
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                onSelect(user)
                setOpen(false)
                setQuery(user.full_name || user.email)
              }}
              className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-white/[0.08]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{user.full_name || 'Sin nombre'}</p>
                <p className="truncate text-xs text-ink-subtle">{user.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-ink-subtle">{user.role ?? 'public'}</p>
                <p className="text-[11px] text-ink-faint">{timeAgo(new Date(user.created_at))}</p>
              </div>
            </button>
          ))}
        </GlassCard>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && (
        <GlassCard className="absolute z-50 mt-1 w-full p-3 text-center text-sm text-ink-muted">
          No se encontraron usuarios
        </GlassCard>
      )}
    </div>
  )
}
