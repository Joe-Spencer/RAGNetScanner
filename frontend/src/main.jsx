import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate } from 'react-router-dom'
import ScanPage from './pages/ScanPage'
import DocumentsPage from './pages/DocumentsPage'
import ChatPage from './pages/ChatPage'
import VisualizationsPage from './pages/VisualizationsPage'

function AppLayout() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>RAG-Netscanner</h1>
      <nav style={{ display: 'flex', gap: 12 }}>
        <NavLink to="/scan">Scan</NavLink>
        <NavLink to="/database">Database</NavLink>
        <NavLink to="/chat">Chat</NavLink>
        <NavLink to="/visuals">Visualizations</NavLink>
      </nav>
      <div style={{ marginTop: 16 }}>
        <Routes>
          <Route path="/" element={<ScanPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/database" element={<DocumentsPage />} />
          <Route path="/documents" element={<Navigate to="/database" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/visuals" element={<VisualizationsPage />} />
        </Routes>
      </div>
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


