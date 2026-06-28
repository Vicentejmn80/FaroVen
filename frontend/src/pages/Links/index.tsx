import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { APP_NAME } from '@/lib/constants'
import { copyToClipboard, getShareUrl } from '@/lib/utils'

const links = [
  { label: 'Consultar información', href: '/consultar', icon: '🔍', primary: true },
  { label: 'Necesidades ahora', href: '/needs', icon: '⚡' },
  { label: 'Dónde llevar ayuda', href: '/', icon: '✅' },
  { label: 'Reportar error', href: '/report', icon: '⚠' },
  { label: 'Soy coordinador en sitio', href: '/auth?redirect=/volunteer', icon: '🛠' },
]

export function LinksPage() {
  const [copied, setCopied] = useState(false)
  const shareUrl = getShareUrl('/')

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleInstall = () => {
    window.location.href = '/'
  }

  return (
    <div className="max-w-md mx-auto py-8 px-2">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">⚠</div>
        <h1 className="text-xl font-bold">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Enlace oficial para consultar y coordinar ayuda verificada
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {links.map((item) => (
          <Link key={item.href + item.label} to={item.href}>
            <Card className={`hover:bg-accent transition-colors ${item.primary ? 'border-primary/30' : ''}`}>
              <CardContent className="py-4 flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        <Button className="w-full" onClick={handleCopy}>
          {copied ? 'Enlace copiado ✓' : 'Copiar enlace para WhatsApp / Instagram'}
        </Button>
        <Button variant="outline" className="w-full" onClick={handleInstall}>
          Abrir como app (guardar en inicio)
        </Button>
      </div>

      <Card className="mt-6">
        <CardContent className="py-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground text-sm">Cómo usarlo en Instagram</p>
          <p>1. Crea perfil: <strong>@operacionrescate.ve</strong> (o similar).</p>
          <p>2. En “Enlace en bio”, pega: <code className="text-foreground">{shareUrl.replace('https://', '')}</code></p>
          <p>3. Publica 1 story al día con “link en bio” + captura del boletín verificado.</p>
          <p>4. No repostees todo: solo cambios confirmados con fuente y hora.</p>
        </CardContent>
      </Card>
    </div>
  )
}
