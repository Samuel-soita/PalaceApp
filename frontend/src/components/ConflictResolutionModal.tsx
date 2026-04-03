import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box } from '@mui/material';
import { Button } from '@mui/material';
import { db, SyncJob } from '../lib/db';
import { processSyncDaemon } from '../lib/pwa-sync';

interface ConflictData {
    action: SyncJob;
    serverData: any;
}

export default function ConflictResolutionModal() {
    const [conflict, setConflict] = useState<ConflictData | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            const data: ConflictData = e.detail;
            setConflict(data);
            setOpen(true);
        };
        window.addEventListener('pwa-conflict-detected', handler);
        return () => window.removeEventListener('pwa-conflict-detected', handler);
    }, []);

    const handleAction = async (decision: 'KEEP_SERVER' | 'FORCE_MERGE') => {
        if (!conflict) return;
        
        try {
            if (decision === 'KEEP_SERVER') {
                // Discard local action, server wins
                await db.syncQueue.delete(conflict.action.id);
                // Also overwrite local event with server event
                if (conflict.action.entity === 'EVENT') {
                     await db.events.put({ ...conflict.serverData, syncStatus: 'SYNCED' });
                }
            } else {
                // Force Merge: Update local action with server's current version + 1
                const updatedAction: SyncJob = {
                    ...conflict.action,
                    payload: { ...conflict.action.payload, version: conflict.serverData.version, localVersion: conflict.serverData.version },
                    status: 'PENDING',
                    retryCount: 0,
                    errorLog: [...conflict.action.errorLog, 'User chose FORCE_MERGE']
                };
                await db.syncQueue.put(updatedAction);
                if (conflict.action.entity === 'EVENT') {
                     await db.events.update(conflict.action.payload.id, { syncStatus: 'PENDING', version: conflict.serverData.version + 1 });
                }
            }
        } catch (err) {
            console.error('[Palace-Engine] Arbitration failure', err);
        } finally {
            setOpen(false);
            setConflict(null);
            setTimeout(processSyncDaemon, 100); // Resume syncing
        }
    };

    if (!conflict) return null;

    return (
        <Dialog open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { background: '#161925', color: 'white' } }}>
            <DialogTitle sx={{ color: '#ef4444', fontWeight: 'bold' }}>DATA CONFLICT DETECTED</DialogTitle>
            <DialogContent>
                <Typography color="textSecondary" sx={{ mb: 3 }}>
                    The server has a newer version of this record. Saving your changes will overwrite someone else&apos;s recent updates.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ bgcolor: '#0c0e14', p: 2, border: '1px solid #27272a', overflow: 'auto', maxHeight: 160 }}>
                        <Typography variant="caption" sx={{ color: '#71717a', mb: 1, display: 'block' }}>Your Local Changes:</Typography>
                        <Typography variant="body2" component="pre" sx={{ color: '#93c5fd', m: 0 }}>
                            {JSON.stringify(conflict.action.payload, null, 2)}
                        </Typography>
                    </Box>
                    
                    <Box sx={{ bgcolor: '#0c0e14', p: 2, border: '1px solid #27272a', overflow: 'auto', maxHeight: 160 }}>
                        <Typography variant="caption" sx={{ color: '#71717a', mb: 1, display: 'block' }}>Server Record:</Typography>
                        <Typography variant="body2" component="pre" sx={{ color: '#34d399', m: 0 }}>
                            {JSON.stringify(conflict.serverData, null, 2)}
                        </Typography>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button variant="outlined" color="inherit" onClick={() => handleAction('KEEP_SERVER')}>
                    Discard My Changes
                </Button>
                <Button variant="contained" color="error" onClick={() => handleAction('FORCE_MERGE')}>
                    Force Save Overwrite
                </Button>
            </DialogActions>
        </Dialog>
    );
}
