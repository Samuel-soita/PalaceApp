import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api-client';
import { Box, Typography } from '@mui/material';
import { AlertTriangle, Info } from 'lucide-react';

export default function AnnouncementBanner() {
    const { data: globalAnnouncements } = useQuery(['global-announcements'], async () => {
        const res = await api.get('/announcements?isGlobal=true');
        return res.data.data || [];
    });

    if (!globalAnnouncements || globalAnnouncements.length === 0) return null;

    return (
        <Box sx={{
            width: '100%',
            height: 40,
            bgcolor: 'primary.dark',
            borderBottom: '1px solid var(--primary-glow)',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1100,
            backdropFilter: 'blur(10px)',
            background: 'linear-gradient(90deg, #0f172a, #1e293b, #0f172a)'
        }}>
            <div className="marquee-content" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4rem',
                whiteSpace: 'nowrap',
                animation: 'marquee 30s linear infinite',
                paddingLeft: '100%'
            }}>
                {globalAnnouncements.map((ann: any) => (
                    <Box key={ann.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {ann.priority === 'HIGH' ? (
                            <AlertTriangle size={16} className="text-red-500 animate-pulse" />
                        ) : (
                            <Info size={16} className="text-primary" />
                        )}
                        <Typography variant="body2" sx={{
                            fontWeight: 800,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: ann.priority === 'HIGH' ? 'error.light' : 'primary.light'
                        }}>
                            {ann.title}:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, opacity: 0.9 }}>
                            {ann.content}
                        </Typography>
                    </Box>
                ))}
            </div>

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                .marquee-content:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </Box>
    );
}
