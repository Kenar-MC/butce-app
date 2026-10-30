import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { requestPersistentStorage } from './db/db'
import './index.css'
import { setupPWA } from './pwa'

void requestPersistentStorage()
setupPWA()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
