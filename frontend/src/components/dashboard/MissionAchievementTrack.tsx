import React from 'react';
import { Box, Typography, Card, CardContent, Avatar, Chip, Tooltip } from '@mui/material';
import { Award, CheckCircle, Droplet, Baby, Star, Calendar } from 'lucide-react';

interface Achievement {
    id: string;
    name: string;
    type: 'BAPTISM' | 'DEDICATION';
    date: string;
    department?: string;
}

interface MissionAchievementTrackProps {
    baptisms: any[];
    children: any[];
}

export const MissionAchievementTrack = ({ baptisms, children }: MissionAchievementTrackProps) => {
    const completedBaptisms = baptisms
        .filter((b: any) => b.status === 'COMPLETED')
        .map((b: any) => ({
            id: b.id,
            name: b.user.name,
            type: 'BAPTISM' as const,
            date: b.updatedAt,
            department: b.user.department?.name
        }));

    const dedicatedChildren = children
        .filter((c: any) => c.workflowStatus === 'DEDICATED')
        .map((c: any) => ({
            id: c.id,
            name: c.name,
            type: 'DEDICATION' as const,
            date: c.updatedAt,
            department: c.department?.name
        }));

    const achievements: Achievement[] = [...completedBaptisms, ...dedicatedChildren]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    if (achievements.length === 0) {
        return (
            <Box sx={{ py: 4, textAlign: 'center', opacity: 0.4 }}>
                <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: 2 }}>NO RECENT ACHIEVEMENTS</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ position: 'relative' }}>
            <style>{`
                .achievement-track {
                    display: flex;
                    gap: 16px;
                    overflow-x: auto;
                    padding-bottom: 12px;
                    scrollbar-width: thin;
                    scrollbar-color: var(--glass-border) transparent;
                }
                .achievement-track::-webkit-scrollbar {
                    height: 4px;
                }
                .achievement-card {
                    width: 240px;
                    flex-shrink: 0;
                    border-radius: 12px;
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
                    border: 1px solid rgba(34, 197, 94, 0.2);
                    transition: all 0.2s ease;
                }
                .achievement-card:hover {
                    border-color: #22c55e;
                    transform: scale(1.02);
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
                }
            `}</style>

            <Box className="achievement-track">
                {achievements.map((item) => (
                    <Card key={`${item.type}-${item.id}`} className="achievement-card">
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box display="flex" justifyContent="space-between" mb={1.5}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    {item.type === 'BAPTISM' ? (
                                        <Droplet size={14} color="var(--cyan)" />
                                    ) : (
                                        <Baby size={14} color="var(--orange)" />
                                    )}
                                    <Typography variant="caption" fontWeight="950" sx={{ 
                                        color: item.type === 'BAPTISM' ? 'var(--cyan)' : 'var(--orange)',
                                        letterSpacing: 1, fontSize: '0.6rem'
                                    }}>
                                        {item.type}
                                    </Typography>
                                </Box>
                                <CheckCircle size={14} color="#22c55e" />
                            </Box>

                            <Typography variant="body2" fontWeight="900" noWrap mb={0.5}>
                                {item.name}
                            </Typography>
                            
                            <Box display="flex" alignItems="center" gap={1} mb={2} sx={{ opacity: 0.6 }}>
                                <Calendar size={10} />
                                <Typography variant="caption" fontWeight={700}>
                                    {new Date(item.date).toLocaleDateString()}
                                </Typography>
                            </Box>

                            <Box display="flex" justifyContent="space-between" alignItems="center" mt="auto">
                                <Box display="flex" alignItems="center" gap={0.5}>
                                    <Award size={10} color="#22c55e" />
                                    <Typography variant="caption" fontWeight="800" sx={{ fontSize: '0.55rem', opacity: 0.7 }}>
                                        COMPLETED
                                    </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ fontSize: '0.55rem', fontWeight: 900, opacity: 0.5 }}>
                                    {item.department?.split(' ')[0] || 'GLOBAL'}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Box>
        </Box>
    );
};
