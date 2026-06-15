import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip } from '@mui/material';

export interface IntelItem {
    id?: string;
    intelType?: string;
    title?: string;
    content?: string;
    description?: string;
    createdAt?: string;
    date?: string;
    location?: string;
    status?: string;
}

interface IntelDetailModalProps {
    open: boolean;
    onClose: () => void;
    item: IntelItem | null;
}

export default function IntelDetailModal({ open, onClose, item }: IntelDetailModalProps) {
    if (!item) return null;

    const body = item.content || item.description || 'No additional details available.';
    const when = item.createdAt || item.date;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ fontWeight: 950 }}>
                {item.intelType || 'INTEL'} — {item.title?.toUpperCase()}
            </DialogTitle>
            <DialogContent>
                <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                    {item.status && <Chip label={item.status} size="small" />}
                    {when && (
                        <Chip
                            label={new Date(when).toLocaleString()}
                            size="small"
                            variant="outlined"
                        />
                    )}
                    {item.location && <Chip label={item.location} size="small" variant="outlined" />}
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {body}
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{ fontWeight: 900 }}>CLOSE</Button>
            </DialogActions>
        </Dialog>
    );
}
