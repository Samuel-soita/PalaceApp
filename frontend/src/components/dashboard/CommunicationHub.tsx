import { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, IconButton, Paper, Avatar, Drawer, Badge } from '@mui/material';
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
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);
    const roomId = departmentId ? `dept-${departmentId}` : projectId ? `proj-${projectId}` : eventId ? `event-${eventId}` : 'church-wide';

    const { data: messages } = useQuery(['messages', roomId], async () => {
        const res = await api.get('/messages', { params: { departmentId, projectId, eventId } });
        return res.data;
    }, { enabled: open });

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
        try {
            const res = await api.post('/messages', {
                content: message,
                senderId: user.id,
                departmentId,
                projectId,
                eventId
            });
            socket.emit('send-message', { roomId, message: res.data });
            setMessage('');
        } catch (error) {
            console.error('Failed to send message', error);
        }
    };

    return (
        <>
            <IconButton 
                onClick={() => setOpen(true)}
                sx={{ 
                    position: 'fixed', 
                    bottom: 32, 
                    right: 32, 
                    bgcolor: 'primary.main', 
                    color: 'white',
                    p: 2,
                    boxShadow: '0 0 20px var(--primary-glow)',
                    '&:hover': { bgcolor: 'primary.dark' }
                }}
            >
                <Badge badgeContent={0} color="error">
                    <MessageSquare size={24} />
                </Badge>
            </IconButton>

            <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, bgcolor: 'background.default', borderLeft: '1px solid var(--glass-border)' } }}>
                <Box sx={{ h: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 3, borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.02)' }}>
                        <Box display="flex" alignItems="center" gap={2}>
                            <Users size={20} className="text-primary" />
                            <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: -1 }}>{title}</Typography>
                        </Box>
                        <IconButton onClick={() => setOpen(false)} size="small"><X size={20} /></IconButton>
                    </Box>

                    <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {messages?.map((msg: Message) => (
                            <Box key={msg.id} sx={{ alignSelf: msg.senderId === user?.id ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                <Box display="flex" alignItems="center" gap={1.5} mb={0.5} flexDirection={msg.senderId === user?.id ? 'row-reverse' : 'row'}>
                                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'primary.main' }}>{msg.sender.name.charAt(0)}</Avatar>
                                    <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6 }}>{msg.sender.name}</Typography>
                                </Box>
                                <Paper sx={{ p: 2, bgcolor: msg.senderId === user?.id ? 'primary.main' : 'rgba(255,255,255,0.05)', borderRadius: 3, border: '1px solid var(--glass-border)' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 500, color: msg.senderId === user?.id ? 'white' : 'inherit' }}>{msg.content}</Typography>
                                </Paper>
                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.4, textAlign: msg.senderId === user?.id ? 'right' : 'left', fontSize: '0.6rem' }}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    <Box sx={{ p: 3, borderTop: '1px solid var(--glass-border)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                        <Box display="flex" gap={1}>
                            <TextField 
                                fullWidth 
                                size="small" 
                                placeholder="Type a message..." 
                                value={message} 
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)' } }}
                            />
                            <IconButton onClick={sendMessage} color="primary" sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}>
                                <Send size={18} />
                            </IconButton>
                        </Box>
                    </Box>
                </Box>
            </Drawer>
        </>
    );
};
