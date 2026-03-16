import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import {
    Box, Typography, Card, CardContent, TextField, IconButton, Avatar,
    CircularProgress, Divider, Paper, useTheme, Menu, MenuItem, Tooltip,
    InputAdornment, Chip
} from '@mui/material';
import { Send, Hash, Users, MessageSquare, MoreVertical, Edit2, Trash2, AtSign, Check } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api-client';

interface Message {
    id: string;
    content: string;
    senderId: string;
    sender: { name: string; role: string; avatarUrl?: string | null };
    isEdited?: boolean;
    isDeleted?: boolean;
    createdAt: string;
}

export default function Messages() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const theme = useTheme();
    const [newMessage, setNewMessage] = useState('');
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Mentions state
    const [tagAnchorEl, setTagAnchorEl] = useState<null | HTMLElement>(null);
    const [taggedDepts, setTaggedDepts] = useState<any[]>([]);

    // Context Menu state
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);

    const effectiveDeptId = user?.departmentId;

    // Fetch Messages
    const { data: messages, isLoading } = useQuery(['messages', effectiveDeptId], async () => {
        const url = effectiveDeptId ? `/messages?departmentId=${effectiveDeptId}` : '/messages';
        const res = await api.get(url);
        return res.data;
    }, { enabled: !!user });

    // Fetch Department Info
    const { data: department } = useQuery(['department', effectiveDeptId], async () => {
        if (!effectiveDeptId) return null;
        const res = await api.get(`/departments/${effectiveDeptId}`);
        return res.data;
    }, { enabled: !!effectiveDeptId });

    // Fetch All Departments for Mentions
    const { data: allDepartments } = useQuery(['all-departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    });

    const createMessageMutation = useMutation(
        (data: any) => api.post('/messages', data),
        {
            onSuccess: (data) => {
                queryClient.setQueryData(['messages', effectiveDeptId], (old: any) => [...(old || []), data]);
                socket?.emit('send_message', data);
                setTaggedDepts([]);
            }
        }
    );

    const updateMessageMutation = useMutation(
        (data: { id: string, content: string }) => api.patch(`/messages/${data.id}`, { content: data.content }),
        {
            onSuccess: (updated) => {
                queryClient.setQueryData(['messages', effectiveDeptId], (old: any) => 
                    old?.map((m: any) => m.id === updated.data.id ? updated.data : m)
                );
                setEditingMsgId(null);
                setNewMessage('');
            }
        }
    );

    const deleteMessageMutation = useMutation(
        (id: string) => api.delete(`/messages/${id}`),
        {
            onSuccess: (_, id) => {
                queryClient.setQueryData(['messages', effectiveDeptId], (old: any) => 
                    old?.map((m: any) => m.id === id ? { ...m, isDeleted: true, content: 'This message was deleted' } : m)
                );
            }
        }
    );

    useEffect(() => {
        if (!user) return;
        // @ts-ignore
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000');
        setSocket(newSocket);

        newSocket.on('receive_message', (message: Message) => {
            queryClient.setQueryData(['messages', effectiveDeptId], (old: any) => {
                const isDuplicate = old?.some((m: Message) => m.id === message.id);
                if (isDuplicate) return old;
                return [...(old || []), message];
            });
        });

        newSocket.on('message_edited', (updatedMsg: Message) => {
            queryClient.setQueryData(['messages', effectiveDeptId], (old: any) => 
                old?.map((m: any) => m.id === updatedMsg.id ? updatedMsg : m)
            );
        });

        newSocket.on('message_deleted', ({ id }: { id: string }) => {
            queryClient.setQueryData(['messages', effectiveDeptId], (old: any) => 
                old?.map((m: any) => m.id === id ? { ...m, isDeleted: true, content: 'This message was deleted' } : m)
            );
        });

        return () => { newSocket.close(); };
    }, [user, effectiveDeptId, queryClient]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;
        if (!effectiveDeptId && user?.role !== 'SUPER_ADMIN') return;
        
        if (editingMsgId) {
            updateMessageMutation.mutate({ id: editingMsgId, content: newMessage });
        } else {
            createMessageMutation.mutate({
                content: newMessage,
                senderId: user.id,
                departmentId: effectiveDeptId || null,
                taggedDepartmentIds: taggedDepts.map(d => d.id)
            });
            setNewMessage('');
        }
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, msg: Message) => {
        setMenuAnchorEl(event.currentTarget);
        setSelectedMsg(msg);
    };

    const handleCloseMenu = () => {
        setMenuAnchorEl(null);
        setSelectedMsg(null);
    };

    const startEdit = () => {
        if (selectedMsg) {
            setEditingMsgId(selectedMsg.id);
            setNewMessage(selectedMsg.content);
        }
        handleCloseMenu();
    };

    const handleDelete = () => {
        if (selectedMsg) {
            deleteMessageMutation.mutate(selectedMsg.id);
        }
        handleCloseMenu();
    };

    const toggleDeptTag = (dept: any) => {
        if (taggedDepts.find(d => d.id === dept.id)) {
            setTaggedDepts(taggedDepts.filter(d => d.id !== dept.id));
        } else {
            setTaggedDepts([...taggedDepts, dept]);
        }
    };

    if (isLoading) return <DashboardLayout><Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box></DashboardLayout>;

    return (
        <DashboardLayout>
            <Box mb={4} display="flex" alignItems="center" gap={2}>
                <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                    <MessageSquare size={28} />
                </div>
                <div>
                    <Typography variant="h3" fontWeight="950" sx={{ letterSpacing: -2 }}>
                        {effectiveDeptId ? 'SECTOR' : 'CHURCH'} <span className="text-primary">COMMS</span>
                    </Typography>
                    <Typography color="textSecondary" sx={{ opacity: 0.7, fontWeight: 500 }}>
                        <Hash size={14} className="inline mr-1 opacity-50"/> 
                        {effectiveDeptId ? department?.name?.toLowerCase().replace(/\s+/g, '-') : 'general-intelligence'}
                    </Typography>
                </div>
            </Box>

            <Card className="holographic-card" sx={{ height: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {messages?.length === 0 ? (
                        <Box m="auto" textAlign="center" sx={{ opacity: 0.5 }}>
                            <MessageSquare size={48} className="mx-auto mb-4" />
                            <Typography>No communications yet. Start the transmission.</Typography>
                        </Box>
                    ) : (
                        messages?.map((msg: Message, i: number) => {
                            const isMe = msg.senderId === user?.id;
                            const showHeader = i === 0 || messages[i - 1].senderId !== msg.senderId;
                            
                            return (
                                <Box key={msg.id} sx={{ display: 'flex', gap: 2, alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                    {!isMe && showHeader && (
                                        <Avatar 
                                            src={msg.sender?.avatarUrl || undefined}
                                            sx={{ 
                                                width: 32, 
                                                height: 32, 
                                                bgcolor: 'primary.dark', 
                                                fontSize: '0.8rem', 
                                                mt: 1,
                                                opacity: msg.sender?.avatarUrl ? 1 : 0.3 
                                            }}
                                        >
                                            {!msg.sender?.avatarUrl && <Users size={16} />}
                                        </Avatar>
                                    )}
                                    {!isMe && !showHeader && <Box sx={{ width: 32 }} />}
                                    
                                    <Box sx={{ position: 'relative', '&:hover .msg-options': { opacity: 1 } }}>
                                        {showHeader && (
                                            <Box display="flex" alignItems="center" gap={1} mb={0.5} justifyContent={isMe ? 'flex-end' : 'flex-start'}>
                                                <Typography variant="caption" fontWeight="900" sx={{ opacity: 0.9 }}>
                                                    {isMe ? 'You' : (msg.sender?.name || 'Unknown User')}
                                                </Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.65rem' }}>
                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Typography>
                                                {!isMe && msg.sender?.role === 'DEPARTMENT_LEADER' && (
                                                    <span className="neon-label" style={{ fontSize: '0.5rem', padding: '2px 4px' }}>COMMANDER</span>
                                                )}
                                            </Box>
                                        )}
                                        <Paper sx={{ 
                                            p: 2, 
                                            px: 3,
                                            borderRadius: isMe ? '1.5rem 0.5rem 1.5rem 1.5rem' : '0.5rem 1.5rem 1.5rem 1.5rem',
                                            bgcolor: isMe ? 'primary.main' : 'hsla(230,25%,20%,0.8)',
                                            color: isMe ? 'primary.contrastText' : 'text.primary',
                                            border: '1px solid',
                                            borderColor: isMe ? 'primary.light' : 'rgba(255,255,255,0.05)',
                                            boxShadow: isMe ? '0 5px 20px -5px var(--primary-glow)' : 'none',
                                            backdropFilter: 'blur(10px)',
                                            position: 'relative',
                                            opacity: msg.isDeleted ? 0.6 : 1,
                                            fontStyle: msg.isDeleted ? 'italic' : 'normal'
                                        }}>
                                            <Typography variant="body1" sx={{ lineHeight: 1.5 }}>
                                                {msg.content}
                                                {msg.isEdited && !msg.isDeleted && (
                                                    <Typography variant="caption" sx={{ ml: 1, opacity: 0.5, fontSize: '0.6rem' }}>(edited)</Typography>
                                                )}
                                            </Typography>

                                            {isMe && !msg.isDeleted && (
                                                <IconButton 
                                                    className="msg-options"
                                                    size="small" 
                                                    onClick={(e) => handleOpenMenu(e, msg)}
                                                    sx={{ 
                                                        position: 'absolute', 
                                                        right: -30, 
                                                        top: '50%', 
                                                        transform: 'translateY(-50%)',
                                                        opacity: 0,
                                                        transition: 'opacity 0.2s',
                                                        color: 'text.secondary'
                                                    }}
                                                >
                                                    <MoreVertical size={16} />
                                                </IconButton>
                                            )}
                                        </Paper>
                                    </Box>
                                </Box>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </Box>
                
                <Divider sx={{ borderColor: 'var(--glass-border)' }} />
                
                <Box sx={{ p: 2, px: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {taggedDepts.map(dept => (
                        <Chip 
                            key={dept.id}
                            label={`@${dept.name}`}
                            onDelete={() => toggleDeptTag(dept)}
                            size="small"
                            sx={{ bgcolor: 'primary.dark', color: 'white', borderRadius: 1 }}
                        />
                    ))}
                </Box>

                <Box component="form" onSubmit={handleSend} sx={{ p: 3, bgcolor: 'hsla(0,0%,0%,0.2)' }}>
                    <Box display="flex" gap={2}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder={editingMsgId ? "Edit your message..." : "Type a secure message..."}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Tooltip title="Mention Department">
                                            <IconButton onClick={(e) => setTagAnchorEl(e.currentTarget)} size="small" color="primary">
                                                <AtSign size={18} />
                                            </IconButton>
                                        </Tooltip>
                                    </InputAdornment>
                                ),
                                sx: { 
                                    borderRadius: 3, 
                                    bgcolor: 'hsla(255,255,255,0.03)',
                                    '& fieldset': { borderColor: editingMsgId ? 'var(--primary) !important' : 'var(--glass-border) !important' },
                                    '&:hover fieldset': { borderColor: 'var(--primary) !important' }
                                }
                            }}
                        />
                        <IconButton 
                            type="submit" 
                            disabled={!newMessage.trim() || createMessageMutation.isLoading || updateMessageMutation.isLoading}
                            sx={{ 
                                bgcolor: editingMsgId ? 'success.main' : 'primary.main', 
                                color: 'white',
                                borderRadius: 3,
                                width: 56,
                                height: 56,
                                '&:hover': { bgcolor: editingMsgId ? 'success.light' : 'primary.light', boxShadow: '0 0 20px var(--primary-glow)' },
                                '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }
                            }}
                        >
                            {editingMsgId ? <Check size={20} /> : <Send size={20} />}
                        </IconButton>
                        {editingMsgId && (
                            <IconButton onClick={() => { setEditingMsgId(null); setNewMessage(''); }} sx={{ borderRadius: 3 }}>
                                <Trash2 size={20} />
                            </IconButton>
                        )}
                    </Box>
                </Box>
            </Card>

            {/* Message Options Menu */}
            <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleCloseMenu}>
                <MenuItem onClick={startEdit} sx={{ gap: 2 }}>
                    <Edit2 size={16} /> Edit
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ gap: 2, color: 'error.main' }}>
                    <Trash2 size={16} /> Delete
                </MenuItem>
            </Menu>

            {/* Mentions Menu */}
            <Menu anchorEl={tagAnchorEl} open={Boolean(tagAnchorEl)} onClose={() => setTagAnchorEl(null)}>
                <Typography sx={{ p: 1, px: 2, fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>MENTION SECTOR</Typography>
                {allDepartments?.map((dept: any) => (
                    <MenuItem key={dept.id} onClick={() => { toggleDeptTag(dept); setTagAnchorEl(null); }}>
                        {taggedDepts.find(d => d.id === dept.id) ? <Check size={14} className="mr-2" /> : <Hash size={14} className="mr-2" />}
                        {dept.name}
                    </MenuItem>
                ))}
            </Menu>
        </DashboardLayout>
    );
}
