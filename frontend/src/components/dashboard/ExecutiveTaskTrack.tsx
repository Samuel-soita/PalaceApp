import React from 'react';
import { Box, Typography, Card, CardContent, Avatar, Chip, IconButton, Tooltip } from '@mui/material';
import { Calendar, Clock, MessageSquare, ChevronRight, Bookmark } from 'lucide-react';

interface Appointment {
    id: string;
    member: { name: string };
    target: { name: string; role: string };
    type: string;
    preferredDate: string;
    preferredTime: string;
    status: string;
    targetRole: string;
}

interface ExecutiveTaskTrackProps {
    appointments: Appointment[];
    onAction?: (item: Appointment) => void;
}

export const ExecutiveTaskTrack = ({ appointments, onAction }: ExecutiveTaskTrackProps) => {
    if (!appointments || appointments.length === 0) {
        return (
            <Box sx={{ py: 4, textAlign: 'center', opacity: 0.4 }}>
                <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2 }}>NO PENDING TASKS</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ position: 'relative' }}>
             <style>{`
                .executive-track {
                    display: flex;
                    gap: 16px;
                    overflow-x: auto;
                    padding-bottom: 12px;
                    scrollbar-width: thin;
                    scrollbar-color: var(--glass-border) transparent;
                }
                .executive-track::-webkit-scrollbar {
                    height: 4px;
                }
                .executive-task-card {
                    width: 280px;
                    flex-shrink: 0;
                    border-radius: 12px;
                    transition: all 0.2s ease;
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid var(--glass-border);
                }
                .executive-task-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: var(--primary);
                    transform: translateY(-4px);
                }
            `}</style>

            <Box className="executive-track">
                {appointments.map((appt) => (
                    <Card 
                        key={appt.id} 
                        className="executive-task-card"
                        onClick={() => onAction?.(appt)}
                        sx={{ cursor: 'pointer' }}
                    >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                                <Chip 
                                    label={appt.status} 
                                    size="small" 
                                    sx={{ 
                                        height: 18, fontSize: '0.6rem', fontWeight: 900,
                                        bgcolor: appt.status === 'PENDING' ? 'rgba(255,152,0,0.1)' : 'rgba(0,200,255,0.1)',
                                        color: appt.status === 'PENDING' ? 'orange' : 'var(--cyan)',
                                        border: '1px solid currentColor'
                                    }} 
                                />
                                <Bookmark size={14} opacity={0.3} />
                            </Box>
                            
                            <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'var(--primary)', fontSize: '0.8rem', fontWeight: 900 }}>
                                    {(appt.member?.name || 'U').charAt(0)}
                                </Avatar>
                                <Box>
                                    <Typography variant="body2" fontWeight="900" noWrap sx={{ maxWidth: 180 }}>
                                        {appt.member?.name || 'Unknown Member'}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary" fontWeight="700">
                                        Session: {appt.type}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1.5, mb: 1.5 }}>
                                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                    <Calendar size={12} color="var(--primary)" />
                                    <Typography variant="caption" fontWeight="800">
                                        {new Date(appt.preferredDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Clock size={12} color="var(--primary)" />
                                    <Typography variant="caption" fontWeight="800">
                                        {appt.preferredTime}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 900, fontSize: '0.62rem' }}>
                                    TARGET: {appt.targetRole}
                                </Typography>
                                <IconButton size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}>
                                    <ChevronRight size={14} />
                                </IconButton>
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Box>
        </Box>
    );
};
