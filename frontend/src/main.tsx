import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from '@/App';
import { queryClient } from '@/lib/queryClient';
import './index.css';

async function startFakeApiWhenEnabled(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_API_MOCKS !== 'true') return;
  const { startFakeApiInBrowser } = await import('@/mocks/browser');
  await startFakeApiInBrowser();
}

function renderApplication() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void startFakeApiWhenEnabled().finally(renderApplication);
