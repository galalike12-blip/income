import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Disabled Service Worker to force-clear cache and fix "Unexpected state" errors
/*
if ('serviceWorker' in navigator) {
  // ...
}
*/

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
