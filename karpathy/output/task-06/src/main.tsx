import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SignupForm } from './components/SignupForm';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element with id="root" not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <SignupForm />
    </main>
  </StrictMode>,
);
