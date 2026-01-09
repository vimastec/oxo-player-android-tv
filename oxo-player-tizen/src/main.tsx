import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initTizenApp } from './services/tizenApi';
import { registerTizenKeys } from './utils/tvNavigation';

// Initialiser l'app Tizen au démarrage
document.addEventListener('DOMContentLoaded', () => {
  // Initialiser les APIs Tizen
  initTizenApp();
  
  // Enregistrer les touches de la télécommande
  registerTizenKeys();
  
  // Render React App
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// Gérer la fermeture de l'app
window.addEventListener('unload', () => {
  console.log('OXO Player closing...');
});



