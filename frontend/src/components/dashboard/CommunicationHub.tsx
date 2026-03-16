import { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, IconButton, Paper, Avatar, Drawer, Badge, useMediaQuery, useTheme } from '@mui/material';
import { Send, MessageSquare, X, Users } from 'lucide-react';
import { socket, connectSocket } from '../../utils/socket';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Message {
    id: string;
    content: string;
    senderId: string;
    sender: { name: string; role: string };
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
    
    const roomId = activeTab === 'ROOM' 
        ? (departmentId ? `dept-${departmentId}` : projectId ? `proj-${projectId}` : eventId ? `event-${eventId}` : 'church-wide')
        : [user?.id, selectedUser?.id].sort().join('-');

    const { data: messages } = useQuery(['messages', roomId], async () => {
        const params = activeTab === 'ROOM' 
            ? { departmentId, projectId, eventId, chatType: departmentId ? 'DEPARTMENT' : projectId ? 'PROJECT' : eventId ? 'EVENT' : 'GLOBAL' }
            : { receiverId: selectedUser?.id, chatType: 'PRIVATE' };
        const res = await api.get('/messages', { params });
        return res.data;
    }, { enabled: open && (activeTab === 'ROOM' || !!selectedUser) });

    const { data: users } = useQuery(['leaders'], async () => {
        const res = await api.get('/users', { params: { roles: ['SUPER_ADMIN', 'PASTOR', 'DEPARTMENT_LEADER'] } });
        return res.data.filter((u: any) => u.id !== user?.id);
    }, { enabled: open && activeTab === 'PRIVATE' });

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
                queryClient.setQueryData(['messages', roomId], (old: any) => [...(old || []), newMessage]);
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

    const sendMessage = async () => {
        if (!message.trim() || !user) return;
        if (activeTab === 'PRIVATE' && !selectedUser) return;

        try {
            const payload = activeTab === 'ROOM' 
                ? { content: message, senderId: user.id, departmentId, projectId, eventId, chatType: departmentId ? 'DEPARTMENT' : projectId ? 'PROJECT' : eventId ? 'EVENT' : 'GLOBAL' }
                : { content: message, senderId: user.id, receiverId: selectedUser.id, chatType: 'PRIVATE' };

            const res = await api.post('/messages', payload);
            socket.emit('send-message', { roomId, message: res.data });
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
                onClick={() => setOpen(true)}
                sx={{ 
                    position: 'fixed', 
                    bottom: isMobile ? 16 : 32, 
                    right: isMobile ? 16 : 32, 
                    bgcolor: 'primary.main', 
                    color: 'white',
                    p: isMobile ? 1.5 : 2,
                    boxShadow: '0 0 20px var(--primary-glow)',
                    zIndex: 1000,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': { bgcolor: 'primary.dark', transform: 'scale(1.1)' }
                }}
            >
                <Badge badgeContent={0} color="error">
                    <MessageSquare size={isMobile ? 22 : 24} />
                </Badge>
            </IconButton>

            <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, bgcolor: 'background.default', borderLeft: '1px solid var(--glass-border)' } }}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: isMobile ? 1.5 : 2, borderBottom: '1px solid var(--glass-border)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={isMobile ? 1.5 : 2}>
                            <Typography variant={isMobile ? "subtitle1" : "h6"} fontWeight="900" sx={{ letterSpacing: isMobile ? 0 : -0.5 }}>
                                {activeTab === 'ROOM' ? title : `Chat with ${selectedUser?.name || '...'}`}
                            </Typography>
                            <IconButton onClick={() => setOpen(false)} size="small"><X size={20} /></IconButton>
                        </Box>
                        
                        <Box display="flex" gap={1}>
                            <Paper 
                                onClick={() => { setActiveTab('ROOM'); setSelectedUser(null); }}
                                sx={{ 
                                    flex: 1, p: isMobile ? 0.75 : 1, textAlign: 'center', cursor: 'pointer',
                                    bgcolor: activeTab === 'ROOM' ? 'primary.main' : 'transparent',
                                    color: activeTab === 'ROOM' ? 'white' : 'inherit',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 2,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Typography variant="caption" fontWeight="bold" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>Group</Typography>
                            </Paper>
                            <Paper 
                                onClick={() => setActiveTab('PRIVATE')}
                                sx={{ 
                                    flex: 1, p: isMobile ? 0.75 : 1, textAlign: 'center', cursor: 'pointer',
                                    bgcolor: activeTab === 'PRIVATE' ? 'primary.main' : 'transparent',
                                    color: activeTab === 'PRIVATE' ? 'white' : 'inherit',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 2,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Typography variant="caption" fontWeight="bold" sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}>Private</Typography>
                            </Paper>
                        </Box>
                    </Box>

                    {activeTab === 'PRIVATE' && !selectedUser ? (
                        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 2, opacity: 0.6 }}>Select a leader to chat with:</Typography>
                            {users?.map((u: any) => (
                                <Box 
                                    key={u.id} 
                                    onClick={() => setSelectedUser(u)}
                                    sx={{ 
                                        p: 2, mb: 1, borderRadius: 2, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 2,
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                    }}
                                >
                                    <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} variant="dot" color={u.status === 'ONLINE' ? 'success' : 'default'} sx={{ '& .MuiBadge-badge': { width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--glass-bg)' } }}>
                                        <Avatar src={u.avatarUrl} sx={{ width: 40, height: 40 }} />
                                    </Badge>
                                    <Box>
                                        <Typography variant="body2" fontWeight="bold">{u.name}</Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.5 }}>{u.role}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: isMobile ? 1.5 : 3, display: 'flex', flexDirection: 'column', gap: isMobile ? 1.5 : 3 }}>
                            {activeTab === 'PRIVATE' && (
                                <IconButton size="small" onClick={() => setSelectedUser(null)} sx={{ alignSelf: 'flex-start', mb: isMobile ? 0 : -2 }}>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>← Back to Leaders</Typography>
                                </IconButton>
                            )}
                            {messages?.map((msg: any) => (
                                <Box key={msg.id} sx={{ alignSelf: msg.senderId === user?.id ? 'flex-end' : 'flex-start', maxWidth: isMobile ? '90%' : '85%' }}>
                                    {msg.isFlagged && user?.role === 'SUPER_ADMIN' && (
                                        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold', fontSize: '0.65rem' }}>⚠️ Flagged: {msg.flagReason}</Typography>
                                    )}
                                <Box display="flex" alignItems="center" gap={1} mb={0.5} flexDirection={msg.senderId === user?.id ? 'row-reverse' : 'row'}>
                                    <Avatar sx={{ width: isMobile ? 20 : 24, height: isMobile ? 20 : 24, fontSize: '0.5rem', fontWeight: 900, bgcolor: 'primary.main' }}>{msg.sender.name.charAt(0)}</Avatar>
                                    <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6, fontSize: isMobile ? '0.65rem' : '0.75rem' }}>{msg.sender.name}</Typography>
                                </Box>
                                <Paper sx={{ 
                                    p: isMobile ? 1.5 : 2, 
                                    bgcolor: msg.senderId === user?.id ? 'primary.main' : 'rgba(255,255,255,0.05)', 
                                    borderRadius: isMobile ? 2 : 3, 
                                    border: '1px solid var(--glass-border)',
                                    boxShadow: msg.senderId === user?.id ? '0 4px 12px rgba(var(--primary-rgb), 0.2)' : 'none'
                                }}>
                                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: isMobile ? '0.8rem' : '0.875rem', color: msg.senderId === user?.id ? 'white' : 'inherit', lineHeight: 1.4 }}>{msg.content}</Typography>
                                </Paper>
                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.4, textAlign: msg.senderId === user?.id ? 'right' : 'left', fontSize: '0.6rem' }}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                            </Box>
                        ))}
                        </Box>
                    )}

                    <Box sx={{ p: isMobile ? 2 : 3, borderTop: '1px solid var(--glass-border)', bgcolor: 'rgba(255,255,255,0.02)' }}>
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
                                        borderRadius: isMobile ? 2 : 3, 
                                        bgcolor: 'rgba(255,255,255,0.03)',
                                        fontSize: isMobile ? '0.8rem' : '0.875rem'
                                    } 
                                }}
                            />
                            <IconButton onClick={sendMessage} color="primary" sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, p: isMobile ? 1 : 1.5 }}>
                                <Send size={isMobile ? 18 : 20} />
                            </IconButton>
                        </Box>
                    </Box>
                </Box>
            </Drawer>
        </>
    );
};
