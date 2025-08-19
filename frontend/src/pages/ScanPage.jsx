import React, { useState } from 'react'
import axios from 'axios'

export default function ScanPage() {
  const [directory, setDirectory] = useState('')
  const [contractor, setContractor] = useState('')
  const [project, setProject] = useState('')
  const [cutoff, setCutoff] = useState('')
  const [mode, setMode] = useState('concise')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const resp = await axios.post('/api/scan/', { directory, contractor, project, cutoff, mode })
      setResult(resp.data)
    } catch (err) {
      setResult({ error: err?.response?.data?.error || err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h2 className="title">Scan Directory</h2>
        <p className="muted">Point to a local folder. We will index readable files, summarize them, and create embeddings for semantic search.</p>
        <form onSubmit={submit} className="grid" style={{ gap: 12, maxWidth: 720 }}>
          <input placeholder="Directory path" value={directory} onChange={(e) => setDirectory(e.target.value)} />
          <div className="grid" style={{ gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <input placeholder="Contractor (optional)" value={contractor} onChange={(e) => setContractor(e.target.value)} />
            <input placeholder="Project (optional)" value={project} onChange={(e) => setProject(e.target.value)} />
          </div>
          <div className="grid" style={{ gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <input placeholder="Cutoff ISO date (optional)" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ width: 150 }}>Description mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
                <option value="creative">Creative</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={loading}>{loading ? 'Scanning…' : 'Start Scan'}</button>
            <button type="button" className="secondary" disabled={loading} onClick={() => { setDirectory(''); setContractor(''); setProject(''); setCutoff(''); }}>Clear</button>
          </div>
        </form>
      </div>
      {result && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Scan Result</h3>
          <pre>
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}


