import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { armInstallPromptCapture } from './lib/installPrompt'
import { applyTheme } from './lib/theme'
import './index.css'
import App from './App.tsx'

armInstallPromptCapture()
applyTheme('system')
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
