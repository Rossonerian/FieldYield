import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { ThemeProvider } from '@/context/ThemeContext';
import '@/styles.css';

const root = document.getElementById('root');

if (!root) throw new Error('FieldYield root element was not found.');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider><App /></ThemeProvider>
  </StrictMode>,
);
