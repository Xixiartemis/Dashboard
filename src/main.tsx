import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ReferenceDashboardPage } from './reference/ReferenceDashboardPage'
const reference = window.location.pathname === '/codex-ui' || window.location.pathname === '/codex-ui/'
createRoot(document.getElementById('root')!).render(<StrictMode>{reference ? <ReferenceDashboardPage /> : <App />}</StrictMode>)