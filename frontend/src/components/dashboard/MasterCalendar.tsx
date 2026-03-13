import { Box, Typography, Paper, Chip } from '@mui/material';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Event {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    department: { name: string };
    status: string;
    eventType: string;
}

export const MasterCalendar = ({ events }: { events: Event[] }) => {
    return (
        <Box display="flex" flexDirection="column" gap={2}>
            {events.map((event) => (
                <Box key={event.id} display="flex" gap={2} p={2} sx={{ borderLeft: '3px solid var(--primary)', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '0 8px 8px 0' }}>
                    <Box sx={{ minWidth: 60, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight="950" color="primary">{format(new Date(event.date), 'dd')}</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>{format(new Date(event.date), 'MMM')}</Typography>
                    </Box>
                    <Box flex={1}>
                        <Typography variant="subtitle1" fontWeight="800" sx={{ lineHeight: 1.2, mb: 0.5 }}>{event.title}</Typography>
                        <Box display="flex" flexWrap="wrap" gap={2} sx={{ opacity: 0.8 }}>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700, color: 'primary.light' }}>
                                <Clock size={12} /> {event.time}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700, opacity: 0.8 }}>
                                <MapPin size={12} /> {event.location}
                            </Typography>
                        </Box>
                        <Box mt={1.5} display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" gap={1}>
                                <Chip label={event.eventType} size="small" variant="filled" color="primary" sx={{ fontWeight: 900, fontSize: '0.6rem', height: 20, borderRadius: 0 }} />
                                <Chip label={event.department.name} size="small" variant="outlined" sx={{ border: '1px solid rgba(255,255,255,0.1)', fontWeight: 800, fontSize: '0.6rem', height: 20, borderRadius: 0 }} />
                            </Box>
                            <Typography variant="caption" sx={{ 
                                fontSize: '0.6rem !important', 
                                fontWeight: 'bold', 
                                bgcolor: 'rgba(255,255,255,0.05)', 
                                px: 1, py: 0.2, 
                                border: '1px solid var(--glass-border)',
                                color: 'primary.main'
                            }}>{event.status}</Typography>
                        </Box>
                    </Box>
                </Box>
            ))}
            {events.length === 0 && (
                <Typography variant="body2" sx={{ textAlign: 'center', opacity: 0.5, py: 4 }}>No upcoming events scheduled.</Typography>
            )}
        </Box>
    );
};
