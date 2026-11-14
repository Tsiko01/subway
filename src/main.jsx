import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { runtime } from './game/runtime'
import { useGame } from './game/store'
import { audio } from './game/audio'

// Dev-only handle for automated testing; stripped from production builds.
if (import.meta.env.DEV) window.__nocturne = { runtime, useGame, audio }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
