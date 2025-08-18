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
    <div>
      <h2>RAG Chat</h2>
      <form onSubmit={ask} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto', alignItems: 'center', maxWidth: 900 }}>
        <input style={{ gridColumn: '1 / span 2' }} placeholder="Ask a question about your data" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Project (optional)" value={project} onChange={(e) => setProject(e.target.value)} />
          <input placeholder="Contractor (optional)" value={contractor} onChange={(e) => setContractor(e.target.value)} />
          <input type="number" min={1} max={20} style={{ width: 80 }} title="Top K" value={k} onChange={(e) => setK(Number(e.target.value))} />
        </div>
        <button disabled={loading || !question}>{loading ? 'Asking...' : 'Ask'}</button>
      </form>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      {answer && (
        <div style={{ marginTop: 12 }}>
          <h3>Answer</h3>
          <div style={{ whiteSpace: 'pre-wrap' }}>{answer}</div>
        </div>
      )}
      {contexts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3>Sources</h3>
          <ul>
            {contexts.map((c, i) => (
              <li key={i}>
                <strong>{c.file_name}</strong> (score {c.score.toFixed(2)})
                <div style={{ fontSize: 12, color: '#555' }}>{c.preview}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}


