import React, { useState, useRef } from 'react';
import { Box, Typography, Chip, IconButton, Modal, Backdrop, Fade } from '@mui/material';
import { AlertCircle, AlertTriangle, Info, Bell, X, Globe, Building2 } from 'lucide-react';

interface Announcement {
    id: string;
    title: string;
    content: string;
    priority: string;
    isGlobal: boolean;
    isMajor: boolean;
    status: string;
    createdAt: string;
    department?: { name: string };
    author?: { name: string };
}

interface BroadcastTrackProps {
    announcements: Announcement[];
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType; label: string }> = {
    URGENT: {
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.08)',
        border: 'rgba(239,68,68,0.35)',
        icon: AlertCircle,
        label: 'URGENT'
    },
    HIGH: {
        color: '#f97316',
        bg: 'rgba(249,115,22,0.08)',
        border: 'rgba(249,115,22,0.35)',
        icon: AlertTriangle,
        label: 'HIGH'
    },
    NORMAL: {
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.08)',
        border: 'rgba(59,130,246,0.35)',
        icon: Bell,
        label: 'NORMAL'
    },
    LOW: {
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.08)',
        border: 'rgba(34,197,94,0.35)',
        icon: Info,
        label: 'INFO'
    },
};

export const BroadcastTrack = React.memo(({ announcements }: BroadcastTrackProps) => {
    const [selected, setSelected] = useState<Announcement | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    if (!announcements || announcements.length === 0) {
        return (
            <Box sx={{ py: 6, textAlign: 'center', opacity: 0.4 }}>
                <Typography variant="body2" fontWeight="800" sx={{ letterSpacing: 2 }}>NO ACTIVE BROADCASTS</Typography>
            </Box>
        );
    }

    const looped = [...announcements, ...announcements];
    const pause = () => { if (trackRef.current) trackRef.current.style.animationPlayState = 'paused'; };
    const resume = () => { if (trackRef.current) trackRef.current.style.animationPlayState = 'running'; };

    const handleClick = (item: Announcement) => { pause(); setSelected(item); };
    const handleClose = () => { setSelected(null); resume(); };

    return (
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
            <style>{`
                @keyframes broadcastSlide {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .broadcast-track {
                    display: flex;
                    gap: 18px;
                    width: max-content;
                    animation: broadcastSlide ${Math.max(25, announcements.length * 5)}s linear infinite;
                    will-change: transform;
                }
                .broadcast-card {
                    width: 240px;
                    flex-shrink: 0;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                }
                .broadcast-card:hover { transform: translateY(-5px) scale(1.02); }
                .broadcast-card:active { transform: scale(0.97); }
            `}</style>

            <Box sx={{ overflow: 'hidden', py: 2 }}>
                <Box
                    ref={trackRef}
                    className="broadcast-track"
                    onMouseEnter={pause}
                    onMouseLeave={resume}
                    onTouchStart={pause}
                >
                    {looped.map((item, idx) => {
                        const cfg = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.NORMAL;
                        const Icon = cfg.icon;
                        return (
                            <Box
                                key={`${item.id}-${idx}`}
                                className="broadcast-card"
                                onClick={() => handleClick(item)}
                                sx={{
                                    bgcolor: cfg.bg,
                                    border: `1px solid ${cfg.border}`,
                                    boxShadow: `0 4px 18px rgba(0,0,0,0.25), 0 0 14px ${cfg.bg}`,
                                    p: 2,
                                    minHeight: 130,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.8,
                                }}
                            >
                                {/* Priority badge + scope */}
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Box display="flex" alignItems="center" gap={0.7}>
                                        <Icon size={12} color={cfg.color} />
                                        <Typography variant="caption" fontWeight="950"
                                            sx={{ color: cfg.color, letterSpacing: 1.2, fontSize: '0.58rem' }}>
                                            {cfg.label}
                                        </Typography>
                                    </Box>
                                    {item.isGlobal
                                        ? <Globe size={12} color={cfg.color} opacity={0.7} />
                                        : <Building2 size={12} color={cfg.color} opacity={0.7} />}
                                </Box>

                                {/* Title with left bar */}
                                <Box sx={{ borderLeft: `3px solid ${cfg.color}`, pl: 1.5, mt: 0.3 }}>
                                    <Typography variant="body2" fontWeight="950"
                                        sx={{ fontSize: '0.85rem', lineHeight: 1.3,
                                              display: '-webkit-box', WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {item.title}
                                    </Typography>
                                </Box>

                                {/* Footer */}
                                <Box sx={{ mt: 'auto' }}>
                                    <Typography variant="caption" fontWeight="700"
                                        sx={{ opacity: 0.5, fontSize: '0.62rem' }}>
                                        {item.department?.name || 'CHURCH-WIDE'} · {new Date(item.createdAt).toLocaleDateString()}
                                    </Typography>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* Detail Modal */}
            <Modal open={!!selected} onClose={handleClose} closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{ sx: { backdropFilter: 'blur(12px)', bgcolor: 'rgba(0,0,0,0.88)' } }}>
                <Fade in={!!selected}>
                    <Box sx={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: { xs: '92%', sm: 400 },
                        borderRadius: 3, overflow: 'hidden', outline: 'none',
                        boxShadow: '0 0 60px rgba(0,0,0,0.9)'
                    }}>
                        {selected && (() => {
                            const cfg = PRIORITY_CONFIG[selected.priority] ?? PRIORITY_CONFIG.NORMAL;
                            const Icon = cfg.icon;
                            return (
                                <Box>
                                    <Box sx={{
                                        p: 2.5,
                                        background: `linear-gradient(135deg, ${cfg.color}22 0%, ${cfg.color}08 100%)`,
                                        borderBottom: `1px solid ${cfg.border}`,
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Box sx={{ p: 0.8, borderRadius: 1.5, bgcolor: `${cfg.color}22`, display: 'flex' }}>
                                                <Icon size={16} color={cfg.color} />
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" fontWeight="950"
                                                    sx={{ color: cfg.color, letterSpacing: 1.5, fontSize: '0.62rem', display: 'block' }}>
                                                    {cfg.label} BROADCAST
                                                </Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.6rem' }}>
                                                    {selected.isGlobal ? 'Church-Wide' : selected.department?.name}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
                                            <X size={18} />
                                        </IconButton>
                                    </Box>
                                    <Box sx={{ p: 3, bgcolor: 'background.paper', borderLeft: `4px solid ${cfg.color}` }}>
                                        <Typography variant="h6" fontWeight="950" sx={{ mb: 2, lineHeight: 1.2 }}>
                                            {selected.title}
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary" fontWeight="700"
                                            sx={{ display: 'block', mb: 2 }}>
                                            BY {selected.author?.name?.toUpperCase() || 'LEADERSHIP'} · {new Date(selected.createdAt).toLocaleDateString()}
                                        </Typography>
                                        <Box sx={{ p: 1.5, bgcolor: `${cfg.color}08`, borderRadius: 2, border: `1px solid ${cfg.border}` }}>
                                            <Typography variant="body2" sx={{ lineHeight: 1.6, opacity: 0.85 }}>
                                                {selected.content}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            );
                        })()}
                    </Box>
                </Fade>
            </Modal>
        </Box>
    );
});
