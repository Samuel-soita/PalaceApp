import { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Paper, Slide, Stack, Chip, Button } from '@mui/material';
import { Bell, X } from 'lucide-react';
import api from '../lib/api-client';

interface PublicUpdate {
    id: string;
    title: string;
    type: 'EVENT' | 'PROJECT' | 'DEVOTION' | 'REQUEST';
    createdAt: string;
}

export default function PublicUpdateToast() {
    const [updates, setUpdates] = useState<PublicUpdate[]>([]);
    const [visible, setVisible] = useState(false);

    const fetchUpdates = async () => {
        try {
            // 🔓 Public fetch (No auth required)
            const res = await api.get('/public/notifications');
            const allUpdates: PublicUpdate[] = res.data;
            
            const viewedIds = JSON.parse(localStorage.getItem('viewed_update_ids') || '[]');
            const newUpdates = allUpdates.filter(u => !viewedIds.includes(u.id));
            
            if (newUpdates.length > 0) {
                setUpdates(newUpdates);
                // Delay showing to avoid layout pop on mount
                setTimeout(() => setVisible(true), 1500);
            } else {
                setVisible(false);
            }
        } catch (error) {
            console.error('[PublicUpdate] Fetch failed:', error);
        }
    };

    useEffect(() => {
        fetchUpdates();
        const interval = setInterval(fetchUpdates, 5 * 60 * 1000); // 5 minutes refresh
        return () => clearInterval(interval);
    }, []);

    const markAsSeen = (id: string | null) => {
        const viewedIds = JSON.parse(localStorage.getItem('viewed_update_ids') || '[]');
        if (id) {
            if (!viewedIds.includes(id)) viewedIds.push(id);
            setUpdates(prev => prev.filter(u => u.id !== id));
            if (updates.length <= 1) setVisible(false);
        } else {
            // Mark all current as seen (e.g. on dismissal)
            updates.forEach(u => {
                if (!viewedIds.includes(u.id)) viewedIds.push(u.id);
            });
            setUpdates([]);
            setVisible(false);
        }
        // Limit storage size
        localStorage.setItem('viewed_update_ids', JSON.stringify(viewedIds.slice(-100)));
    };

    if (updates.length === 0) return null;

    const latest = updates[0];

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'EVENT': return '#ff9800';
            case 'PROJECT': return '#2196f3';
            case 'DEVOTION': return '#4caf50';
            case 'REQUEST': return '#f44336';
            default: return 'primary.main';
        }
    };

    return (
        <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
            <Box sx={{ 
                position: 'fixed', 
                bottom: { xs: 80, sm: 32 }, // Higher on mobile if bottom nav exists
                left: { xs: 16, sm: 32 }, 
                zIndex: 9999,
                width: { xs: 'calc(100% - 32px)', sm: 320 }
            }}>
                <Paper elevation={24} sx={{ 
                    p: 2.5, 
                    bgcolor: 'rgba(15, 15, 15, 0.95)', 
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Glowing side bar */}
                    <Box sx={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '4px', 
                        height: '100%', 
                        bgcolor: getTypeColor(latest.type),
                        boxShadow: `0 0 15px ${getTypeColor(latest.type)}`
                    }} />
                    
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ 
                                bgcolor: 'rgba(255,255,255,0.05)', 
                                p: 0.8, 
                                borderRadius: 1.5, 
                                display: 'flex',
                                color: getTypeColor(latest.type)
                            }}>
                                <Bell size={14} />
                            </Box>
                            <Typography variant="caption" fontWeight="1000" sx={{ letterSpacing: 1.5, opacity: 0.6, fontSize: '0.6rem' }}>
                                SYSTEM FEED
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => markAsSeen(null)} sx={{ mt: -0.5, mr: -0.5, opacity: 0.4, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.05)' } }}>
                            <X size={16} />
                        </IconButton>
                    </Box>

                    <Typography variant="subtitle2" fontWeight="950" sx={{ mb: 1, lineHeight: 1.3, fontSize: '0.9rem' }}>
                        {latest.title}
                    </Typography>

                    <Box display="flex" alignItems="center" gap={1} mb={2.5}>
                        <Chip 
                            label={latest.type} 
                            size="small" 
                            sx={{ 
                                height: 18, 
                                fontSize: '0.55rem', 
                                fontWeight: 1000, 
                                bgcolor: `${getTypeColor(latest.type)}20`,
                                color: getTypeColor(latest.type),
                                border: `1px solid ${getTypeColor(latest.type)}40`,
                                borderRadius: 1
                            }} 
                        />
                        <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.65rem', fontWeight: 700 }}>
                            {new Date(latest.createdAt).toLocaleDateString()}
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1.5}>
                        <Button 
                            fullWidth 
                            size="small" 
                            variant="outlined" 
                            onClick={() => markAsSeen(latest.id)}
                            sx={{ 
                                fontSize: '0.65rem', 
                                fontWeight: 1000, 
                                borderRadius: 1.5, 
                                py: 1,
                                borderColor: 'rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.6)',
                                '&:hover': { borderColor: 'rgba(255,255,255,0.2)', bgcolor: 'transparent' }
                            }}
                        >
                            MARK SEEN
                        </Button>
                        <Button 
                            fullWidth 
                            size="small" 
                            variant="contained" 
                            href="/login"
                            sx={{ 
                                fontSize: '0.65rem', 
                                fontWeight: 1000, 
                                borderRadius: 1.5, 
                                py: 1,
                                bgcolor: getTypeColor(latest.type),
                                color: '#000',
                                '&:hover': { bgcolor: getTypeColor(latest.type), opacity: 0.9 }
                            }}
                        >
                            INTERACT
                        </Button>
                    </Stack>
                    
                    {updates.length > 1 && (
                        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed rgba(255,255,255,0.05)', textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.6rem', fontWeight: 900, letterSpacing: 0.5 }}>
                                {updates.length - 1} OTHER UNREAD NOTIFICATIONS
                            </Typography>
                        </Box>
                    )}
                </Paper>
            </Box>
        </Slide>
    );
}
