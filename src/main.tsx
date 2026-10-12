import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createAppDeps } from './app/deps'
import { App } from './ui/App'
import './ui/App.css'

const container = document.getElementById('root')
if (!container) throw new Error('BloKade could not find its #root element')

// Created outside React so StrictMode never starts two geometry workers.
const deps = createAppDeps()

createRoot(container).render(
  <StrictMode>
    <App deps={deps} />
  </StrictMode>,
)
