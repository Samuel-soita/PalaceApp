import React, { useState, useRef } from 'react';
import {
    Box, Typography, Chip, IconButton, Modal, Backdrop, Fade, Grid, Button
} from '@mui/material';
import { Calendar, MapPin, Clock, X, Briefcase, MessageSquare, Target, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

type ItemType = 'PROJECT' | 'EVENT' | 'PLAN' | 'MEETING';

interface OperationalItem {
    id: string;
    title: string;
    date: string;
    time?: string;
    location?: string;
    venue?: string;
    type: ItemType;
    status?: string;
    approvalStatus?: string;
    meetingStatus?: string;
    department?: { name: string };
    description?: string;
    agenda?: string;
    eventType?: string;
    deadline?: string;
}

interface OperationalTimelineProps {
    items: OperationalItem[];
    onEdit?: (item: OperationalItem) => void;
    onDelete?: (item: OperationalItem) => void;
}

// ── Color palette per entity type ─────────────────────────────────────────────
const TYPE_CONFIG: Record<ItemType, {
    label: string;
    icon: React.ElementType;
    color: string;       // hex accent
    glow: string;        // box-shadow glow
    bg: string;          // card background tint
    border: string;      // card border color
    chip: string;        // chip bg
}> = {
    PROJECT: {
        label: 'PROJECT',
        icon: Briefcase,
        color: '#9333ea',
        glow: '0 0 20px rgba(147,51,234,0.35)',
        bg: 'rgba(147,51,234,0.07)',
        border: 'rgba(147,51,234,0.35)',
        chip: '#9333ea',
    },
    EVENT: {
        label: 'EVENT',
        icon: Calendar,
        color: '#3b82f6',
        glow: '0 0 20px rgba(59,130,246,0.35)',
        bg: 'rgba(59,130,246,0.07)',
        border: 'rgba(59,130,246,0.35)',
        chip: '#3b82f6',
    },
    PLAN: {
        label: 'STRATEGIC PLAN',
        icon: Target,
        color: '#ec4899',
        glow: '0 0 20px rgba(236,72,153,0.35)',
        bg: 'rgba(236,72,153,0.07)',
        border: 'rgba(236,72,153,0.35)',
        chip: '#ec4899',
    },
    MEETING: {
        label: 'BRIEFING',
        icon: MessageSquare,
        color: '#06b6d4',
        glow: '0 0 20px rgba(6,182,212,0.35)',
        bg: 'rgba(6,182,212,0.07)',
        border: 'rgba(6,182,212,0.35)',
        chip: '#06b6d4',
    },
};

export const OperationalTimeline = ({ items, onEdit, onDelete }: OperationalTimelineProps) => {
    const [selectedItem, setSelectedItem] = useState<OperationalItem | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    if (!items || items.length === 0) {
        return (
            <Box sx={{ py: 6, textAlign: 'center', opacity: 0.4 }}>
                <Typography variant="body2" fontWeight="800" sx={{ letterSpacing: 2 }}>
                    NO OPERATIONAL DATA DETECTED
                </Typography>
            </Box>
        );
    }

    // Duplicate items for seamless marquee loop
    const looped = [...items, ...items];

    const pauseTrack = () => {
        if (trackRef.current) trackRef.current.style.animationPlayState = 'paused';
    };
    const resumeTrack = () => {
        if (trackRef.current) trackRef.current.style.animationPlayState = 'running';
    };

    const handleCardClick = (item: OperationalItem) => {
        pauseTrack();
        setSelectedItem(item);
    };

    const handleClose = () => {
        setSelectedItem(null);
        resumeTrack();
    };

    return (
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
            <style>{`
                @keyframes marqueeSlide {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .marquee-outer {
                    overflow: hidden;
                    padding: 20px 0;
                    cursor: grab;
                    -webkit-overflow-scrolling: touch;
                }
                .marquee-track {
                    display: flex;
                    gap: 20px;
                    width: max-content;
                    animation: marqueeSlide ${Math.max(100, items.length * 15)}s linear infinite;
                    will-change: transform;
                }
                .marquee-card {
                    width: 260px;
                    flex-shrink: 0;
                    cursor: pointer;
                    border-radius: 16px;
                    transition: transform 0.25s ease, box-shadow 0.25s ease;
                }
                .marquee-card:hover {
                    transform: translateY(-6px) scale(1.02);
                }
                .marquee-card:active {
                    transform: scale(0.97);
                }
            `}</style>

            <Box className="marquee-outer">
                <Box
                    ref={trackRef}
                    className="marquee-track"
                    onMouseEnter={pauseTrack}
                    onMouseLeave={resumeTrack}
                    onTouchStart={pauseTrack}
                >
                    {looped.map((item, index) => {
                        const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.EVENT;
                        const Icon = cfg.icon;
                        const dateStr = item.date || item.deadline;

                        return (
                            <Box
                                key={`${item.id}-${index}`}
                                className="marquee-card"
                                onClick={() => handleCardClick(item)}
                                sx={{
                                    bgcolor: cfg.bg,
                                    border: `1px solid ${cfg.border}`,
                                    boxShadow: `0 4px 20px rgba(0,0,0,0.3), ${cfg.glow}`,
                                    p: 2.5,
                                    minHeight: 150,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1
                                }}
                            >
                                {/* Type label + date */}
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Box display="flex" alignItems="center" gap={0.8}>
                                        <Icon size={13} color={cfg.color} />
                                        <Typography variant="caption" fontWeight="950"
                                            sx={{ letterSpacing: 1.2, color: cfg.color, fontSize: '0.6rem' }}>
                                            {cfg.label}
                                        </Typography>
                                    </Box>
                                    {dateStr && (
                                        <Typography variant="caption" fontWeight="800"
                                            sx={{ opacity: 0.55, fontSize: '0.65rem' }}>
                                            {format(new Date(dateStr), 'MMM dd, yy')}
                                        </Typography>
                                    )}
                                </Box>

                                {/* Colored left-bar accent */}
                                <Box sx={{ borderLeft: `3px solid ${cfg.color}`, pl: 1.5, mt: 0.5 }}>
                                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                        <Typography variant="body2" fontWeight="950"
                                            sx={{ lineHeight: 1.3, fontSize: '0.9rem', flexGrow: 1,
                                                display: '-webkit-box', WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {item.title}
                                        </Typography>
                                        {(item.approvalStatus === 'PENDING' || item.approvalStatus === 'PENDING_APPROVAL' || item.meetingStatus === 'PENDING_APPROVAL' || item.status === 'PENDING') && (
                                            <Chip label="PENDING" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 950, bgcolor: 'orange', color: '#000', borderRadius: 0.5 }} />
                                        )}
                                    </Box>
                                </Box>

                                {/* Footer meta */}
                                <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                    {(item.time) && (
                                        <Box display="flex" alignItems="center" gap={0.6} sx={{ opacity: 0.55 }}>
                                            <Clock size={11} />
                                            <Typography variant="caption" fontWeight="800" sx={{ fontSize: '0.65rem' }}>
                                                {item.time}
                                            </Typography>
                                        </Box>
                                    )}
                                    <Box display="flex" alignItems="center" gap={0.6} sx={{ opacity: 0.55 }}>
                                        <MapPin size={11} />
                                        <Typography variant="caption" fontWeight="800" noWrap sx={{ fontSize: '0.65rem' }}>
                                            {item.location || item.venue || item.department?.name || 'Church HQ'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* ── Compact Color-Coded Detail Modal ── */}
            <Modal
                open={!!selectedItem}
                onClose={handleClose}
                closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{ sx: { backdropFilter: 'blur(12px)', bgcolor: 'rgba(0,0,0,0.88)' } }}
            >
                <Fade in={!!selectedItem}>
                    <Box sx={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: { xs: '92%', sm: 400 },
                        borderRadius: 3,
                        overflow: 'hidden',
                        outline: 'none',
                        boxShadow: '0 0 60px rgba(0,0,0,0.9)'
                    }}>
                        {selectedItem && (() => {
                            const cfg = TYPE_CONFIG[selectedItem.type] ?? TYPE_CONFIG.EVENT;
                            const Icon = cfg.icon;
                            const dateStr = selectedItem.date || selectedItem.deadline;
                            return (
                                <Box>
                                    {/* Colored modal header */}
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
                                            <Typography variant="caption" fontWeight="950"
                                                sx={{ letterSpacing: 1.5, color: cfg.color, fontSize: '0.65rem' }}>
                                                {cfg.label}
                                            </Typography>
                                        </Box>
                                        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
                                            <X size={18} />
                                        </IconButton>
                                    </Box>

                                    {/* Colored left-bar body */}
                                    <Box sx={{
                                        p: 3,
                                        bgcolor: 'background.paper',
                                        borderLeft: `4px solid ${cfg.color}`
                                    }}>
                                        <Typography variant="h6" fontWeight="950" sx={{ mb: 2, lineHeight: 1.2 }}>
                                            {selectedItem.title}
                                        </Typography>

                                        {/* Chips */}
                                        <Box display="flex" flexWrap="wrap" gap={0.8} mb={2.5}>
                                            <Chip
                                                label={selectedItem.status || selectedItem.meetingStatus || 'ACTIVE'}
                                                size="small"
                                                sx={{ height: 20, fontWeight: 900, fontSize: '0.6rem',
                                                      bgcolor: cfg.chip, color: '#fff', border: 'none' }}
                                            />
                                            <Chip
                                                label={selectedItem.department?.name || 'Central Command'}
                                                variant="outlined"
                                                size="small"
                                                sx={{ height: 20, fontWeight: 800, fontSize: '0.6rem',
                                                      borderColor: cfg.border, color: cfg.color }}
                                            />
                                        </Box>

                                        {/* Date / Time / Location */}
                                        <Grid container spacing={1.5} sx={{ mb: 2 }}>
                                            {dateStr && (
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ display: 'block', mb: 0.2, letterSpacing: 1 }}>DATE</Typography>
                                                    <Typography variant="body2" fontWeight="800">
                                                        {format(new Date(dateStr), 'MMM dd, yyyy')}
                                                    </Typography>
                                                </Grid>
                                            )}
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ display: 'block', mb: 0.2, letterSpacing: 1 }}>TIME</Typography>
                                                <Typography variant="body2" fontWeight="800">{selectedItem.time || '--:--'}</Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ display: 'block', mb: 0.2, letterSpacing: 1 }}>LOCATION</Typography>
                                                <Typography variant="body2" fontWeight="800">
                                                    {selectedItem.location || selectedItem.venue || 'Church HQ'}
                                                </Typography>
                                            </Grid>
                                        </Grid>

                                        {/* Description / Agenda */}
                                        {(selectedItem.description || selectedItem.agenda) && (
                                            <Box sx={{ p: 1.5, bgcolor: `${cfg.color}08`, borderRadius: 2, border: `1px solid ${cfg.border}` }}>
                                                <Typography variant="caption" fontWeight="950" sx={{ display: 'block', mb: 0.5, opacity: 0.6, letterSpacing: 1, color: cfg.color }}>
                                                    INTEL
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.85, fontSize: '0.8rem', lineHeight: 1.55 }}>
                                                    {selectedItem.description || selectedItem.agenda}
                                                </Typography>
                                            </Box>
                                        )}

                                        {/* Actions */}
                                        <Box sx={{ mt: 3, display: 'flex', gap: 1.5 }}>
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={<Edit size={14} />}
                                                onClick={() => {
                                                    onEdit?.(selectedItem);
                                                    handleClose();
                                                }}
                                                sx={{ 
                                                    borderRadius: 2, 
                                                    fontWeight: 900, 
                                                    fontSize: '0.7rem',
                                                    bgcolor: cfg.color,
                                                    '&:hover': { bgcolor: cfg.color, filter: 'brightness(1.1)' }
                                                }}
                                            >
                                                EDIT
                                            </Button>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<Trash2 size={14} />}
                                                onClick={() => {
                                                    if (window.confirm(`Are you sure you want to decommission this ${selectedItem.type}?`)) {
                                                        onDelete?.(selectedItem);
                                                        handleClose();
                                                    }
                                                }}
                                                sx={{ 
                                                    borderRadius: 2, 
                                                    fontWeight: 900, 
                                                    fontSize: '0.7rem',
                                                    borderColor: 'rgba(255,255,255,0.1)',
                                                    color: 'text.secondary',
                                                    '&:hover': { borderColor: 'error.main', color: 'error.main', bgcolor: 'rgba(255,0,0,0.05)' }
                                                }}
                                            >
                                                DELETE
                                            </Button>
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
};
