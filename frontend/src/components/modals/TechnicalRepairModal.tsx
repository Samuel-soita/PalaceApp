import React, { useState } from 'react';
import { 
    Modal, Backdrop, Fade, Box, Typography, TextField, Button, 
    Stack, Avatar, InputAdornment 
} from '@mui/material';
import { Settings, Wrench, DollarSign } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';

interface TechnicalRepairModalProps {
    open: boolean;
    onClose: () => void;
    departmentId?: string;
    onSuccess?: () => void;
}

export default function TechnicalRepairModal({ open, onClose, departmentId, onSuccess }: TechnicalRepairModalProps) {
    const [instrumentName, setInstrumentName] = useState('');
    const [problemDescription, setProblemDescription] = useState('');
    const [estimatedCost, setEstimatedCost] = useState<number>(0);
    const queryClient = useQueryClient();

    const mutation = useMutation(async (data: any) => {
        return await api.post('/repairs', data);
    }, {
        onSuccess: () => {
            queryClient.invalidateQueries(['repairs']);
            if (onSuccess) onSuccess();
            onClose();
            setInstrumentName('');
            setProblemDescription('');
            setEstimatedCost(0);
        }
    });

    const handleSubmit = () => {
        mutation.mutate({ instrumentName, problemDescription, estimatedCost, departmentId });
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            closeAfterTransition
            BackdropComponent={Backdrop}
            BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(10px)', bgcolor: 'rgba(0,0,0,0.85)' } }}
        >
            <Fade in={open}>
                <Box sx={{ 
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: { xs: '90%', sm: 500 },
                    bgcolor: '#0a0a0a', border: '1px solid #ff4d4d',
                    p: 4, outline: 'none', boxShadow: '0 0 60px rgba(255, 77, 77, 0.2)',
                    borderRadius: 0
                }}>
                    <Box display="flex" alignItems="center" gap={2} mb={4}>
                        <Avatar sx={{ bgcolor: '#ff4d4d', width: 48, height: 48 }}><Settings size={28} color="#000" /></Avatar>
                        <Box>
                            <Typography variant="h5" fontWeight="1000" sx={{ letterSpacing: -1 }}>REPAIR REQUEST</Typography>
                            <Typography variant="caption" sx={{ color: '#ff4d4d', fontWeight: 900 }}>SOUND & TECHNICAL SECTOR</Typography>
                        </Box>
                    </Box>

                    <Stack spacing={3}>
                        <TextField
                            fullWidth label="INSTRUMENT / EQUIPMENT NAME"
                            value={instrumentName}
                            onChange={(e) => setInstrumentName(e.target.value)}
                            placeholder="e.g. Yamaha Motif Keyboard, Soundcraft Console..."
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, color: '#fff', '& fieldset': { borderColor: 'rgba(255,77,77,0.3)' }, '&:hover fieldset': { borderColor: '#ff4d4d' } } }}
                        />

                        <TextField
                            fullWidth label="ESTIMATED COST (KES)"
                            type="number"
                            value={estimatedCost}
                            onChange={(e) => setEstimatedCost(Number(e.target.value))}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><DollarSign size={16} color="#ff4d4d" /></InputAdornment>,
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, color: '#fff', '& fieldset': { borderColor: 'rgba(255,77,77,0.3)' }, '&:hover fieldset': { borderColor: '#ff4d4d' } } }}
                        />

                        <TextField
                            fullWidth multiline rows={4}
                            label="PROBLEM DESCRIPTION"
                            value={problemDescription}
                            onChange={(e) => setProblemDescription(e.target.value)}
                            placeholder="Detail the technical failure or damage..."
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, color: '#fff', '& fieldset': { borderColor: 'rgba(255,77,77,0.3)' }, '&:hover fieldset': { borderColor: '#ff4d4d' } } }}
                        />

                        <Button 
                            variant="contained" fullWidth size="large" disableElevation
                            disabled={!instrumentName || !problemDescription || estimatedCost <= 0 || mutation.isLoading}
                            onClick={handleSubmit}
                            sx={{ bgcolor: '#ff4d4d', color: '#000', fontWeight: 950, borderRadius: 0, py: 1.5, '&:hover': { bgcolor: '#ff6666' } }}
                        >
                            {mutation.isLoading ? 'INITIATING...' : 'REQUEST SYSTEM REPAIR'}
                        </Button>
                    </Stack>
                </Box>
            </Fade>
        </Modal>
    );
}
