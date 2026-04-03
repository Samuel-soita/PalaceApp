import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function NetworkStatusBanner() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed bottom-0 left-0 w-full bg-red-900/90 text-white z-50 overflow-hidden font-mono shadow-[0_-5px_20px_rgba(220,38,38,0.3)]">
            <div className="animate-[stripes_1s_linear_infinite] bg-[linear-gradient(45deg,rgba(0,0,0,0.2)25%,transparent_25%,transparent_50%,rgba(0,0,0,0.2)50%,rgba(0,0,0,0.2)75%,transparent_75%,transparent)] bg-[length:40px_40px] absolute inset-0 opacity-20 pointer-events-none"></div>
            
            <div className="relative z-10 mx-auto max-w-7xl px-4 py-2 flex items-center justify-center space-x-3 text-sm">
                <WifiOff className="h-5 w-5 animate-pulse text-red-300" />
                <span className="tracking-widest font-bold">SYSTEM OFFLINE:</span>
                <span className="text-red-200">Operating on local cache. Actions will sync automatically upon reconnection.</span>
            </div>
        </div>
    );
}
