import { CommunicationHub } from '../dashboard/CommunicationHub';
import TopNavbar from './TopNavbar';
import AnnouncementBanner from '../AnnouncementBanner';
import { Box, Container } from '@mui/material';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
            <AnnouncementBanner />
            <TopNavbar />
            
            <Box component="main" sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
                <Container maxWidth="xl" sx={{ height: '100%' }}>
                    {children}
                </Container>
                <CommunicationHub />
            </Box>
        </Box>
    );
}
