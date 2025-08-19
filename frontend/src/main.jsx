import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate } from 'react-router-dom'
import ScanPage from './pages/ScanPage'
import DocumentsPage from './pages/DocumentsPage'
import ChatPage from './pages/ChatPage'
import VisualizationsPage from './pages/VisualizationsPage'
import './styles.css'

function AppLayout() {
  const [theme, setTheme] = React.useState(() => localStorage.getItem('theme') || 'dark')
  React.useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <div>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-badge">R</span>
            <span>RAG‑Netscanner</span>
          </div>
          <nav className="nav">
            <NavLink to="/scan" className={({ isActive }) => isActive ? 'active' : undefined}>Scan</NavLink>
            <NavLink to="/database" className={({ isActive }) => isActive ? 'active' : undefined}>Database</NavLink>
            <NavLink to="/chat" className={({ isActive }) => isActive ? 'active' : undefined}>Chat</NavLink>
            <NavLink to="/visuals" className={({ isActive }) => isActive ? 'active' : undefined}>Visualizations</NavLink>
          </nav>
          <div className="spacer" />
          <button className="theme-toggle" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<ScanPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/database" element={<DocumentsPage />} />
          <Route path="/documents" element={<Navigate to="/database" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/visuals" element={<VisualizationsPage />} />
        </Routes>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  </React.StrictMode>
)


