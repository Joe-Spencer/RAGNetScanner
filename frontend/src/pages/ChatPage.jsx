import React, { useState } from 'react'
import axios from 'axios'

export default function ChatPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [contexts, setContexts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [k, setK] = useState(5)
  const [project, setProject] = useState('')
  const [contractor, setContractor] = useState('')

  const ask = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setAnswer('')
    setContexts([])
    try {
      const resp = await axios.post('/api/ask/', { question, k, project, contractor })
      setAnswer(resp.data.answer)
      setContexts(resp.data.contexts || [])
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2 className="title">RAG Chat</h2>
        <form onSubmit={ask} className="grid" style={{ gap: 10, gridTemplateColumns: '1fr auto' }}>
          <input style={{ gridColumn: '1 / span 2' }} placeholder="Ask a question about your data" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <div className="toolbar">
            <input placeholder="Project (optional)" value={project} onChange={(e) => setProject(e.target.value)} />
            <input placeholder="Contractor (optional)" value={contractor} onChange={(e) => setContractor(e.target.value)} />
            <input type="number" min={1} max={20} style={{ width: 120 }} title="Top K" value={k} onChange={(e) => setK(Number(e.target.value))} />
          </div>
          <button disabled={loading || !question}>{loading ? 'Asking…' : 'Ask'}</button>
        </form>
        {error && <div style={{ color: 'salmon', marginTop: 8 }}>{error}</div>}
      </div>

      {answer && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Answer</h3>
          <div style={{ whiteSpace: 'pre-wrap' }}>{answer}</div>
        </div>
      )}
      {contexts.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sources</h3>
          <ul>
            {contexts.map((c, i) => (
              <li key={i}>
                <strong>{c.file_name}</strong> (score {c.score.toFixed(2)})
                <div className="muted" style={{ fontSize: 12 }}>{c.preview}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}


