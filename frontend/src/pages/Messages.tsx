import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
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
import { encryptMessage, decryptMessage } from '../lib/encryption';
import { canSendChurchWideComms } from '../utils/approval-rules';
import { executeApiFirstMutation } from '../lib/api-first-mutation';

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
    const theme = useTheme();
    const [newMessage, setNewMessage] = useState('');
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Mentions state
    const [tagAnchorEl, setTagAnchorEl] = useState<null | HTMLElement>(null);
    const [taggedDepts, setTaggedDepts] = useState<any[]>([]);
    const [taggedUsers, setTaggedUsers] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Context Menu state
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);

    const effectiveDeptId = user?.departmentId;

    const messages = useLiveQuery(
        () => effectiveDeptId 
            ? db.messages.where('departmentId').equals(effectiveDeptId).sortBy('createdAt')
            : db.messages.orderBy('createdAt').toArray(), 
        [effectiveDeptId]
    ) || [];

    const department = useLiveQuery(
        () => effectiveDeptId ? db.departments.get(effectiveDeptId) : undefined,
        [effectiveDeptId]
    );

    const allDepartments = useLiveQuery(() => db.departments.toArray(), []) || [];

    const handleAction = async (payload: any, method: 'POST' | 'PATCH' | 'DELETE', id?: string) => {
        const actionId = id || payload.id;

        try {
            const result = await executeApiFirstMutation({
                entity: 'MESSAGE',
                method,
                url: method === 'POST' ? '/messages' : `/messages/${actionId}`,
                payload,
                recordId: actionId,
                table: 'messages',
                offlineOptimistic: async (offlineId) => {
                    if (method === 'DELETE') {
                        if (id) await db.messages.update(id, { isDeleted: true, content: 'This message was deleted' });
                        return;
                    }
                    await db.messages.put({
                        ...payload,
                        id: offlineId,
                        syncStatus: 'PENDING',
                        createdAt: new Date().toISOString(),
                        sender: { name: user?.name, role: user?.role },
                    });
                },
            });

            if (method === 'POST') {
                const saved = result?.data?.data ?? result?.data ?? payload;
                socket?.emit('send_message', { ...saved, id: saved.id || actionId });
            }

            setEditingMsgId(null);
            setNewMessage('');
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to send message.');
        }
    };

    useEffect(() => {
        if (!user) return;
        const newSocket = io(import.meta.env.VITE_API_URL || window.location.origin, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
        });
        setSocket(newSocket);

        newSocket.on('receive_message', (message: Message) => {
            db.messages.put({ ...message, syncStatus: 'SYNCED', version: 1 } as any);
        });

        newSocket.on('message_edited', (updatedMsg: Message) => {
            db.messages.put({ ...updatedMsg, syncStatus: 'SYNCED', version: 1 } as any);
        });

        newSocket.on('message_deleted', ({ id }: { id: string }) => {
            db.messages.update(id, { isDeleted: true, content: 'This message was deleted' });
        });

        return () => { newSocket.close(); };
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;
        if (!effectiveDeptId && !canSendChurchWideComms(user.role)) return;
        
        const roomId = effectiveDeptId ? `dept-${effectiveDeptId}` : 'church-wide';
        if (editingMsgId) {
            handleAction({ id: editingMsgId, content: encryptMessage(newMessage, roomId) }, 'PATCH', editingMsgId);
        } else {
            handleAction({
                content: encryptMessage(newMessage, roomId),
                senderId: user.id,
                departmentId: effectiveDeptId || null,
                taggedDepartmentIds: taggedDepts.map(d => d.id),
                taggedUserIds: taggedUsers.map(u => u.id)
            }, 'POST');
            setTaggedDepts([]);
            setTaggedUsers([]);
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
        const roomId = effectiveDeptId ? `dept-${effectiveDeptId}` : 'church-wide';
        if (selectedMsg) {
            setEditingMsgId(selectedMsg.id);
            setNewMessage(decryptMessage(selectedMsg.content, roomId));
        }
        handleCloseMenu();
    };

    const handleDelete = () => {
        if (selectedMsg) {
            handleAction({ id: selectedMsg.id }, 'DELETE', selectedMsg.id);
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

    const toggleUserTag = (tagUser: any) => {
        if (taggedUsers.find(u => u.id === tagUser.id)) {
            setTaggedUsers(taggedUsers.filter(u => u.id !== tagUser.id));
        } else {
            setTaggedUsers([...taggedUsers, tagUser]);
        }
    };

    useEffect(() => {
        if (!userSearch || userSearch.length < 2) {
            setSearchResults([]);
            return;
        }
        const delay = setTimeout(async () => {
            try {
                const res = await api.get(`/users/search-members?query=${userSearch}`);
                setSearchResults(res.data);
            } catch (err) {
                console.error('Search failed:', err);
            }
        }, 300);
        return () => clearTimeout(delay);
    }, [userSearch]);

    if (messages === undefined) return <DashboardLayout><Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box></DashboardLayout>;

    return (
        <DashboardLayout>
            <Box mb={4} display="flex" alignItems="center" gap={2}>
                <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                    <MessageSquare size={28} />
                </div>
                <div>
                    <Typography variant="h3" fontWeight="950" sx={{ letterSpacing: -2, fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
                        {effectiveDeptId ? 'SECTOR' : 'CHURCH'} <span className="text-primary">COMMS</span>
                    </Typography>
                    <Typography color="textSecondary" sx={{ opacity: 0.7, fontWeight: 500 }}>
                        <Hash size={14} className="inline mr-1 opacity-50"/> 
                        {effectiveDeptId ? department?.name?.toLowerCase().replace(/\s+/g, '-') : 'general-intelligence'}
                    </Typography>
                </div>
            </Box>

            <Card className="holographic-card" sx={{
                minHeight: { xs: '55vh', md: 'auto' },
                height: { xs: 'auto', md: 'calc(100vh - 220px)' },
                maxHeight: { xs: '75vh', md: 'none' },
                display: 'flex',
                flexDirection: 'column',
            }}>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {(Array.isArray(messages) ? messages : []).length === 0 ? (
                        <Box m="auto" textAlign="center" sx={{ opacity: 0.5 }}>
                            <MessageSquare size={48} className="mx-auto mb-4" />
                            <Typography>No communications yet. Start the transmission.</Typography>
                        </Box>
                    ) : (
                        (Array.isArray(messages) ? messages : []).map((msg: any, i: number) => {
                            const isMe = msg.senderId === user?.id;
                            const showHeader = i === 0 || messages[i - 1].senderId !== msg.senderId;
                            
                            return (
                                <Box key={msg.id} sx={{ display: 'flex', gap: 2, alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: { xs: '95%', sm: '80%' } }}>
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
                                                {msg.isDeleted ? msg.content : decryptMessage(msg.content, effectiveDeptId ? `dept-${effectiveDeptId}` : 'church-wide')}
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
                                                        right: { xs: 4, md: -30 }, 
                                                        top: '50%', 
                                                        transform: 'translateY(-50%)',
                                                        opacity: { xs: 1, md: 0 },
                                                        '@media (hover: hover)': {
                                                            '.MuiPaper-root:hover &': { opacity: 1 },
                                                        },
                                                        transition: 'opacity 0.2s',
                                                        color: 'text.secondary',
                                                        minWidth: 44,
                                                        minHeight: 44,
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
                    {taggedUsers.map(tagUser => (
                        <Chip 
                            key={tagUser.id}
                            label={`@${tagUser.name}`}
                            onDelete={() => toggleUserTag(tagUser)}
                            size="small"
                            sx={{ bgcolor: 'secondary.dark', color: 'white', borderRadius: 1 }}
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
                            disabled={!newMessage.trim()}
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
            <Menu 
                anchorEl={tagAnchorEl} 
                open={Boolean(tagAnchorEl)} 
                onClose={() => setTagAnchorEl(null)}
                PaperProps={{ sx: { width: 280, maxHeight: 400, bgcolor: 'hsla(230,25%,15%,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' } }}
            >
                <Box p={2} pb={1}>
                    <TextField 
                        fullWidth 
                        size="small" 
                        placeholder="Search member name..." 
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        autoFocus
                    />
                </Box>

                {searchResults.length > 0 && (
                    <>
                        <Typography sx={{ p: 1, px: 2, fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>MEMBERS</Typography>
                        {searchResults.map((u: any) => (
                            <MenuItem key={u.id} onClick={() => { toggleUserTag(u); setTagAnchorEl(null); setUserSearch(''); }}>
                                <Avatar src={u.avatarUrl} sx={{ width: 20, height: 20, mr: 1, fontSize: '0.6rem' }}>{u.name[0]}</Avatar>
                                <Typography variant="body2">{u.name}</Typography>
                                {taggedUsers.find(tu => tu.id === u.id) && <Check size={14} className="ml-auto" />}
                            </MenuItem>
                        ))}
                        <Divider sx={{ my: 1, opacity: 0.1 }} />
                    </>
                )}

                <Typography sx={{ p: 1, px: 2, fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>SECTORS</Typography>
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
