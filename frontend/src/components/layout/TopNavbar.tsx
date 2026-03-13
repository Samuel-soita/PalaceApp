import { Link, useLocation } from 'react-router-dom';
import { 
    AppBar, Toolbar, Typography, Box, IconButton, 
    Button, Drawer, List, ListItem, ListItemButton, 
    ListItemIcon, ListItemText, Avatar, Container, Divider,
    Menu, MenuItem, Badge
} from '@mui/material';
import { 
    LayoutDashboard, Users, Calendar, Bell, 
    MessageCircle, ClipboardList, Briefcase, Heart, 
    Menu as MenuIcon, X, Church, ChevronRight, Coins, LogOut
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api-client';

// Only these show on the top bar
const primaryNavItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Events', href: '/calendar', icon: Calendar },
    { name: 'Messages', href: '/messages', icon: MessageCircle },
    { name: 'Support', href: '/support', icon: Coins },
];

export default function TopNavbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const profileOpen = Boolean(anchorEl);

    const handleProfileClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleProfileClose = () => setAnchorEl(null);
    const handleLogout = () => { handleProfileClose(); logout(); };

    const { data: notifications } = useQuery(['notifications', user?.id], async () => {
        if (!user?.id) return [];
        const res = await api.get(`/notifications/user/${user.id}`);
        return res.data;
    }, { enabled: !!user?.id, refetchInterval: 10000 });

    const unreadCount = (notifications || []).filter((n: any) => !n.read).length || 0;

    // Everything shows in the drawer
    const allNavItems = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        user?.role === 'SUPER_ADMIN' 
            ? { name: 'Departments', href: '/departments', icon: Users }
            : { name: 'My Department', href: `/department/${user?.departmentId}`, icon: Users },
        { name: 'Projects', href: '/projects', icon: Briefcase },
        { name: 'Events', href: '/calendar', icon: Calendar },
        { name: 'Plans', href: '/plans', icon: ClipboardList },
        { name: 'Messages', href: '/messages', icon: MessageCircle },
        { name: 'Announcements', href: '/announcements', icon: Bell },
        { name: 'Support Hub', href: '/support', icon: Coins },
        { name: 'Prayer Requests', href: '/prayer-requests', icon: Heart },
    ];

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const drawer = (
        <Box sx={{ width: 280, pt: 2, height: '100%', bgcolor: 'background.paper' }} role="presentation">
            <Box px={3} pb={2} display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight="bold" color="primary" display="flex" alignItems="center" gap={1} className="glow-text">
                    <Church size={24} color="var(--cyan)" /> Hub
                </Typography>
                <IconButton onClick={handleDrawerToggle} sx={{ color: 'text.secondary' }}><X size={20} /></IconButton>
            </Box>
            
            <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.05)' }} />

            <List sx={{ px: 2 }}>
                {allNavItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <ListItem key={item.name} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton 
                                component={Link} 
                                to={item.href}
                                onClick={handleDrawerToggle}
                                sx={{ 
                                    borderRadius: 0, // SQUARE
                                    border: isActive ? '1px solid var(--primary-glow)' : '1px solid transparent',
                                    bgcolor: isActive ? 'rgba(79, 139, 255, 0.1)' : 'transparent',
                                    color: isActive ? 'primary.main' : 'text.secondary',
                                    '&:hover': { 
                                        bgcolor: 'rgba(79, 139, 255, 0.1)', 
                                        color: 'primary.main',
                                        border: '1px solid var(--primary-glow)'
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ color: isActive ? 'var(--cyan)' : 'inherit', minWidth: 40 }}>
                                    <Badge badgeContent={item.name === 'Announcements' || item.name === 'Messages' ? unreadCount : 0} color="error" variant="dot">
                                        <item.icon size={20} />
                                    </Badge>
                                </ListItemIcon>
                                <ListItemText 
                                    primary={item.name} 
                                    primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }} 
                                />
                                {isActive && <ChevronRight size={16} color="var(--primary)" />}
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Box>
    );

    return (
        <>
            <AppBar 
                position="sticky" 
                elevation={0}
                sx={{ 
                    background: 'var(--glass-base)',
                    backdropFilter: 'blur(30px)',
                    borderBottom: '1px solid var(--glass-border)',
                    color: 'text.primary',
                    zIndex: (theme) => theme.zIndex.drawer + 1
                }}
            >
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ minHeight: 70 }}>
                        {/* ALWAYS SHOW HAMBURGER MENU */}
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2, color: 'var(--cyan)' }}
                        >
                            <MenuIcon />
                        </IconButton>
                        
                        {/* Brand Logo */}
                        <Typography
                            variant="h5"
                            noWrap
                            component={Link}
                            to="/"
                            className="glow-text"
                            sx={{
                                mr: 4,
                                display: { xs: 'none', md: 'flex' },
                                alignItems: 'center',
                                gap: 1.5,
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                color: 'white',
                                textDecoration: 'none',
                            }}
                        >
                            <Church size={28} color="var(--cyan)" />
                            ChurchHub
                        </Typography>

                        {/* Primary Horizontal Navigation */}
                        <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
                            {primaryNavItems.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <Button
                                        key={item.name}
                                        component={Link}
                                        to={item.href}
                                        startIcon={
                                            <Badge badgeContent={item.name === 'Announcements' || item.name === 'Messages' ? unreadCount : 0} color="error" variant="dot" invisible={unreadCount === 0}>
                                                <item.icon size={18} />
                                            </Badge>
                                        }
                                        sx={{
                                            my: 2, 
                                            color: isActive ? 'white' : 'text.secondary',
                                            bgcolor: isActive ? 'rgba(79, 139, 255, 0.15)' : 'transparent',
                                            border: isActive ? '1px solid var(--primary-glow)' : '1px solid transparent',
                                            display: 'flex',
                                            textTransform: 'none',
                                            fontWeight: isActive ? 700 : 500,
                                            px: 2,
                                            borderRadius: 0, // SQUARE
                                            '&:hover': { 
                                                bgcolor: 'rgba(79, 139, 255, 0.2)', 
                                                color: 'white',
                                                border: '1px solid var(--cyan)'
                                            }
                                        }}
                                    >
                                        {item.name}
                                    </Button>
                                );
                            })}
                        </Box>

                        <Box sx={{ flexGrow: 0, ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                            {user?.role === 'SUPER_ADMIN' && (
                                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', border: '1px solid var(--cyan-glow)', bgcolor: 'rgba(188, 86, 83, 0.1)', color: 'var(--cyan)', px: 1.5, py: 0.5, borderRadius: 0, gap: 1 }}>
                                    <Briefcase size={16} />
                                    <Typography variant="caption" fontWeight="bold" letterSpacing="0.05em">EXECUTIVE</Typography>
                                </Box>
                            )}
                            <Avatar
                                onClick={handleProfileClick}
                                sx={{ 
                                    bgcolor: 'var(--primary)', width: 40, height: 40, 
                                    fontWeight: 'bold', borderRadius: 0, 
                                    border: '1px solid var(--primary-glow)',
                                    cursor: 'pointer',
                                    '&:hover': { border: '1px solid var(--cyan)', transform: 'scale(1.05)' },
                                    transition: 'all 0.2s'
                                }}
                            >
                                {user?.name?.charAt(0) || 'U'}
                            </Avatar>

                            {/* Profile Dropdown */}
                            <Menu
                                anchorEl={anchorEl}
                                open={profileOpen}
                                onClose={handleProfileClose}
                                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                                PaperProps={{
                                    sx: {
                                        mt: 1.5, minWidth: 200, borderRadius: 0,
                                        bgcolor: 'background.paper',
                                        border: '1px solid var(--glass-border)'
                                    }
                                }}
                            >
                                <Box sx={{ px: 2, py: 1.5 }}>
                                    <Typography variant="subtitle2" fontWeight={900} noWrap>{user?.name}</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>{user?.role?.replace('_', ' ')}</Typography>
                                </Box>
                                <Divider sx={{ borderColor: 'var(--glass-border)' }} />
                                <MenuItem
                                    onClick={handleLogout}
                                    sx={{
                                        gap: 1.5, py: 1.5, color: 'error.main',
                                        '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' }
                                    }}
                                >
                                    <LogOut size={16} />
                                    <Typography variant="body2" fontWeight={700}>Sign Out</Typography>
                                </MenuItem>
                            </Menu>
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>
            
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{ keepMounted: true }} 
                sx={{
                    '& .MuiDrawer-paper': { 
                        boxSizing: 'border-box', 
                        width: 280,
                        background: 'transparent' // Handled by inner Box
                    },
                }}
            >
                {drawer}
            </Drawer>
        </>
    );
}
