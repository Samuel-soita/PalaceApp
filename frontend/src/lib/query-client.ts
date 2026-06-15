import { QueryClient } from '@tanstack/react-query';

/**
 * 🛰️ ENTERPRISE QUERY CLIENT - v2.4.0
 * Configured for high-fidelity offline persistence and thundering-herd prevention.
 */
const shouldRetryQuery = (failureCount: number, error: unknown) => {
  const status = (error as { response?: { status?: number }; code?: string })?.response?.status;
  const code = (error as { code?: string })?.code;
  if (status === 401 || code === 'SESSION_EXPIRED') return false;
  return failureCount < 2;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes fresh limit
      cacheTime: 1000 * 60 * 60 * 24, // 24 hours persistence window
      refetchOnWindowFocus: false,
      refetchOnReconnect: false, // 🚫 Never jitter on network return; user controls sync
      retry: shouldRetryQuery,
    },
    mutations: {
        retry: 0, // Handled by our custom PWA Sync Engine
    }
  }
});

export default queryClient;
