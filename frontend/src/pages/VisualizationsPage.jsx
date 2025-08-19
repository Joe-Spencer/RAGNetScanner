import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

// Lightweight charts via chart.js + react wrapper
import { Pie, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

function humanSize(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  let b = Number(bytes)
  let i = 0
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(1)} ${units[i]}`
}

function topNCounts(map, n) {
  return Object.entries(map)
    .sort((a,b) => b[1] - a[1])
    .slice(0, n)
}

export default function VisualizationsPage() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
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

  const totalSize = useMemo(() => {
    return docs.reduce((acc, d) => acc + (Number(d.size_bytes) || 0), 0)
  }, [docs])

  const fileTypeSizes = useMemo(() => {
    const m = {}
    for (const d of docs) {
      const key = (d.file_type || 'unknown').split(';')[0]
      m[key] = (m[key] || 0) + (Number(d.size_bytes) || 0)
    }
    return m
  }, [docs])

  const projectSizes = useMemo(() => {
    const m = {}
    for (const d of docs) {
      const key = (d.project || '').trim() || '(none)'
      m[key] = (m[key] || 0) + (Number(d.size_bytes) || 0)
    }
    return m
  }, [docs])

  const contractorSizes = useMemo(() => {
    const m = {}
    for (const d of docs) {
      const key = (d.contractor || '').trim() || '(none)'
      m[key] = (m[key] || 0) + (Number(d.size_bytes) || 0)
    }
    return m
  }, [docs])

  const wordCounts = useMemo(() => {
    const stop = new Set(['the','a','an','and','or','of','to','in','for','on','at','by','with','is','it','this','that','from','as','are','be','was','were','not','but','we','you','they','their','our','your','i','he','she','them','his','her'])
    const m = {}
    for (const d of docs) {
      const text = (d.description || '').toLowerCase()
      const words = text.match(/[a-z0-9]+/g) || []
      for (const w of words) {
        if (stop.has(w)) continue
        m[w] = (m[w] || 0) + 1
      }
    }
    return m
  }, [docs])

  const fileTypePie = useMemo(() => {
    const entries = Object.entries(fileTypeSizes).sort((a,b) => b[1]-a[1])
    const labels = entries.map(([k]) => k)
    const data = entries.map(([,v]) => v)
    return {
      labels,
      datasets: [{
        label: 'Bytes',
        data,
        backgroundColor: labels.map((_, i) => `hsl(${(i*53)%360} 70% 60%)`),
        borderWidth: 1,
      }]
    }
  }, [fileTypeSizes])

  const topProjectsBar = useMemo(() => {
    const entries = topNCounts(projectSizes, 5)
    return {
      labels: entries.map(([k]) => k),
      datasets: [{
        label: 'Total Size (bytes)',
        data: entries.map(([,v]) => v),
        backgroundColor: 'hsl(210 70% 55%)',
      }]
    }
  }, [projectSizes])

  const topContractorsBar = useMemo(() => {
    const entries = topNCounts(contractorSizes, 5)
    return {
      labels: entries.map(([k]) => k),
      datasets: [{
        label: 'Total Size (bytes)',
        data: entries.map(([,v]) => v),
        backgroundColor: 'hsl(140 70% 55%)',
      }]
    }
  }, [contractorSizes])

  const topWordsBar = useMemo(() => {
    const entries = topNCounts(wordCounts, 5)
    return {
      labels: entries.map(([k]) => k),
      datasets: [{
        label: 'Frequency',
        data: entries.map(([,v]) => v),
        backgroundColor: 'hsl(12 80% 55%)',
      }]
    }
  }, [wordCounts])

  const modifiedTimeline = useMemo(() => {
    const buckets = {}
    for (const d of docs) {
      const ts = d.modified_at
      if (!ts) continue
      const day = String(ts).slice(0,10)
      buckets[day] = (buckets[day] || 0) + 1
    }
    const entries = Object.entries(buckets).sort((a,b) => a[0].localeCompare(b[0]))
    return {
      labels: entries.map(([k]) => k),
      datasets: [{
        label: 'Files Modified per Day',
        data: entries.map(([,v]) => v),
        backgroundColor: 'hsl(260 70% 55%)',
      }]
    }
  }, [docs])

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2 className="title">Database Visualizations</h2>
        {loading && <div className="muted">Loading…</div>}
        {error && <div style={{ color: 'salmon' }}>{error}</div>}
        <div className="muted" style={{ marginTop: 6 }}>
          <strong>Total size:</strong> {humanSize(totalSize)} ({totalSize.toLocaleString()} bytes) · <strong>Total files:</strong> {docs.length}
        </div>
      </div>
      <div className="grid grid-3">
        <div className="card"><h3 style={{ marginTop: 0 }}>File Types by Size</h3><Pie data={fileTypePie} /></div>
        <div className="card"><h3 style={{ marginTop: 0 }}>Top 5 Projects (by size)</h3><Bar data={topProjectsBar} options={{ plugins: { legend: { display: false } } }} /></div>
        <div className="card"><h3 style={{ marginTop: 0 }}>Top 5 Contractors (by size)</h3><Bar data={topContractorsBar} options={{ plugins: { legend: { display: false } } }} /></div>
        <div className="card"><h3 style={{ marginTop: 0 }}>Top 5 Descriptive Words</h3><Bar data={topWordsBar} options={{ plugins: { legend: { display: false } } }} /></div>
        <div className="card"><h3 style={{ marginTop: 0 }}>Files Modified Timeline</h3><Bar data={modifiedTimeline} options={{ plugins: { legend: { display: false } } }} /></div>
      </div>
    </div>
  )
}



