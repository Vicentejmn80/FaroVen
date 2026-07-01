import { Radio } from 'lucide-react'
import { useHomeFeed, type FeedItem } from '@/hooks/useHomeFeed'
import { timeAgo } from '@/lib/utils'

const NODE_COLOR: Record<FeedItem['kind'], string> = {
  need: '#dc2626',
  bulletin: '#2563eb',
  person: '#7c3aed',
}

interface ActivityFeedProps {
  limit?: number
}

export function ActivityFeed({ limit }: ActivityFeedProps) {
  const { data, isLoading } = useHomeFeed()
  const items = (data ?? []).slice(0, limit ?? 8)

  return (
    <section className="pv2-card">
      <div className="pv2-card__head">
        <span className="pv2-card__title">
          <Radio /> Actividad reciente
        </span>
      </div>
      <div className="pv2-card__body">
        {isLoading ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="pv2-skel" style={{ height: 44 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="pv2-empty">Sin actividad reciente registrada.</div>
        ) : (
          <div className="pv2-feed">
            {items.map((item) => (
              <div key={item.id} className="pv2-feed__item">
                <span className="pv2-feed__node" style={{ background: NODE_COLOR[item.kind] }} />
                <div className="pv2-feed__time">{timeAgo(item.timestamp)}</div>
                <div className="pv2-feed__headline">{item.headline}</div>
                {item.detail && <div className="pv2-feed__detail">{item.detail}</div>}
                {item.source && <div className="pv2-feed__src">Fuente · {item.source}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
