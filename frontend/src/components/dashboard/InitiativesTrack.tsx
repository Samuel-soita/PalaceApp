import React, { useState, useRef } from 'react';
import { Box, Typography, LinearProgress, Chip, IconButton, Modal, Backdrop, Fade } from '@mui/material';
import { Briefcase, Clock, Building2, X, CheckCircle2, Pause, Play, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { Button } from '@mui/material';

interface Project {
    id: string;
    title: string;
    description: string;
    status: string;
    progress: number;
    deadline?: string;
    budget?: number;
    approvalStatus?: string;
    department: { name: string };
}

interface InitiativesTrackProps {
    projects: Project[];
    onEdit?: (item: Project) => void;
    onDelete?: (item: Project) => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
    IN_PROGRESS: { color: '#9333ea', bg: 'rgba(147,51,234,0.08)', border: 'rgba(147,51,234,0.35)', icon: Play },
    PLANNED:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.35)', icon: Clock },
    COMPLETED:   { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.35)',  icon: CheckCircle2 },
    ON_HOLD:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.35)', icon: Pause },
    CANCELLED:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.35)',  icon: AlertTriangle },
};

export const InitiativesTrack = ({ projects, onEdit, onDelete }: InitiativesTrackProps) => {
    const [selected, setSelected] = useState<Project | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    if (!projects || projects.length === 0) {
        return (
            <Box sx={{ py: 6, textAlign: 'center', opacity: 0.4 }}>
                <Typography variant="body2" fontWeight="800" sx={{ letterSpacing: 2 }}>NO ACTIVE INITIATIVES</Typography>
            </Box>
        );
    }

    const looped = [...projects, ...projects];
    const pause = () => { if (trackRef.current) trackRef.current.style.animationPlayState = 'paused'; };
    const resume = () => { if (trackRef.current) trackRef.current.style.animationPlayState = 'running'; };

    const handleClick = (item: Project) => { pause(); setSelected(item); };
    const handleClose = () => { setSelected(null); resume(); };

    return (
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
            <style>{`
                @keyframes initiativesSlide {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .initiatives-track {
                    display: flex;
                    gap: 18px;
                    width: max-content;
                    animation: initiativesSlide ${Math.max(30, projects.length * 6)}s linear infinite;
                    will-change: transform;
                }
                .initiative-card {
                    width: 260px;
                    flex-shrink: 0;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                }
                .initiative-card:hover { transform: translateY(-6px) scale(1.02); }
                .initiative-card:active { transform: scale(0.97); }
            `}</style>

            <Box sx={{ overflow: 'hidden', py: 2 }}>
                <Box
                    ref={trackRef}
                    className="initiatives-track"
                    onMouseEnter={pause}
                    onMouseLeave={resume}
                    onTouchStart={pause}
                >
                    {looped.map((item, idx) => {
                        const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PLANNED;
                        const Icon = cfg.icon;
                        return (
                            <Box
                                key={`${item.id}-${idx}`}
                                className="initiative-card"
                                onClick={() => handleClick(item)}
                                sx={{
                                    bgcolor: cfg.bg,
                                    border: `1px solid ${cfg.border}`,
                                    boxShadow: `0 4px 18px rgba(0,0,0,0.25), 0 0 14px ${cfg.bg}`,
                                    p: 2,
                                    minHeight: 150,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                }}
                            >
                                {/* Status + Icon */}
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Box display="flex" alignItems="center" gap={0.7}>
                                        <Icon size={12} color={cfg.color} />
                                        <Typography variant="caption" fontWeight="950"
                                            sx={{ color: cfg.color, letterSpacing: 1.2, fontSize: '0.58rem' }}>
                                            {item.status.replace('_', ' ')}
                                        </Typography>
                                    </Box>
                                    <Briefcase size={12} color={cfg.color} opacity={0.6} />
                                </Box>

                                {/* Title */}
                                <Box sx={{ borderLeft: `3px solid ${cfg.color}`, pl: 1.5 }}>
                                    <Typography variant="body2" fontWeight="950"
                                        sx={{ fontSize: '0.88rem', lineHeight: 1.3,
                                              display: '-webkit-box', WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {item.title}
                                    </Typography>
                                </Box>

                                {/* Progress bar */}
                                <Box sx={{ mt: 'auto' }}>
                                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                                        <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.6rem', fontWeight: 700 }}>PROGRESS</Typography>
                                        <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 900, fontSize: '0.65rem' }}>
                                            {item.progress}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={item.progress}
                                        sx={{
                                            height: 4, borderRadius: 2,
                                            bgcolor: 'rgba(255,255,255,0.06)',
                                            '& .MuiLinearProgress-bar': { bgcolor: cfg.color, borderRadius: 2 }
                                        }}
                                    />
                                    <Box display="flex" alignItems="center" gap={0.6} mt={1} sx={{ opacity: 0.5 }}>
                                        <Building2 size={10} />
                                        <Typography variant="caption" fontWeight="700" noWrap sx={{ fontSize: '0.62rem' }}>
                                            {item.department?.name}
                                        </Typography>
                                    </Box>
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
                        width: { xs: '92%', sm: 420 },
                        borderRadius: 3, overflow: 'hidden', outline: 'none',
                        boxShadow: '0 0 60px rgba(0,0,0,0.9)'
                    }}>
                        {selected && (() => {
                            const cfg = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.PLANNED;
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
                                                    STRATEGIC INITIATIVE
                                                </Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.6rem' }}>
                                                    {selected.department?.name}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
                                            <X size={18} />
                                        </IconButton>
                                    </Box>
                                    <Box sx={{ p: 3, bgcolor: 'background.paper', borderLeft: `4px solid ${cfg.color}` }}>
                                        <Typography variant="h6" fontWeight="950" sx={{ mb: 1.5, lineHeight: 1.2 }}>
                                            {selected.title}
                                        </Typography>
                                        <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                                            <Chip label={selected.status.replace('_',' ')} size="small"
                                                sx={{ height: 20, fontWeight: 900, fontSize: '0.6rem', bgcolor: cfg.color, color: '#fff' }} />
                                            {selected.deadline && (
                                                <Chip
                                                    icon={<Clock size={10} />}
                                                    label={`Deadline: ${new Date(selected.deadline).toLocaleDateString()}`}
                                                    variant="outlined" size="small"
                                                    sx={{ height: 20, fontWeight: 800, fontSize: '0.6rem', borderColor: cfg.border, color: cfg.color }}
                                                />
                                            )}
                                        </Box>
                                        {/* Progress */}
                                        <Box mb={2}>
                                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                                                <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ letterSpacing: 1 }}>COMPLETION</Typography>
                                                <Typography variant="caption" fontWeight="900" sx={{ color: cfg.color }}>{selected.progress}%</Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={selected.progress}
                                                sx={{
                                                    height: 6, borderRadius: 3,
                                                    bgcolor: 'rgba(255,255,255,0.06)',
                                                    '& .MuiLinearProgress-bar': { bgcolor: cfg.color, borderRadius: 3 }
                                                }}
                                            />
                                        </Box>
                                        {/* Budget */}
                                        {selected.budget != null && selected.budget > 0 && (
                                            <Typography variant="caption" color="textSecondary" fontWeight="800" sx={{ display: 'block', mb: 2 }}>
                                                BUDGET: KES {(selected.budget || 0).toLocaleString()}
                                            </Typography>
                                        )}
                                        {selected.description && (
                                            <Box sx={{ p: 1.5, bgcolor: `${cfg.color}08`, borderRadius: 2, border: `1px solid ${cfg.border}` }}>
                                                <Typography variant="body2" sx={{ lineHeight: 1.6, opacity: 0.85 }}>
                                                    {selected.description}
                                                </Typography>
                                            </Box>
                                        )}

                                        {/* Actions */}
                                        <Box sx={{ mt: 3, display: 'flex', gap: 1.5 }}>
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={<Edit size={14} />}
                                                disabled={selected.approvalStatus === 'APPROVED'}
                                                onClick={() => {
                                                    onEdit?.(selected);
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
                                                {selected.approvalStatus === 'APPROVED' ? 'LOCKED' : 'EDIT'}
                                            </Button>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<Trash2 size={14} />}
                                                disabled={selected.approvalStatus === 'APPROVED'}
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to decommission this initiative?')) {
                                                        onDelete?.(selected);
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
