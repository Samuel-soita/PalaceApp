import React from 'react';
import { 
    Dialog, DialogContent, Box, Typography, 
    Button, IconButton, Divider, useMediaQuery, useTheme 
} from '@mui/material';
import { X, Smartphone, Download, Share2, PlusSquare, ChevronRight, Globe, Shield } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

interface InstallAppModalProps {
    open: boolean;
    onClose: () => void;
}

export default function InstallAppModal({ open, onClose }: InstallAppModalProps) {
    const { canInstall, triggerInstall } = usePWA();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    
    // Detect OS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const isAndroid = /Android/.test(navigator.userAgent);

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 0,
                    bgcolor: '#161925',
                    border: '1px solid rgba(79, 139, 255, 0.3)',
                    backgroundImage: 'none',
                    position: 'relative',
                    overflow: 'visible'
                }
            }}
        >
            {/* Header with Logo */}
            <Box sx={{ 
                p: 4, pb: 2, 
                display: 'flex', flexDirection: 'column', 
                alignItems: 'center', textAlign: 'center' 
            }}>
                <IconButton 
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
                >
                    <X size={20} />
                </IconButton>

                <Box sx={{ 
                    width: 70, height: 70, mb: 3,
                    p: 0.5,
                    border: '1px solid rgba(79, 139, 255, 0.4)',
                    bgcolor: 'rgba(79, 139, 255, 0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(79, 139, 255, 0.2)'
                }}>
                    <img src="/logo.png" alt="Church Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </Box>

                <Typography variant="h6" fontWeight={900} letterSpacing={1} className="glow-text">
                    INSTALL PRAYER PALACE
                </Typography>
                <Typography variant="caption" sx={{ mt: 1, opacity: 0.6, maxWidth: '80%' }}>
                    Add to your home screen for fast, offline access to the ministry portal.
                </Typography>
            </Box>

            <DialogContent sx={{ p: 3, pt: 1 }}>
                {canInstall ? (
                    /* Android / Chrome Automatic Flow */
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                            Your browser supports direct installation. One tap to add it to your apps.
                        </Typography>
                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            startIcon={<Download size={18} />}
                            onClick={async () => {
                                await triggerInstall();
                                onClose();
                            }}
                            sx={{ 
                                py: 2, fontWeight: 900, letterSpacing: 1,
                                bgcolor: 'rgba(79, 139, 255, 0.2)',
                                border: '1px solid #4f8bff',
                                '&:hover': { bgcolor: 'rgba(79, 139, 255, 0.4)', boxShadow: '0 0 20px rgba(79, 139, 255, 0.5)' }
                            }}
                        >
                            INSTALL NOW
                        </Button>
                    </Box>
                ) : (
                    /* iOS / Safari / Manual Flow */
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900, mb: 2, display: 'block' }}>
                            MANUAL INSTALLATION GUIDE
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {isIOS ? (
                                <>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                        <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <Share2 size={18} color="#4f8bff" />
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" fontWeight={700}>1. Tap Share</Typography>
                                            <Typography variant="caption" color="text.secondary">Look for the share button at the bottom of Safari.</Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                        <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <PlusSquare size={18} color="#4f8bff" />
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" fontWeight={700}>2. Add to Home Screen</Typography>
                                            <Typography variant="caption" color="text.secondary">Scroll down the menu and select &quot;Add to Home Screen&quot;.</Typography>
                                        </Box>
                                    </Box>
                                </>
                            ) : (
                                <>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                        <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <Globe size={18} color="#4f8bff" />
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" fontWeight={700}>Open in Browser Settings</Typography>
                                            <Typography variant="caption" color="text.secondary">Open your browser menu (usually 3 dots or lines).</Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                        <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <Smartphone size={18} color="#4f8bff" />
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" fontWeight={700}>Select &apos;Install&apos; or &apos;Add&apos;</Typography>
                                            <Typography variant="caption" color="text.secondary">Choose &apos;Install app&apos; or &apos;Add to home screen&apos;.</Typography>
                                        </Box>
                                    </Box>
                                </>
                            )}
                        </Box>

                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={onClose}
                            sx={{ mt: 4, py: 1.5, fontWeight: 700, borderRadius: 0, borderColor: 'rgba(255,255,255,0.1)' }}
                        >
                            GOT IT
                        </Button>
                    </Box>
                )}
            </DialogContent>

            <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, opacity: 0.5 }}>
                    <Shield size={12} />
                    <Typography variant="caption" fontWeight={700}>SECURE OFFLINE TERMINAL</Typography>
                </Box>
            </Box>
        </Dialog>
    );
}
