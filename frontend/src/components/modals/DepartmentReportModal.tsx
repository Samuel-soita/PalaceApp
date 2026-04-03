import React, { useState } from 'react';
import { 
    Modal, Backdrop, Fade, Box, Typography, TextField, Button, 
    FormControl, InputLabel, Select, MenuItem, Stack, Avatar 
} from '@mui/material';
import { FileText, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api-client';

interface DepartmentReportModalProps {
    open: boolean;
    onClose: () => void;
    departmentId?: string;
    onSuccess?: () => void;
}

export default function DepartmentReportModal({ open, onClose, departmentId, onSuccess }: DepartmentReportModalProps) {
    const [type, setType] = useState('MONTHLY');
    const [content, setContent] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const queryClient = useQueryClient();

    const mutation = useMutation(async (data: FormData) => {
        return await api.post('/reports', data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }, {
        onSuccess: () => {
            queryClient.invalidateQueries(['reports']);
            if (onSuccess) onSuccess();
            onClose();
            setContent('');
            setFile(null);
        }
    });

    const handleSubmit = () => {
        const formData = new FormData();
        formData.append('type', type);
        formData.append('content', content);
        if (departmentId) formData.append('departmentId', departmentId);
        if (file) formData.append('report', file);
        
        mutation.mutate(formData);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            closeAfterTransition
            BackdropComponent={Backdrop}
            BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(8px)', bgcolor: 'rgba(0,0,0,0.8)' } }}
        >
            <Fade in={open}>
                <Box sx={{ 
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: { xs: '90%', sm: 500 },
                    bgcolor: '#0a0a0a', border: '1px solid var(--cyan)',
                    p: 4, outline: 'none', boxShadow: '0 0 50px rgba(0, 255, 255, 0.2)',
                    borderRadius: 0
                }}>
                    <Box display="flex" alignItems="center" gap={2} mb={4}>
                        <Avatar sx={{ bgcolor: 'var(--cyan)', width: 48, height: 48 }}><FileText size={24} color="#000" /></Avatar>
                        <Box>
                            <Typography variant="h5" fontWeight="1000" sx={{ letterSpacing: -1 }}>DEPARTMENTAL REPORT</Typography>
                            <Typography variant="caption" sx={{ color: 'var(--cyan)', fontWeight: 900 }}>OFFICIAL COMMAND SUBMISSION</Typography>
                        </Box>
                    </Box>

                    <Stack spacing={3}>
                        <FormControl fullWidth variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, color: '#fff', '& fieldset': { borderColor: 'rgba(0,255,255,0.3)' }, '&:hover fieldset': { borderColor: 'var(--cyan)' } } }}>
                            <InputLabel sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 900 }}>REPORTING INTERVAL</InputLabel>
                            <Select
                                value={type}
                                label="REPORTING INTERVAL"
                                onChange={(e) => setType(e.target.value)}
                                sx={{ borderRadius: 0 }}
                            >
                                <MenuItem value="MONTHLY">MONTHLY PROGRESS REPORT</MenuItem>
                                <MenuItem value="QUARTERLY">3-MONTH (QUARTERLY) STRATEGIC REVIEW</MenuItem>
                                <MenuItem value="BIANNUAL">6-MONTH (BI-ANNUAL) SECTORAL UPDATE</MenuItem>
                                <MenuItem value="YEARLY">ANNUAL MISSION SUMMARY</MenuItem>
                            </Select>
                        </FormControl>

                        <Box 
                            sx={{ 
                                border: '1px dashed rgba(0,255,255,0.3)', p: 3, textAlign: 'center', 
                                cursor: 'pointer', transition: 'all 0.2s', 
                                '&:hover': { borderColor: 'var(--cyan)', bgcolor: 'rgba(0,255,255,0.02)' } 
                            }}
                            onClick={() => document.getElementById('report-upload')?.click()}
                        >
                            <input
                                id="report-upload"
                                type="file"
                                accept=".pdf"
                                hidden
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
                            <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.7, mb: 1, display: 'block' }}>
                                {file ? `📄 ${file.name}` : 'SELECT PDF MISSION REPORT'}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'var(--cyan)' }}>
                                CLICK TO BROUSE COMMAND ARCHIVES
                            </Typography>
                        </Box>

                        <TextField
                            fullWidth multiline rows={3}
                            label="EXECUTIVE SUMMARY (OPTIONAL)"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Add brief highlights or critical notes..."
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, color: '#fff', '& fieldset': { borderColor: 'rgba(0,255,255,0.3)' }, '&:hover fieldset': { borderColor: 'var(--cyan)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' } }}
                        />

                        <Button 
                            variant="contained" fullWidth size="large" disableElevation
                            startIcon={<Send size={18} />}
                            disabled={!file || mutation.isLoading}
                            onClick={handleSubmit}
                            sx={{ bgcolor: 'var(--cyan)', color: '#000', fontWeight: 950, borderRadius: 0, py: 1.5, '&:hover': { bgcolor: '#00e5ff' } }}
                        >
                            {mutation.isLoading ? 'TRANSMITTING...' : 'SUBMIT PDF REPORT'}
                        </Button>
                    </Stack>
                </Box>
            </Fade>
        </Modal>
    );
}
