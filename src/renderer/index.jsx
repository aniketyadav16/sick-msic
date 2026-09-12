import React from 'react';
import { createRoot } from 'react-dom/client';
import MusicApp from './MusicApp';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <MusicApp />
  </React.StrictMode>
);

