import { CommunicationHub } from '../dashboard/CommunicationHub';
import TopNavbar from './TopNavbar';
import AnnouncementBanner from '../AnnouncementBanner';
import { Box, Container } from '@mui/material';
import { WelcomeSplash } from '../dashboard/WelcomeSplash';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [showSplash, setShowSplash] = useState(false);

    useEffect(() => {
        if (!user || user.role === 'WATUA') return;

        const splashShown = sessionStorage.getItem('welcome-splash-shown');

        if (!splashShown) {
            setShowSplash(true);
            sessionStorage.setItem('welcome-splash-shown', 'true');
        }
    }, [user]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default', position: 'relative' }}>
            {showSplash && (
                <Box sx={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
                    <WelcomeSplash onComplete={() => setShowSplash(false)} />
                </Box>
            )}
            
            <AnnouncementBanner />
            <TopNavbar />
            
            <Box component="main" sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
                <Container maxWidth="xl" sx={{ height: '100%' }}>
                    {children}
                </Container>
                {user?.role !== 'MEMBER' && <CommunicationHub />}
            </Box>
        </Box>
    );
}
