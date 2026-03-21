import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import PWAInstallBanner from './components/PWAInstallBanner'
import { registerSW } from 'virtual:pwa-register'
import { setUpdateSWCallback } from './hooks/usePWA'

// Register service worker and wire up update/offline-ready notifications
let updateSW: any = () => {};

if (import.meta.env.DEV) {
    // In development, aggressively unregister any existing service workers 
    // to prevent the "Offline" overlay from hijacking the UI.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.unregister();
                console.log('UNREGISTERED LEGACY SERVICE WORKER');
            }
        });
    }
} else {
    updateSW = registerSW({
        onNeedRefresh() {
            window.dispatchEvent(new Event('pwa-need-refresh'));
        },
        onOfflineReady() {
            window.dispatchEvent(new Event('pwa-offline-ready'));
        },
    });
}
setUpdateSWCallback(updateSW);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 15, // 15 seconds stale limit to absorb Live Websocket bursts
      cacheTime: 1000 * 60 * 5, // 5 minutes Garbage Collection time
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2
    }
  }
});

// Dark Holographic Theme with Strict Square Geometry
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4f8bff', light: '#8cb1ff' }, 
    secondary: { main: '#c175ff' },
    background: { default: '#0c0e14', paper: '#161925' },
    text: { primary: '#f8fafc', secondary: '#94a3b8' },
    divider: 'rgba(255,255,255,0.1)'
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 0 }, // STRICT SQUARE GEOMETRY
  components: {
    MuiButton: {
      styleOverrides: {
        root: { 
          borderRadius: '0px', 
          padding: '8px 16px',
          border: '1px solid rgba(255,255,255,0.1)' 
        },
        contained: { 
          background: 'rgba(79, 139, 255, 0.2)',
          boxShadow: 'none', 
          '&:hover': { 
            background: 'rgba(79, 139, 255, 0.4)',
            boxShadow: '0 0 15px rgba(79, 139, 255, 0.5)' 
          } 
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: { 
          borderRadius: '0px', 
          border: '1px solid var(--glass-border)'
        }
      }
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <QueryClientProvider client={queryClient}>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <AuthProvider>
                        <App />
                        <PWAInstallBanner />
                    </AuthProvider>
                </BrowserRouter>
            </QueryClientProvider>
        </ThemeProvider>
    </React.StrictMode>,
)

