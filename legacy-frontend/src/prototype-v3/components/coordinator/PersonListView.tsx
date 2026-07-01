import { useEffect, useState } from 'react'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import {
  parsePersonListText,
  useBulkUpsertPersons,
  useSitePersons,
  useUploadPersonListPhoto,
  type PersonUpsertRow,
} from '@/hooks/usePersonRegistry'
import { STATUS_LABELS } from '@/lib/types'

type InputMode = 'paste' | 'photo'

interface PersonListViewProps {
  notify: (msg: string) => void
  onNeedSite: () => void
}

export function PersonListView({ notify, onNeedSite }: PersonListViewProps) {
  const { data: profile, isLoading } = useCoordinatorProfile()
  const siteType = profile?.site_type
  const isRegistrySite = siteType === 'hospital' || siteType === 'shelter'

  const { data: existingPersons, isLoading: loadingPersons } = useSitePersons(
    isRegistrySite ? siteType : undefined,
    profile?.site_id
  )
  const bulkUpsert = useBulkUpsertPersons()
  const uploadPhoto = useUploadPersonListPhoto()

  const [mode, setMode] = useState<InputMode>('paste')
  const [pasteText, setPasteText] = useState('')
  const [photoPasteText, setPhotoPasteText] = useState('')
  const [previewRows, setPreviewRows] = useState<PersonUpsertRow[]>([])
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    if (mode === 'paste') {
      setPreviewRows(parsePersonListText(pasteText))
    }
  }, [pasteText, mode])

  useEffect(() => {
    if (mode === 'photo') {
      setPreviewRows(parsePersonListText(photoPasteText))
    }
  }, [photoPasteText, mode])

  useEffect(() => {
    if (!selectedFile) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  if (isLoading) {
    return <p style={{ color: '#9aa3b2', fontSize: 13 }}>Cargando…</p>
  }

  if (!profile) {
    return (
      <div className="pv3-card">
        <p style={{ fontSize: 13, color: '#5f6373', margin: '0 0 12px' }}>
          Primero configura qué sitio coordinas.
        </p>
        <button type="button" className="pv3-btn pv3-btn--primary" onClick={onNeedSite}>
          Configurar mi sitio
        </button>
      </div>
    )
  }

  if (!isRegistrySite) {
    return (
      <p style={{ fontSize: 13, color: '#5f6373', margin: 0 }}>
        El registro de personas aplica solo a hospitales y refugios.
      </p>
    )
  }

  if (profile.onboarding_complete === false) {
    return (
      <p style={{ fontSize: 13, color: '#5f6373', margin: 0 }}>
        Completa tu registro de coordinador antes de publicar personas.
      </p>
    )
  }

  const updateRow = (index: number, field: keyof PersonUpsertRow, value: string) => {
    setPreviewRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const removeRow = (index: number) => {
    setPreviewRows((rows) => rows.filter((_, i) => i !== index))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setPhotoUrl(null)
  }

  const uploadSelectedPhoto = async () => {
    if (!selectedFile || !profile.site_id) return
    try {
      const url = await uploadPhoto.mutateAsync({
        siteType: siteType,
        siteId: profile.site_id,
        file: selectedFile,
      })
      setPhotoUrl(url)
      notify('Foto registrada como evidencia.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo subir la foto')
    }
  }

  const publish = async () => {
    if (previewRows.length === 0) {
      notify('Agrega al menos una persona a la lista.')
      return
    }
    const invalid = previewRows.some((r) => !r.first_name.trim())
    if (invalid) {
      notify('Cada fila necesita al menos un nombre.')
      return
    }

    try {
      const count = await bulkUpsert.mutateAsync({
        siteType,
        siteId: profile.site_id,
        rows: previewRows,
        evidenceUrl: photoUrl ?? undefined,
      })
      notify(`${count} persona${count === 1 ? '' : 's'} publicada${count === 1 ? '' : 's'} — ya aparecen en la búsqueda.`)
      setPasteText('')
      setPhotoPasteText('')
      setPreviewRows([])
      setSelectedFile(null)
      setPhotoUrl(null)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al publicar')
    }
  }

  const siteKind = siteType === 'hospital' ? 'hospital' : 'refugio'

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p style={{ fontSize: 13, color: '#5f6373', margin: 0 }}>
        Coordinando: <strong>{profile.site_name}</strong> ({siteKind})
      </p>

      <div className="pv3-person-list__existing">
        <p className="pv3-person-list__count">
          {loadingPersons
            ? 'Cargando personas registradas…'
            : `${existingPersons?.length ?? 0} persona${(existingPersons?.length ?? 0) === 1 ? '' : 's'} en este ${siteKind}`}
        </p>
        {existingPersons && existingPersons.length > 0 && (
          <ul className="pv3-person-list__existing-list">
            {existingPersons.slice(0, 8).map((p) => (
              <li key={p.id}>
                {p.first_name} {p.last_name}
                <span className="pv3-person-list__status">{STATUS_LABELS[p.status]}</span>
              </li>
            ))}
            {existingPersons.length > 8 && (
              <li className="pv3-person-list__more">… y {existingPersons.length - 8} más</li>
            )}
          </ul>
        )}
      </div>

      <div className="pv3-person-list__modes">
        <button
          type="button"
          className={`pv3-chip ${mode === 'paste' ? 'is-active' : ''}`}
          onClick={() => setMode('paste')}
        >
          Pegar lista
        </button>
        <button
          type="button"
          className={`pv3-chip ${mode === 'photo' ? 'is-active' : ''}`}
          onClick={() => setMode('photo')}
        >
          Foto de lista
        </button>
      </div>

      {mode === 'paste' && (
        <div>
          <label className="pv3-label">Pega una fila por persona</label>
          <p className="pv3-location-hint" style={{ margin: '4px 0 8px' }}>
            Formato: <code>Nombre Apellido</code> o CSV <code>Nombre, Apellido</code> (opcional: , estado)
          </p>
          <textarea
            className="pv3-input"
            style={{ minHeight: 120, resize: 'vertical' }}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'María González\nJuan,Pérez\nAna,López,safe'}
          />
        </div>
      )}

      {mode === 'photo' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label className="pv3-label">Foto de la lista (papel o pantalla)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="pv3-input"
              style={{ minHeight: 'auto', padding: 8 }}
              onChange={handleFileChange}
            />
          </div>

          {photoPreview && (
            <img src={photoPreview} alt="Vista previa" className="pv3-person-list__photo-preview" />
          )}

          {selectedFile && !photoUrl && (
            <button
              type="button"
              className="pv3-btn pv3-btn--primary"
              disabled={uploadPhoto.isPending}
              onClick={uploadSelectedPhoto}
            >
              {uploadPhoto.isPending ? 'Subiendo…' : 'Registrar foto'}
            </button>
          )}

          {photoUrl && (
            <p className="pv3-note" style={{ margin: 0 }}>
              La foto queda registrada; también puedes pegar los nombres extraídos abajo.
            </p>
          )}

          <div>
            <label className="pv3-label">Nombres (pegar manualmente)</label>
            <textarea
              className="pv3-input"
              style={{ minHeight: 90, resize: 'vertical' }}
              value={photoPasteText}
              onChange={(e) => setPhotoPasteText(e.target.value)}
              placeholder="Pega aquí los nombres que leas en la foto"
            />
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="pv3-person-list__preview">
          <p className="pv3-label" style={{ marginBottom: 8 }}>
            Vista previa ({previewRows.length})
          </p>
          <div className="pv3-person-list__table-wrap">
            <table className="pv3-person-list__table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Apellido</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        className="pv3-input pv3-person-list__cell-input"
                        value={row.first_name}
                        onChange={(e) => updateRow(i, 'first_name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="pv3-input pv3-person-list__cell-input"
                        value={row.last_name}
                        onChange={(e) => updateRow(i, 'last_name', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="pv3-input pv3-person-list__cell-input"
                        value={row.status}
                        onChange={(e) => updateRow(i, 'status', e.target.value)}
                      >
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="pv3-link-btn"
                        onClick={() => removeRow(i)}
                        aria-label="Quitar fila"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="pv3-btn pv3-btn--primary"
            style={{ marginTop: 12 }}
            disabled={bulkUpsert.isPending}
            onClick={publish}
          >
            {bulkUpsert.isPending ? 'Publicando…' : 'Confirmar y publicar'}
          </button>
        </div>
      )}
    </div>
  )
}

