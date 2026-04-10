import React, { useState } from 'react';
import { 
    Modal, Backdrop, Fade, Box, Typography, TextField, Button, 
    Stack, Avatar, InputAdornment, MenuItem 
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
    const [budgetSource, setBudgetSource] = useState('DEPARTMENT');
    const queryClient = useQueryClient();

    const mutation = useMutation(async (data: any) => {
        const localId = crypto.randomUUID();
        const timestamp = Date.now();

        // 🚀 Tactical System Repair Entry
        await db.repairs.put({
            id: localId,
            instrumentName: data.instrumentName,
            problemDescription: data.problemDescription,
            estimatedCost: data.estimatedCost,
            budgetSource: data.budgetSource,
            departmentId: data.departmentId || 'GLOBAL',
            status: 'PENDING_APPROVAL',
            syncStatus: 'PENDING',
            deviceId: localStorage.getItem('device_id') || 'UNKNOWN',
            lastModifiedBy: 'ME',
            version: 0,
            createdAt: new Date().toISOString()
        });

        // 📡 Queue for Global Maintenance
        await db.syncQueue.put({
            id: crypto.randomUUID(),
            timestamp,
            entity: 'REPAIR',
            method: 'POST',
            url: '/repairs',
            payload: { ...data, localId },
            status: 'PENDING',
            retryCount: 0,
            errorLog: []
        });

        return { data: { _queued: true } };
    }, {
        onSuccess: () => {
            queryClient.invalidateQueries(['repairs']);
            if (onSuccess) onSuccess();
            onClose();
            setInstrumentName('');
            setProblemDescription('');
            setEstimatedCost(0);
            setBudgetSource('DEPARTMENT');
        }
    });

    const handleSubmit = () => {
        mutation.mutate({ instrumentName, problemDescription, estimatedCost, budgetSource, departmentId });
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

                        <Box display="flex" gap={2}>
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
                                fullWidth label="BUDGET SOURCE"
                                select
                                value={budgetSource}
                                onChange={(e) => setBudgetSource(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, color: '#fff', '& fieldset': { borderColor: 'rgba(255,77,77,0.3)' }, '&:hover fieldset': { borderColor: '#ff4d4d' } } }}
                                SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: '#0a0a0a', border: '1px solid #ff4d4d' } } } }}
                            >
                                <MenuItem value="DEPARTMENT" sx={{ color: '#fff' }}>Department Funds</MenuItem>
                                <MenuItem value="CHURCH" sx={{ color: '#fff' }}>Church Central Funds</MenuItem>
                            </TextField>
                        </Box>

                        {budgetSource === 'DEPARTMENT' && (
                            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,77,77,0.05)', border: '1px solid rgba(255,77,77,0.2)' }}>
                                <Typography variant="caption" fontWeight="800" sx={{ color: '#ff4d4d' }}>
                                    NOTE: Department funded operations require a minimum balance of 1,500 KES.
                                </Typography>
                            </Box>
                        )}

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
