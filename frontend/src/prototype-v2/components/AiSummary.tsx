import { Sparkles, ShieldCheck } from 'lucide-react'
import type { DailySummary } from '../lib/summary'

interface AiSummaryProps {
  summary: DailySummary
  loading: boolean
}

export function AiSummary({ summary, loading }: AiSummaryProps) {
  return (
    <section className="pv2-card pv2-ai">
      <div className="pv2-card__head">
        <span className="pv2-card__title">
          <Sparkles /> Resumen inteligente
        </span>
      </div>
      <div className="pv2-card__body">
        {loading ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="pv2-skel" style={{ height: 16 }} />
            <div className="pv2-skel" style={{ height: 16, width: '80%' }} />
            <div className="pv2-skel" style={{ height: 28, width: '60%' }} />
          </div>
        ) : (
          <>
            <p className="pv2-ai__line">{summary.headline}</p>

            {summary.topItems.length > 0 && (
              <div className="pv2-ai__items">
                {summary.topItems.map((item, i) => (
                  <span key={item.item} className="pv2-ai__pill">
                    <span className="pv2-ai__rank">{i + 1}</span>
                    {item.item}
                    {item.deficit > 0 && (
                      <em style={{ color: '#9aa3b2', fontStyle: 'normal' }}>
                        · faltan {item.deficit} {item.unit}
                      </em>
                    )}
                  </span>
                ))}
              </div>
            )}

            {summary.avgCoverage !== null && (
              <p className="pv2-ai__line" style={{ marginTop: 11, fontSize: 12.5, color: '#6b7686' }}>
                Cobertura promedio de las necesidades activas: {summary.avgCoverage}%.
                {summary.coveredCount > 0 &&
                  ` ${summary.coveredCount} ya están cerca de completarse.`}
              </p>
            )}

            <div className="pv2-ai__foot">
              <ShieldCheck size={13} />
              Resumen generado a partir de datos verificados. No se añade información externa.
            </div>
          </>
        )}
      </div>
    </section>
  )
}
