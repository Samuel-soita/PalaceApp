import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, Avatar, IconButton, CircularProgress,
    TextField, MenuItem, Divider, Alert, Chip, Tooltip
} from '@mui/material';
import { Camera, X, Check, Lock, CreditCard, Calendar, Shield, User, Fingerprint } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api-client';

interface ProfileModalProps {
    open: boolean;
    onClose: () => void;
}

const GENDER_OPTIONS = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
];

/** Parse 063/001/YYYY card format and check if it's still valid */
function parseCardValidity(card: string | null): { canUpdate: boolean; validYear: number | null; expired: boolean } {
    if (!card) return { canUpdate: true, validYear: null, expired: true };
    const match = card.match(/^\d{3}\/\d{3}\/(\d{4})$/);
    if (!match) return { canUpdate: true, validYear: null, expired: true };
    const validYear = parseInt(match[1], 10);
    const currentYear = new Date().getFullYear();
    const expired = validYear < currentYear;
    return { canUpdate: expired, validYear, expired };
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
    const { user, updateUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: '',
        gender: '',
        dob: '',
        membershipNumber: '',
        phoneNumber: '',
    });

    // Sync user data into form when modal opens
    useEffect(() => {
        if (open && user) {
            setFormData({
                name: user.name || '',
                gender: (user as any).gender || '',
                dob: (user as any).dob ? new Date((user as any).dob).toISOString().split('T')[0] : '',
                membershipNumber: (user as any).membershipNumber || '',
                phoneNumber: (user as any).phoneNumber || '',
            });
            setPreviewUrl(null);
            setSelectedFile(null);
            setError(null);
            setSuccess(false);
        }
    }, [open, user]);

    const { canUpdate: canUpdateMembershipCard, validYear, expired: cardExpired } =
        parseCardValidity((user as any)?.membershipNumber || null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError('Please select a valid image file.'); return; }
        if (file.size > 10 * 1024 * 1024) { setError('Image must be less than 10MB.'); return; }
        setError(null);
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = e => setPreviewUrl(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            let finalAvatarUrl = user?.avatarUrl;

            if (selectedFile) {
                const form = new FormData();
                form.append('file', selectedFile);
                const uploadRes = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                finalAvatarUrl = `${uploadRes.data.url}?t=${Date.now()}`;
            }

            const payload: any = {
                name: formData.name,
                gender: formData.gender,
                dob: formData.dob,
                phoneNumber: formData.phoneNumber,
                ...(finalAvatarUrl !== user?.avatarUrl && { avatarUrl: finalAvatarUrl }),
            };

            // Only include membershipNumber if it changed
            if (formData.membershipNumber !== (user as any).membershipNumber) {
                payload.membershipNumber = formData.membershipNumber;
            }

            const res = await api.patch('/auth/profile', payload);
            updateUser({ ...res.data, avatarUrl: finalAvatarUrl });
            setSuccess(true);
            setTimeout(() => { setSuccess(false); onClose(); }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRequest = async () => {
        if (!window.confirm("Are you sure you want to request account deletion? An administrator will review your request.")) return;
        setLoading(true);
        try {
            await api.patch('/auth/profile', { deletionRequested: true });
            setSuccess(true);
            setTimeout(() => { setSuccess(false); onClose(); }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit deletion request.');
        } finally {
            setLoading(false);
        }
    };

    const currentAvatar = previewUrl || user?.avatarUrl;

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    background: 'rgba(16, 20, 32, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                }
            }}
        >
            <DialogTitle component="div" sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight={800} className="glow-text">Profile Settings</Typography>
                <IconButton onClick={onClose} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {success && <Alert severity="success" sx={{ mb: 2 }}>Profile updated successfully!</Alert>}
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

                {/* Avatar Upload */}
                <Box display="flex" justifyContent="center" mb={3}>
                    <Box sx={{ position: 'relative' }}>
                        <Avatar
                            src={currentAvatar}
                            sx={{
                                width: 100, height: 100, fontSize: '2.5rem', fontWeight: 900,
                                bgcolor: 'rgba(79, 139, 255, 0.2)', color: 'var(--cyan)',
                                border: '2px solid var(--cyan)',
                            }}
                        >
                            {!currentAvatar && (user?.name?.charAt(0) || 'U')}
                        </Avatar>
                        <Tooltip title="Upload Photo">
                            <IconButton
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                                size="small"
                                sx={{
                                    position: 'absolute', bottom: 0, right: 0,
                                    bgcolor: 'var(--primary)', color: 'white',
                                    border: '2px solid #0c0e14',
                                    '&:hover': { bgcolor: 'var(--cyan)' }
                                }}
                            >
                                <Camera size={16} />
                            </IconButton>
                        </Tooltip>
                        <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileChange} />
                    </Box>
                </Box>

                {/* Role Chip with Differentiation */}
                <Box display="flex" flexDirection="column" alignItems="center" mb={3} gap={1}>
                    <Chip
                        icon={<Shield size={14} />}
                        label={user?.role === 'SUPER_ADMIN' ? 'GLOBAL COMMANDER' : user?.role === 'DEPARTMENT_LEADER' ? 'DEPARTMENT LEADER' : 'CHURCH MEMBER'}
                        size="small"
                        sx={{ 
                            fontWeight: 800, 
                            letterSpacing: 2, 
                            textTransform: 'uppercase', 
                            fontSize: '0.65rem',
                            bgcolor: user?.role === 'SUPER_ADMIN' ? 'rgba(255, 204, 0, 0.15)' : user?.role === 'DEPARTMENT_LEADER' ? 'rgba(79, 139, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: user?.role === 'SUPER_ADMIN' ? '#ffcc00' : user?.role === 'DEPARTMENT_LEADER' ? 'var(--cyan)' : 'text.secondary',
                            border: `1px solid ${user?.role === 'SUPER_ADMIN' ? '#ffcc0044' : user?.role === 'DEPARTMENT_LEADER' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.1)'}`
                        }}
                    />
                    {user?.department?.name && (
                        <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {user.department.name} SECTOR
                        </Typography>
                    )}
                </Box>

                <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" color="textSecondary" sx={{ letterSpacing: 2, textTransform: 'uppercase' }}>Personal Info</Typography>
                </Divider>

                <Box display="flex" flexDirection="column" gap={2}>
                    <TextField
                        fullWidth label="Full Name" name="name"
                        value={formData.name} onChange={handleChange}
                        InputProps={{ startAdornment: <User size={18} style={{ marginRight: 8, opacity: 0.5 }} /> }}
                    />
                    <Box display="flex" gap={2}>
                        <TextField
                            fullWidth label="Date of Birth" name="dob" type="date"
                            value={formData.dob} onChange={handleChange}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{ startAdornment: <Calendar size={18} style={{ marginRight: 8, opacity: 0.5 }} /> }}
                        />
                        <TextField
                            fullWidth select label="Gender" name="gender"
                            value={formData.gender} onChange={handleChange}
                        >
                            {GENDER_OPTIONS.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </TextField>
                    </Box>

                    <TextField
                        fullWidth label="Phone Number" name="phoneNumber"
                        value={formData.phoneNumber} onChange={handleChange}
                        placeholder="e.g. +254 712 345 678"
                    />

                    {/* Read-only ID Number */}
                    <TextField
                        fullWidth label="National ID Number"
                        value={(user as any)?.idNumber || '—'}
                        disabled
                        helperText="ID Number cannot be changed after registration."
                        InputProps={{ startAdornment: <Fingerprint size={18} style={{ marginRight: 8, opacity: 0.4 }} /> }}
                    />
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" color="textSecondary" sx={{ letterSpacing: 2, textTransform: 'uppercase' }}>Membership</Typography>
                </Divider>

                <Tooltip
                    title={!canUpdateMembershipCard ? `Card is valid through ${validYear}. Renewal available from ${(validYear ?? 0) + 1}.` : 'Enter your new card in format: 063/001/YYYY'}
                    placement="top"
                >
                    <span>
                        <TextField
                            fullWidth
                            label="Membership Card Number"
                            name="membershipNumber"
                            value={formData.membershipNumber}
                            onChange={handleChange}
                            disabled={!canUpdateMembershipCard}
                            placeholder="e.g. 063/001/2026"
                            helperText={
                                !canUpdateMembershipCard
                                    ? `🔒 Card valid through ${validYear}. You can renew it starting ${(validYear ?? 0) + 1}.`
                                    : '✅ Your card has expired. Enter a new card number in format: 063/branch/YYYY'
                            }
                            InputProps={{
                                startAdornment: <CreditCard size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
                                endAdornment: !canUpdateMembershipCard ? <Lock size={18} style={{ opacity: 0.5 }} /> : undefined,
                            }}
                        />
                    </span>
                </Tooltip>

                <Box mt={4} pt={2} borderTop="1px solid rgba(255,255,255,0.05)">
                    <Typography variant="subtitle2" color="error" fontWeight="bold" mb={1}>Danger Zone</Typography>
                    <Typography variant="body2" color="textSecondary" mb={2}>
                        Account deletion requests are reviewed by the administration branch before finalization.
                    </Typography>
                    <Button 
                        variant="outlined" 
                        color="error" 
                        size="small" 
                        onClick={handleDeleteRequest} 
                        disabled={loading || (user as any)?.deletionRequested}
                    >
                        {(user as any)?.deletionRequested ? 'Deletion Pending Review' : 'Request Account Deletion'}
                    </Button>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <Button onClick={onClose} disabled={loading} color="inherit">
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Check size={16} />}
                >
                    {loading ? 'Saving...' : 'Save Changes'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
