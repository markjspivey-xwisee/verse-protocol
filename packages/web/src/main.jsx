import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MultiverseExplorer from './MultiverseExplorer.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MultiverseExplorer />
  </StrictMode>
);
