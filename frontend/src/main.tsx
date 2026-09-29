import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '@/App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

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
