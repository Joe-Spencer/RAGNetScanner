import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function DocumentsPage() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const resp = await axios.get('/api/documents/')
        setDocs(resp.data.results || [])
      } catch (e) {
        setError(e?.response?.data?.error || e.message)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const refresh = async () => {
    try {
      const resp = await axios.get('/api/documents/', { params: { q: query || undefined } })
      setDocs(resp.data.results || [])
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }

  const onSearch = async (e) => {
    e.preventDefault()
    await refresh()
  }

  const exportDb = async () => {
    setBusy(true)
    setError('')
    try {
      const resp = await axios.get('/api/export/')
      const data = resp.data || {}
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'database-export.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setBusy(false)
    }
  }

  const importDbFromFile = async (file) => {
    if (!file) return
    setBusy(true)
    setImporting(true)
    setError('')
    try {
      const text = await file.text()
      let json
      try {
        json = JSON.parse(text)
      } catch (e) {
        throw new Error('Invalid JSON file')
      }
      const body = json && json.data ? json : { data: Array.isArray(json) ? json : [] }
      const resp = await axios.post('/api/import/', body)
      await refresh()
      alert(`Import complete. Created ${resp.data.created}, Updated ${resp.data.updated}, Chunks ${resp.data.chunks_written ?? resp.data.chunks}`)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setBusy(false)
      setImporting(false)
    }
  }

  const clearDb = async () => {
    if (!confirm('This will permanently delete all documents and chunks. Are you sure?')) return
    setBusy(true)
    setError('')
    try {
      await axios.post('/api/clear/', {})
      await refresh()
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setBusy(false)
    }
  }

  const copyPath = async (path) => {
    try { await navigator.clipboard.writeText(path) } catch {}
  }

  const toCsv = (rows) => {
    const header = ['Name','Description','Type','Project','Contractor','Modified','Size','Path']
    const escape = (s) => '"' + String(s ?? '').replaceAll('"','""') + '"'
    const lines = [header.join(',')]
    for (const d of rows) {
      lines.push([
        escape(d.file_name),
        escape(d.description),
        escape(d.file_type),
        escape(d.project),
        escape(d.contractor),
        escape(d.modified_at),
        String(d.size_bytes ?? ''),
        escape(d.file_path),
      ].join(','))
    }
    return lines.join('\n')
  }

  const exportCsv = () => {
    const blob = new Blob([toCsv(docs)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'database.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2 className="title">Database</h2>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <form onSubmit={onSearch} className="toolbar" style={{ flex: 1 }}>
            <input placeholder="Search name, description, project, contractor" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="submit" className="secondary">Search</button>
          </form>
          <button onClick={exportDb} disabled={busy} className="secondary">Export</button>
          <label className="secondary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '8px 12px', borderRadius: 10 }}>
            <input type="file" accept="application/json" onChange={(e) => importDbFromFile(e.target.files?.[0])} disabled={busy || importing} />
            <span>{importing ? 'Importing…' : 'Import JSON'}</span>
          </label>
          <button onClick={exportCsv} disabled={busy} className="secondary">Export CSV</button>
          <button onClick={clearDb} disabled={busy} className="danger">Clear All</button>
        </div>
        {loading && <div className="muted" style={{ marginTop: 8 }}>Loading…</div>}
        {error && <div style={{color:'salmon', marginTop: 8}}>{error}</div>}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Type</th>
              <th>Project</th>
              <th>Contractor</th>
              <th>Modified</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id}>
                <td title={d.file_path}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>{d.file_name}</span>
                    <button onClick={() => copyPath(d.file_path)} className="secondary" style={{ padding: '6px 8px' }}>Copy Path</button>
                  </div>
                </td>
                <td style={{maxWidth: 500}}>{d.description}</td>
                <td>{d.file_type}</td>
                <td>{d.project}</td>
                <td>{d.contractor}</td>
                <td>{d.modified_at}</td>
                <td>{d.size_bytes?.toLocaleString?.() ?? d.size_bytes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


