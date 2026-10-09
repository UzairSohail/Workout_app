import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initDb } from './db';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';

// Pick up new versions on the first open instead of the second: check when the app comes back to the
// foreground (home-screen apps resume rather than reload), and the plugin reloads once the update is in.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  },
});

initDb().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
