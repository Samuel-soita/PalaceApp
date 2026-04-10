import { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, IconButton, Paper, Avatar, Drawer, Badge, useMediaQuery, useTheme } from '@mui/material';
import { Send, MessageSquare, X, Users, Shield } from 'lucide-react';
import { socket, connectSocket } from '../../utils/socket';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { encryptMessage, decryptMessage } from '../../lib/encryption';

interface Message {
    id: string;
    content: string;
    senderId: string;
    sender: { name: string; role: string; avatarUrl?: string };
    createdAt: string;
}

export const CommunicationHub = ({ departmentId, projectId, eventId, title = "Church-wide Comms" }: { departmentId?: string; projectId?: string; eventId?: string; title?: string }) => {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'ROOM' | 'PRIVATE'>('ROOM');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [lastActivity, setLastActivity] = useState(Date.now());
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // RULE: Communication is ONLY between leaders.
    
    const roomId = activeTab === 'ROOM' 
        ? (departmentId ? `dept-${departmentId}` : projectId ? `proj-${projectId}` : eventId ? `event-${eventId}` : 'church-wide')
        : [user?.id, selectedUser?.id].sort().join('-');

    const { data: messages, error: messagesError } = useQuery(['messages', roomId], async () => {
        const params = activeTab === 'ROOM' 
            ? { departmentId, projectId, eventId, chatType: departmentId ? 'DEPARTMENT' : projectId ? 'PROJECT' : eventId ? 'EVENT' : 'GLOBAL' }
            : { receiverId: selectedUser?.id, chatType: 'PRIVATE' };
        try {
            const res = await api.get('/messages', { params });
            return res.data;
        } catch (err: any) {
            if (err.response?.status === 403) return [];
            throw err;
        }
    }, { enabled: open && (activeTab === 'ROOM' || !!selectedUser), retry: false });

    // --- MISSION: OFFLINE-FIRST LEADER LIST ---
    const users = useLiveQuery(() => 
        db.users.filter(u => u.id !== user?.id && ['SUPER_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER', 'BISHOP'].includes(u.role)).toArray()
    , [user?.id]) || [];

    // Inactivity Tracker
    useEffect(() => {
        if (!user) return;
        const timer = setInterval(() => {
            if (Date.now() - lastActivity > 10 * 60 * 1000) {
                socket.emit('update-status', { userId: user.id, status: 'OFFLINE' });
            }
        }, 60000);
        return () => clearInterval(timer);
    }, [lastActivity, user]);

    useEffect(() => {
        const updateActivity = () => {
            setLastActivity(Date.now());
            if (user) socket.emit('update-status', { userId: user.id, status: 'ONLINE' });
        };
        window.addEventListener('mousedown', updateActivity);
        window.addEventListener('keydown', updateActivity);
        return () => {
            window.removeEventListener('mousedown', updateActivity);
            window.removeEventListener('keydown', updateActivity);
        };
    }, [user]);

    useEffect(() => {
        if (open && user) {
            connectSocket(user.id);
            socket.emit('join-room', roomId);

            const handleNewMessage = (newMessage: Message) => {
                queryClient.setQueryData(['messages', roomId], (old: any) => {
                    const existing = old || [];
                    if (existing.some((m: any) => m.id === newMessage.id)) return existing;
                    return [...existing, newMessage];
                });
            };

            socket.on('new-message', handleNewMessage);
            return () => {
                socket.off('new-message', handleNewMessage);
            };
        }
    }, [open, roomId, user, queryClient]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!user || user.role === 'MEMBER') return null;

    const sendMessage = async () => {
        if (!message.trim() || !user) return;
        if (activeTab === 'PRIVATE' && !selectedUser) return;

        try {
            const payload = activeTab === 'ROOM' 
                ? { content: encryptMessage(message, roomId), senderId: user.id, departmentId, projectId, eventId, chatType: departmentId ? 'DEPARTMENT' : projectId ? 'PROJECT' : eventId ? 'EVENT' : 'GLOBAL' }
                : { content: encryptMessage(message, roomId), senderId: user.id, receiverId: selectedUser.id, chatType: 'PRIVATE' };

            const res = await api.post('/messages', payload);
            setMessage('');
        } catch (error: any) {
            console.error('Failed to send message', error);
            // Show suspension error if applicable
            if (error.response?.status === 403) {
                alert(error.response.data.error);
            }
        }
    };

    return (
        <>
            <IconButton 
                onClick={() => setOpen(!open)}
                sx={{ 
                    position: 'fixed', 
                    bottom: isMobile ? 16 : 32, 
                    right: isMobile ? 16 : 32, 
                    bgcolor: 'primary.main', 
                    color: 'white',
                    p: isMobile ? 1.5 : 2,
                    boxShadow: '0 0 20px var(--primary-glow)',
                    zIndex: 2001,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': { bgcolor: 'primary.dark', transform: 'scale(1.1)' }
                }}
            >
                <Badge badgeContent={0} color="error">
                    {open ? <X size={isMobile ? 22 : 24} /> : <MessageSquare size={isMobile ? 22 : 24} />}
                </Badge>
            </IconButton>

            <Box 
                sx={{ 
                    position: 'fixed',
                    bottom: isMobile ? 0 : 96,
                    right: isMobile ? 0 : 32,
                    width: isMobile ? '100%' : 380,
                    height: isMobile ? '100%' : 540,
                    maxHeight: isMobile ? '100%' : 'calc(100vh - 120px)',
                    bgcolor: 'background.paper',
                    border: '1px solid var(--glass-border)',
                    borderRadius: isMobile ? 0 : 3,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    display: open ? 'flex' : 'none',
                    flexDirection: 'column',
                    zIndex: 2000,
                    overflow: 'hidden',
                    transform: open ? 'translateY(0)' : 'translateY(20px)',
                    opacity: open ? 1 : 0,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: isMobile ? 1.5 : 2, borderBottom: '1px solid var(--glass-border)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight="950" sx={{ letterSpacing: -0.5 }}>
                                {activeTab === 'ROOM' ? title : `Chat with ${selectedUser?.name || '...'}`}
                            </Typography>
                            <IconButton onClick={() => setOpen(false)} size="small" sx={{ display: isMobile ? 'flex' : 'none' }}>
                                <X size={20} />
                            </IconButton>
                        </Box>
                        
                        <Box display="flex" gap={1}>
                            <Paper 
                                onClick={() => { setActiveTab('ROOM'); setSelectedUser(null); }}
                                sx={{ 
                                    flex: 1, p: 0.75, textAlign: 'center', cursor: 'pointer',
                                    bgcolor: activeTab === 'ROOM' ? 'primary.main' : 'transparent',
                                    color: activeTab === 'ROOM' ? 'white' : 'inherit',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 1.5,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.65rem', letterSpacing: 1 }}>GROUP</Typography>
                            </Paper>
                            <Paper 
                                onClick={() => setActiveTab('PRIVATE')}
                                sx={{ 
                                    flex: 1, p: 0.75, textAlign: 'center', cursor: 'pointer',
                                    bgcolor: activeTab === 'PRIVATE' ? 'primary.main' : 'transparent',
                                    color: activeTab === 'PRIVATE' ? 'white' : 'inherit',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 1.5,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Typography variant="caption" fontWeight="950" sx={{ fontSize: '0.65rem', letterSpacing: 1 }}>PRIVATE</Typography>
                            </Paper>
                        </Box>
                    </Box>

                    {activeTab === 'PRIVATE' && !selectedUser ? (
                        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                            <Typography variant="caption" sx={{ mb: 2, opacity: 0.5, fontWeight: 950, letterSpacing: 1 }}>SELECT LEADER:</Typography>
                            {users?.map((u: any) => (
                                <Box 
                                    key={u.id} 
                                    onClick={() => setSelectedUser(u)}
                                    sx={{ 
                                        p: 1.5, mb: 1, borderRadius: 2, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 2,
                                        border: '1px solid transparent',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)' }
                                    }}
                                >
                                    <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} variant="dot" color={u.status === 'ONLINE' ? 'success' : 'default'} sx={{ '& .MuiBadge-badge': { width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--glass-bg)' } }}>
                                        <Avatar src={u.avatarUrl} sx={{ width: 36, height: 36 }} />
                                    </Badge>
                                    <Box>
                                        <Typography variant="body2" fontWeight="950" sx={{ fontSize: '0.85rem' }}>{u.name}</Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800 }}>{u.role}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {activeTab === 'PRIVATE' && (
                                <IconButton size="small" onClick={() => setSelectedUser(null)} sx={{ alignSelf: 'flex-start' }}>
                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 900 }}>← BACK</Typography>
                                </IconButton>
                            )}
                            {messagesError && (
                                <Box sx={{ p: 4, textAlign: 'center', opacity: 0.5 }}>
                                    <Shield size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                                    <Typography variant="caption" fontWeight="1000" sx={{ display: 'block', letterSpacing: 1 }}>AUTHENTICATION ERROR</Typography>
                                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>LEADERSHIP SECURE CHANNEL DISCONNECTED</Typography>
                                </Box>
                            )}
                            {!messagesError && messages?.length === 0 && (
                                <Typography variant="caption" sx={{ textAlign: 'center', opacity: 0.3, py: 8, fontWeight: 900 }}>NO MESSAGES IN THIS FREQUENCY</Typography>
                            )}
                            {messages?.map((msg: any) => (
                                <Box key={msg.id} sx={{ alignSelf: msg.senderId === user?.id ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                    {msg.isFlagged && user?.role === 'SUPER_ADMIN' && (
                                        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5, fontWeight: '950', fontSize: '0.6rem' }}>⚠️ FLAGGED</Typography>
                                    )}
                                <Box display="flex" alignItems="center" gap={1} mb={0.5} flexDirection={msg.senderId === user?.id ? 'row-reverse' : 'row'}>
                                    <Avatar src={msg.sender.avatarUrl || undefined} sx={{ width: 20, height: 20, fontSize: '0.45rem', fontWeight: 950, bgcolor: 'primary.main' }}>{!msg.sender.avatarUrl && msg.sender.name.charAt(0)}</Avatar>
                                    <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.6, fontSize: '0.7rem' }}>{msg.sender.name}</Typography>
                                </Box>
                                <Paper sx={{ 
                                    p: 1.5, 
                                    bgcolor: msg.senderId === user?.id ? 'primary.main' : 'rgba(255,255,255,0.05)', 
                                    borderRadius: 2, 
                                    border: '1px solid var(--glass-border)',
                                    boxShadow: msg.senderId === user?.id ? '0 4px 12px rgba(var(--primary-rgb), 0.2)' : 'none'
                                }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', color: msg.senderId === user?.id ? 'white' : 'inherit', lineHeight: 1.4 }}>{decryptMessage(msg.content, roomId)}</Typography>
                                </Paper>
                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.4, textAlign: msg.senderId === user?.id ? 'right' : 'left', fontSize: '0.55rem' }}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                            </Box>
                        ))}
                        </Box>
                    )}

                    <Box sx={{ p: 2, borderTop: '1px solid var(--glass-border)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                        <Box display="flex" gap={1}>
                            <TextField 
                                fullWidth 
                                size="small" 
                                placeholder="Type a message..." 
                                value={message} 
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        borderRadius: 2, 
                                        bgcolor: 'rgba(255,255,255,0.03)',
                                        fontSize: '0.8rem'
                                    } 
                                }}
                            />
                            <IconButton onClick={sendMessage} color="primary" sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, p: 1 }}>
                                <Send size={18} />
                            </IconButton>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </>
    );
};
