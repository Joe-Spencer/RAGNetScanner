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
    <div>
      <h2>Scan Directory</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 600 }}>
        <input placeholder="Directory path" value={directory} onChange={(e) => setDirectory(e.target.value)} />
        <input placeholder="Contractor (optional)" value={contractor} onChange={(e) => setContractor(e.target.value)} />
        <input placeholder="Project (optional)" value={project} onChange={(e) => setProject(e.target.value)} />
        <input placeholder="Cutoff ISO date (optional)" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label>Description mode:</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
            <option value="creative">Creative</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Scanning...' : 'Start Scan'}</button>
      </form>
      {result && (
        <pre style={{ marginTop: 12, background: '#f6f8fa', padding: 12, overflow: 'auto' }}>
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}


