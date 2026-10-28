import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isDemoSession } from './demo-session';

export default function DemoBanner() {
    const { user } = useAuth();
    const navigate = useNavigate();
    if (!user || !isDemoSession()) return null;

    // The login page ends the demo session; signing out here would let the route guard redirect first.
    const leave = (path: string) => navigate(path, { replace: true, state: { leaveDemo: true } });

    return (
        <Box
            role="status"
            sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1.5 },
                px: 1.5, py: 0.5, bgcolor: '#f59e0b', color: '#1f1300',
            }}
        >
            <Typography variant="caption" sx={{ fontWeight: 800, lineHeight: 1.3, textAlign: 'center' }}>
                DEMO MODE · {user.name} · sample data only
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" onClick={() => leave('/login?demo=1')} sx={{ color: 'inherit', fontWeight: 800, minHeight: 32, textTransform: 'none' }}>
                    Switch role
                </Button>
                <Button size="small" onClick={() => leave('/login')} sx={{ color: 'inherit', fontWeight: 800, minHeight: 32, textTransform: 'none', textDecoration: 'underline' }}>
                    Exit demo
                </Button>
            </Box>
        </Box>
    );
}
