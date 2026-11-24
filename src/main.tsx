import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createAppDeps } from './app/deps'
import { App } from './ui/App'
import { applyTheme, themeStore } from './ui/theme-store'
import './ui/App.css'

const container = document.getElementById('root')
if (!container) throw new Error('BloKade could not find its #root element')

applyTheme(themeStore.getState().theme, themeStore.getState().color)
themeStore.subscribe((state) => applyTheme(state.theme, state.color))

// Created outside React so StrictMode never starts two geometry workers.
const deps = createAppDeps()

createRoot(container).render(
  <StrictMode>
    <App deps={deps} />
  </StrictMode>,
)
