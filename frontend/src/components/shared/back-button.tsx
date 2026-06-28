import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function BackButton() {
  const navigate = useNavigate()
  return (
    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
      ← Volver
    </Button>
  )
}
