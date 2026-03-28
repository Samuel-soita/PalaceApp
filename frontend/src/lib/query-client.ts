import { QueryClient } from '@tanstack/react-query';

/**
 * 🛰️ ENTERPRISE QUERY CLIENT - v2.4.0
 * Configured for high-fidelity offline persistence and thundering-herd prevention.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes fresh limit
      cacheTime: 1000 * 60 * 60 * 24, // 24 hours persistence window
      refetchOnWindowFocus: false,
      refetchOnReconnect: false, // 🚫 Never jitter on network return; user controls sync
      retry: 2,
    },
    mutations: {
        retry: 0, // Handled by our custom PWA Sync Engine
    }
  }
});

export default queryClient;
