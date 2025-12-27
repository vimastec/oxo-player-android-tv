import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTVNavigation } from './utils/tvNavigation'

// Initialiser la navigation TV (Samsung Tizen)
initTVNavigation();

// Fallback focus pour vieilles TV (Tizen 2014) qui ignorent tabindex sur div
// Cherche un élément marqué data-tv-auto-focus et lui donne le focus au démarrage.
setTimeout(() => {
  if (document.activeElement === document.body) {
    const el = document.querySelector('[data-tv-auto-focus]') as HTMLElement | null;
    el?.focus();
  }
}, 500);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
