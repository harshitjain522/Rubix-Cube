import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { warmSolver } from './store';
import './index.css';

// Kociemba's tables take a few seconds to build. Start now, in the worker, so
// they are ready long before anyone finishes painting a cube.
warmSolver();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
