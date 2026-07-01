import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SEARCH_MIN_LENGTH } from '@/lib/constants'

export function SearchBar() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const query = new URLSearchParams()
      if (firstName.trim()) query.set('first_name', firstName.trim())
      if (lastName.trim()) query.set('last_name', lastName.trim())

      if (firstName.trim().length >= SEARCH_MIN_LENGTH || lastName.trim().length >= SEARCH_MIN_LENGTH) {
        navigate(`/search?${query.toString()}`)
      }
    },
    [firstName, lastName, navigate]
  )

  const isValid = firstName.trim().length >= SEARCH_MIN_LENGTH || lastName.trim().length >= SEARCH_MIN_LENGTH

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="first_name" className="label mb-1.5 block">
            Nombre(s)
          </label>
          <Input
            id="first_name"
            type="text"
            placeholder="Ej: María"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="last_name" className="label mb-1.5 block">
            Apellido(s)
          </label>
          <Input
            id="last_name"
            type="text"
            placeholder="Ej: García"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>
      </div>
      <Button type="submit" size="lg" disabled={!isValid} className="w-full">
        🔍 Buscar
      </Button>
      {!isValid && (
        <p className="text-xs text-muted-foreground text-center">
          Ingresa al menos {SEARCH_MIN_LENGTH} letras para buscar
        </p>
      )}
    </form>
  )
}
