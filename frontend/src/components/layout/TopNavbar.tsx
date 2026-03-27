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
    Menu as MenuIcon, X, Church, ChevronRight, Coins, LogOut,
    Search as SearchIcon, Command, Zap, UserCheck, Baby, TrendingUp, Shield
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api-client';
import ProfileModal from '../modals/ProfileModal';
import { useRoutePreloader } from '../../hooks/useRoutePreloader';


// Base items for admin roles
const adminNavItems = [
    { name: 'EXECUTIVE PALACE', href: '/', icon: LayoutDashboard },
    { name: 'Announcements', href: '/announcements', icon: Bell },
    { name: 'Events', href: '/calendar', icon: Calendar },
    { name: 'Support', href: '/support', icon: Coins },
];

// Base items for regular members
const memberNavItems = [
    { name: 'PRAYER PALACE', href: '/', icon: LayoutDashboard },
    { name: 'My Profile', href: '/profile', icon: UserCheck },
    { name: 'Register Child', href: '/register-child', icon: Baby },
];

export default function TopNavbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const profileOpen = Boolean(anchorEl);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const { preloadRoute } = useRoutePreloader();

    const handleProfileClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleProfileClose = () => setAnchorEl(null);
    const handleLogout = () => { handleProfileClose(); logout(); };

    // Handle outside click for search
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Perform search
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchQuery.trim().length > 2) {
                try {
                    const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
                    setSearchResults(res.data);
                    setSearchOpen(true);
                } catch (error) {
                    console.error("Search failed:", error);
                }
            } else {
                setSearchResults(null);
                setSearchOpen(false);
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const { data: notifications } = useQuery(['notifications', user?.id], async () => {
        if (!user?.id) return [];
        const res = await api.get(`/notifications/user/${user.id}`);
        return res.data;
    }, { enabled: !!user?.id, refetchInterval: 10000 });

    const unreadCount = (notifications || []).filter((n: any) => !n.read).length || 0;

    const isMember = user?.role === 'MEMBER';
    const isPastor = user?.role === 'PASTOR' || user?.role === 'ASSOCIATE_PASTOR';
    const isDeptLeader = user?.role === 'DEPARTMENT_LEADER';
    const isHighAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SYSTEM_ADMIN' || user?.role === 'SECRETARY';
    
    const primaryNavItems = isMember 
        ? memberNavItems 
        : (user?.role === 'SUPER_ADMIN' 
            ? [...adminNavItems, { name: 'MISSION COMMAND', href: '/bishop', icon: Shield }]
            : (isPastor || isDeptLeader 
                ? [{ name: 'EXECUTIVE PALACE', href: '/', icon: LayoutDashboard }]
                : adminNavItems));

    // Everything shows in the drawer
    const allNavItems = isMember
        ? [
              { name: 'Dashboard', href: '/', icon: LayoutDashboard },
              { name: 'Register Child', href: '/register-child', icon: Baby },
              { name: 'My Profile', href: '/profile', icon: UserCheck },
          ]
        : [
              { name: isPastor ? 'PASTORAL PALACE' : 'EXECUTIVE PALACE', href: '/', icon: LayoutDashboard },
              ...(user?.role === 'SUPER_ADMIN' ? [{ name: 'MISSION COMMAND', href: '/bishop', icon: Shield }] : []),
              ...(isHighAdmin ? [
                  { name: 'Departments', href: '/departments', icon: Users },
                  { name: 'Projects', href: '/projects', icon: Briefcase },
                  { name: 'Events', href: '/calendar', icon: Calendar },
                  { name: 'Plans', href: '/plans', icon: ClipboardList },
                  { name: 'Announcements', href: '/announcements', icon: Bell },
                  { name: 'Support Hub', href: '/support', icon: Coins }
              ] : []),
              { name: 'Register Child', href: '/register-child', icon: Baby },
          ];

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const drawer = (
        <Box sx={{ width: 280, pt: 2, height: '100%', bgcolor: 'background.paper' }} role="presentation">
            <Box px={3} pb={2} display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight="bold" color="primary" display="flex" alignItems="center" gap={1} className="glow-text">
                    <Church size={24} color="var(--cyan)" />
                    {(!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'SYSTEM_ADMIN' && user.role !== 'SECRETARY')) && "Portal"}
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
                                onMouseEnter={() => preloadRoute(item.name.toLowerCase())}
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
                            {user?.role === 'MEMBER' 
                                ? "PRAYER PALACE PORTAL" 
                                : (user?.role === 'SUPER_ADMIN' ? "BISHOP | MISSION COMMAND" : "EXECUTIVE PALACE PORTAL")}
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
                                        onMouseEnter={() => preloadRoute(item.name.toLowerCase())}
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
                            
                            {/* Global Search Bar */}
                            <Box ref={searchRef} sx={{ position: 'relative', display: { xs: 'none', md: 'block' } }}>
                                <Box sx={{ 
                                    display: 'flex', alignItems: 'center', 
                                    bgcolor: 'rgba(255,255,255,0.05)', 
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 1, 
                                    px: 2, py: 0.5,
                                    width: 250,
                                    transition: 'all 0.3s',
                                    '&:focus-within': {
                                        borderColor: 'var(--cyan)',
                                        width: 300,
                                        bgcolor: 'rgba(255,255,255,0.1)'
                                    }
                                }}>
                                    <SearchIcon size={18} color="var(--text-secondary)" />
                                    <input 
                                        type="text" 
                                        placeholder="Search..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => { if(searchResults) setSearchOpen(true); }}
                                        style={{ 
                                            background: 'transparent', border: 'none', 
                                            color: 'white', padding: '8px 12px', 
                                            outline: 'none', width: '100%',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </Box>
                                
                                {/* Search Results Dropdown */}
                                {searchOpen && searchResults && (
                                    <Box sx={{
                                        position: 'absolute', top: '100%', right: 0, mt: 1,
                                        width: 350, maxHeight: 400, overflowY: 'auto',
                                        bgcolor: 'var(--glass-base)', backdropFilter: 'blur(30px)',
                                        border: '1px solid var(--cyan)', borderRadius: 1,
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9999
                                    }}>
                                        {['projects', 'events', 'announcements'].map(category => {
                                            const items = searchResults[category];
                                            if (!items || items.length === 0) return null;
                                            
                                            return (
                                                <Box key={category} sx={{ p: 1 }}>
                                                    <Typography variant="caption" color="var(--cyan)" sx={{ px: 1, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                                                        {category}
                                                    </Typography>
                                                    <List dense disablePadding>
                                                        {items.map((item: any) => (
                                                            <ListItemButton 
                                                                key={item.id} 
                                                                onClick={() => {
                                                                    setSearchOpen(false);
                                                                    setSearchQuery('');
                                                                    // We won't actually route anywhere for this mini-feature, 
                                                                    // but visually selecting it will close the drawer.
                                                                }}
                                                                sx={{ borderRadius: 1, '&:hover': { bgcolor: 'rgba(79, 139, 255, 0.1)' } }}
                                                            >
                                                                <ListItemText 
                                                                    primary={item.title || item.name} 
                                                                    secondary={item.description?.substring(0, 30) || item.email || item.location}
                                                                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                                                                    secondaryTypographyProps={{ fontSize: '0.75rem', noWrap: true, color: 'rgba(255,255,255,0.5)' }}
                                                                />
                                                            </ListItemButton>
                                                        ))}
                                                    </List>
                                                </Box>
                                            );
                                        })}
                                        {Object.values(searchResults).every((arr: any) => !arr || arr.length === 0) && (
                                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                                <Typography color="text.secondary">No results found.</Typography>
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            </Box>

                            {user?.role === 'SUPER_ADMIN' && (
                                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', border: '1px solid #ffcc00', bgcolor: 'rgba(255, 204, 0, 0.1)', color: '#ffcc00', px: 1.5, py: 0.5, borderRadius: 0, gap: 1 }}>
                                    <Zap size={14} />
                                    <Typography variant="caption" fontWeight="900" letterSpacing="0.1em">ADMIN</Typography>
                                </Box>
                            )}
                            {user?.role === 'DEPARTMENT_LEADER' && (
                                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', border: '1px solid var(--primary-glow)', bgcolor: 'rgba(79, 139, 255, 0.1)', color: 'primary.main', px: 1.5, py: 0.5, borderRadius: 0, gap: 1 }}>
                                    <UserCheck size={14} />
                                    <Typography variant="caption" fontWeight="900" letterSpacing="0.1em">LEADER</Typography>
                                </Box>
                            )}
                            {user?.role === 'MEMBER' && (
                                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', border: '1px solid rgba(255,255,255,0.2)', bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'text.secondary', px: 1.5, py: 0.5, borderRadius: 0, gap: 1 }}>
                                    <Users size={14} />
                                    <Typography variant="caption" fontWeight="900" letterSpacing="0.1em">MEMBER</Typography>
                                </Box>
                            )}
                            <Avatar
                                onClick={handleProfileClick}
                                src={user?.avatarUrl}
                                sx={{ 
                                    bgcolor: 'var(--primary)', width: 40, height: 40, 
                                    fontWeight: 'bold', borderRadius: 0, 
                                    border: '1px solid var(--primary-glow)',
                                    cursor: 'pointer',
                                    '&:hover': { border: '1px solid var(--cyan)', transform: 'scale(1.05)' },
                                    transition: 'all 0.2s'
                                }}
                            >
                                {!user?.avatarUrl && (user?.name?.charAt(0) || 'U')}
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
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                        <Typography variant="caption" sx={{ 
                                            fontWeight: 800,
                                            color: user?.role === 'SUPER_ADMIN' ? '#ffcc00' : user?.role === 'DEPARTMENT_LEADER' ? 'primary.main' : 'text.secondary',
                                            textTransform: 'uppercase', 
                                            letterSpacing: 1,
                                            fontSize: '0.65rem'
                                        }}>
                                            {user?.role?.replace('_', ' ')}
                                        </Typography>
                                        {user?.department?.name && (
                                            <Typography variant="caption" sx={{ opacity: 0.4, fontSize: '0.65rem' }}>
                                                • {user.department.name}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                                <Divider sx={{ borderColor: 'var(--glass-border)' }} />
                                <MenuItem 
                                    onClick={() => { handleProfileClose(); setProfileModalOpen(true); }}
                                    sx={{ py: 1.5, gap: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                                >
                                    <Users size={16} color="var(--primary)" />
                                    <Typography variant="body2" fontWeight={700}>Profile Settings</Typography>
                                </MenuItem>
                                {user?.role === 'WATUA' && (
                                    <MenuItem 
                                        component={Link}
                                        to="/watua"
                                        onClick={handleProfileClose}
                                        sx={{ 
                                            py: 1.5, 
                                            gap: 1.5, 
                                            color: '#c175ff', 
                                            '&:hover': { bgcolor: 'rgba(193, 117, 255, 0.1)' } 
                                        }}
                                    >
                                        <Command size={16} />
                                        <Typography variant="body2" fontWeight={900}>
                                            SYSTEM TERMINAL
                                        </Typography>
                                    </MenuItem>
                                )}
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
            
            <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
        </>
    );
}
