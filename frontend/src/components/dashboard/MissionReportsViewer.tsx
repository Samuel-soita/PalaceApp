import React from 'react';
import { 
    Box, Typography, Card, CardContent, Button, Stack, Chip, 
    Avatar, Tooltip, Alert, LinearProgress
} from '@mui/material';
import { FileText, Download, TrendingUp, Calendar, User, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api-client';

interface MissionReportsViewerProps {
    departmentId?: string;
    limit?: number;
}

export default function MissionReportsViewer({ departmentId, limit = 5 }: MissionReportsViewerProps) {
    const { data: reports, isLoading } = useQuery(['reports', departmentId], async () => {
        const res = await api.get('/reports', { params: { departmentId } });
        return res.data;
    }, { 
        refetchInterval: 15000 
    });

    if (isLoading) return <LinearProgress sx={{ bgcolor: 'rgba(0,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: 'var(--cyan)' } }} />;

    if (!reports || reports.length === 0) return (
        <Alert severity="info" variant="outlined" sx={{ borderRadius: 0, borderColor: 'rgba(0,255,255,0.1)', color: 'rgba(255,255,255,0.5)', bgcolor: 'transparent' }}>
            Awaiting first mission report from the field sectors.
        </Alert>
    );

    const shownReports = reports.slice(0, limit);

    return (
        <Stack spacing={2}>
            {shownReports.map((report: any) => (
                <Card key={report.id} className="holographic-card" sx={{ borderRadius: 0, border: '1px solid rgba(0,255,255,0.1)', bgcolor: 'rgba(0,255,255,0.01)' }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                            <Box display="flex" alignItems="center" gap={1.5}>
                                <Avatar sx={{ bgcolor: 'rgba(0, 255, 255, 0.1)', color: 'var(--cyan)', width: 32, height: 32 }}>
                                    <FileText size={16} />
                                </Avatar>
                                <Box>
                                    <Typography variant="subtitle2" fontWeight="1000" sx={{ letterSpacing: -0.5 }}>{report.type}</Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>
                                        {report.department?.name?.toUpperCase()} | {new Date(report.createdAt).toLocaleDateString()}
                                    </Typography>
                                </Box>
                            </Box>
                            <Chip 
                                label={report.type.replace(/_/g, ' ')} 
                                size="small" 
                                sx={{ bgcolor: 'rgba(0, 255, 255, 0.1)', color: 'var(--cyan)', fontWeight: 950, fontSize: '0.55rem', borderRadius: 0 }} 
                            />
                        </Box>

                        {report.content && (
                            <Typography variant="body2" sx={{ mb: 2, opacity: 0.7, fontSize: '0.75rem', fontStyle: 'italic', borderLeft: '2px solid var(--cyan)', pl: 2 }}>
                                &quot;{report.content}&quot;
                            </Typography>
                        )}

                        <Box display="flex" justifyContent="space-between" alignItems="center" bgcolor="rgba(255,255,255,0.03)" p={1.5} border="1px dashed rgba(255,255,255,0.1)">
                            <Box display="flex" alignItems="center" gap={1}>
                                <Info size={12} color="var(--cyan)" />
                                <Typography variant="caption" fontWeight="900" sx={{ fontSize: '0.65rem' }}>
                                    {report.fileName || 'MISSION_REPORT.PDF'}
                                </Typography>
                            </Box>
                            <Button 
                                size="small" 
                                onClick={async () => {
                                    try {
                                        const response = await api.get(`/reports/${report.id}/download`, {
                                            responseType: 'blob'
                                        });
                                        const url = window.URL.createObjectURL(new Blob([response.data]));
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.setAttribute('download', report.fileName || `REPORT_${report.id}.pdf`);
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                        window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                        console.error('Download failed', err);
                                    }
                                }}
                                startIcon={<Download size={14} />}
                                sx={{ 
                                    color: 'var(--cyan)', fontWeight: 950, fontSize: '0.65rem', 
                                    '&:hover': { bgcolor: 'rgba(0,255,255,0.1)' } 
                                }}
                            >
                                DOWNLOAD PDF
                            </Button>
                        </Box>

                        <Box mt={1.5} display="flex" alignItems="center" gap={1}>
                            <User size={10} color="rgba(255,255,255,0.3)" />
                            <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.6rem', fontWeight: 700 }}>
                                SUBMITTED BY: {report.submittedBy?.name?.toUpperCase()}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            ))}
        </Stack>
    );
}
