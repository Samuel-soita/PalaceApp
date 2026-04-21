import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import PWAInstallBanner from './components/PWAInstallBanner'
import { registerSW } from 'virtual:pwa-register'
import { setUpdateSWCallback } from './hooks/usePWA'

if (import.meta.env.DEV || (window as any).Cypress) {
    import('./scripts/simulate-stress');
}

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
        immediate: true,
        onRegistered(r?: ServiceWorkerRegistration) {
            console.log('SW Registered for AutoUpdate');
            if (r) {
                setInterval(async () => {
                    if (navigator.onLine) {
                        try {
                            await r.update();
                        } catch (err) {
                            console.error('SW update check failed', err);
                        }
                    }
                }, 5 * 60 * 1000); // Check every 5 minutes
            }
        },
        onNeedRefresh() {
            // Force immediate reload to activate the new version
            window.location.reload();
        },
        onOfflineReady() {
            window.dispatchEvent(new Event('pwa-offline-ready'));
        },
    });
}
setUpdateSWCallback(updateSW);

const persister = createSyncStoragePersister({
  storage: window.localStorage,
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
            <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <AuthProvider>
                        <App />
                        <PWAInstallBanner />
                    </AuthProvider>
                </BrowserRouter>
            </PersistQueryClientProvider>
        </ThemeProvider>
    </React.StrictMode>,
)

