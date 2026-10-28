import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Grid, Typography } from '@mui/material';
import { Shield } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { canSignApproval, isAwaitingApproval } from '../../utils/approval-rules';
import EventFormModal from '../modals/EventFormModal';
import ProjectFormModal from '../modals/ProjectFormModal';
import PlanFormModal from '../modals/PlanFormModal';
import AnnouncementFormModal from '../modals/AnnouncementFormModal';

type ItemType = 'PROJECT' | 'EVENT' | 'PLAN' | 'ANNOUNCEMENT';

interface PendingApprovalsPanelProps {
    projects?: any[];
    events?: any[];
    plans?: any[];
    announcements?: any[];
}

/** Items the signed-in approver still has to sign, each opening its review modal. */
export default function PendingApprovalsPanel({ projects = [], events = [], plans = [], announcements = [] }: PendingApprovalsPanelProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState<{ type: ItemType; item: any } | null>(null);

    const awaitingMe = (item: any, status?: string) => isAwaitingApproval(status) && canSignApproval(item, user);
    const pending: Array<{ type: ItemType; item: any }> = [
        ...projects.filter((p) => awaitingMe(p, p.approvalStatus)).map((item) => ({ type: 'PROJECT' as const, item })),
        ...events.filter((e) => awaitingMe(e, e.approvalStatus)).map((item) => ({ type: 'EVENT' as const, item })),
        ...plans.filter((p) => awaitingMe(p, p.approvalStatus)).map((item) => ({ type: 'PLAN' as const, item })),
        ...announcements.filter((a) => awaitingMe(a, a.status)).map((item) => ({ type: 'ANNOUNCEMENT' as const, item })),
    ];

    const close = () => setSelected(null);
    const refresh = () => queryClient.invalidateQueries(['dashboard-sync']);

    return (
        <>
            {pending.length > 0 && (
                <Box sx={{ mb: 6 }}>
                    <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                        <Shield size={20} color="orange" />
                        <Typography variant="caption" fontWeight="1000" sx={{ color: 'orange', letterSpacing: 2 }}>
                            CRITICAL: PENDING APPROVAL REQUESTS ({pending.length})
                        </Typography>
                    </Box>
                    <Grid container spacing={2}>
                        {pending.map(({ type, item }) => (
                            <Grid item xs={12} md={4} key={`${type}-${item.id}`}>
                                <Card
                                    className="holographic-card"
                                    sx={{
                                        border: '1px solid orange',
                                        bgcolor: 'rgba(255,165,0,0.05)',
                                        animation: 'pulse-pastor-live 3s infinite'
                                    }}
                                >
                                    <CardContent sx={{ p: 2 }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                            <Typography variant="caption" fontWeight="950" color="orange">{type}</Typography>
                                            <Chip label="ACTION REQUIRED" size="small" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 950, bgcolor: 'orange', color: '#000' }} />
                                        </Box>
                                        <Typography variant="subtitle2" fontWeight="950" mb={1}>{item.title?.toUpperCase()}</Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mb: 2 }}>
                                            {item.department?.name ? `${item.department.name} \u00b7 ` : ''}Requested: {new Date(item.createdAt).toLocaleDateString()}
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            onClick={() => setSelected({ type, item })}
                                            sx={{
                                                borderColor: 'orange', color: 'orange', fontWeight: 900, fontSize: '0.65rem',
                                                '&:hover': { bgcolor: 'orange', color: 'black' }
                                            }}
                                        >
                                            REVIEW & APPROVE
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}

            <ProjectFormModal open={selected?.type === 'PROJECT'} onClose={close} project={selected?.type === 'PROJECT' ? selected.item : null} onSuccess={refresh} />
            <EventFormModal open={selected?.type === 'EVENT'} onClose={close} event={selected?.type === 'EVENT' ? selected.item : null} onSuccess={refresh} />
            <PlanFormModal open={selected?.type === 'PLAN'} onClose={close} plan={selected?.type === 'PLAN' ? selected.item : null} onSuccess={refresh} />
            <AnnouncementFormModal open={selected?.type === 'ANNOUNCEMENT'} onClose={close} announcement={selected?.type === 'ANNOUNCEMENT' ? selected.item : null} onSuccess={refresh} />
        </>
    );
}
