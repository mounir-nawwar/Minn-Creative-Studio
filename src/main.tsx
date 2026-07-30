import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import App from './App.tsx';
import './styles/design.tokens.css';
import './index.css';

// One client for the whole app, created at module scope so it survives re-renders.
// v5 defaults `refetchIntervalInBackground` to false, so every `refetchInterval`
// poll auto-pauses when the tab is hidden — the core win of this migration.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 3000,
      retry: 1,
      gcTime: 5 * 60 * 1000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
