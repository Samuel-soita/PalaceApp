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
    Search as SearchIcon, Command, Zap, UserCheck, Baby, TrendingUp, Shield, Smartphone, DownloadCloud
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api-client';
import { isSessionActive } from '../../lib/auth-session';
import ProfileModal from '../modals/ProfileModal';
import { useRoutePreloader } from '../../hooks/useRoutePreloader';
import SyncIndicator from '../SyncIndicator';
import { usePWA } from '../../hooks/usePWA';
import InstallAppModal from '../modals/InstallAppModal';
import { db } from '../../lib/db';


// Base items for admin roles
const adminNavItems = [
    { name: 'EXECUTIVE PALACE', href: '/executive', icon: LayoutDashboard },
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
    const [installModalOpen, setInstallModalOpen] = useState(false);
    const { isStandalone } = usePWA();
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

    // Perform search (Tactical Local Fallback)
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchQuery.trim().length > 2) {
                try {
                    const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
                    setSearchResults(res.data);
                    setSearchOpen(true);
                } catch (error) {
                    console.warn("[Palace-Sync] Network search failed, activating Tactical Local Search.");
                    
                    const q = searchQuery.toLowerCase();
                    const [p, e, a] = await Promise.all([
                        db.projects.filter((x: any) => x.title.toLowerCase().includes(q) || x.description?.toLowerCase().includes(q)).toArray(),
                        db.events.filter((x: any) => x.title.toLowerCase().includes(q) || x.location?.toLowerCase().includes(q)).toArray(),
                        db.announcements.filter((x: any) => x.title.toLowerCase().includes(q) || x.content?.toLowerCase().includes(q)).toArray()
                    ]);

                    setSearchResults({ projects: p, events: e, announcements: a });
                    setSearchOpen(true);
                }
            } else {
                setSearchResults(null);
                setSearchOpen(false);
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

    const renderSearchResults = (inline = false) => {
        if (!searchOpen || !searchResults) return null;
        return (
            <Box sx={inline ? {
                mt: 1, maxHeight: 280, overflowY: 'auto',
                bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 1
            } : {
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
                                            if (inline) setMobileOpen(false);
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
        );
    };

    const renderSearchField = (fullWidth = false) => (
        <Box sx={{
            display: 'flex', alignItems: 'center',
            bgcolor: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--glass-border)',
            borderRadius: 1,
            px: 2, py: 0.5,
            width: fullWidth ? '100%' : 250,
            transition: 'all 0.3s',
            ...(!fullWidth && {
                '&:focus-within': {
                    borderColor: 'var(--cyan)',
                    width: 300,
                    bgcolor: 'rgba(255,255,255,0.1)'
                }
            }),
            ...(fullWidth && {
                '&:focus-within': { borderColor: 'var(--cyan)', bgcolor: 'rgba(255,255,255,0.1)' }
            })
        }}>
            <SearchIcon size={18} color="var(--text-secondary)" />
            <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults) setSearchOpen(true); }}
                style={{
                    background: 'transparent', border: 'none',
                    color: 'white', padding: '8px 12px',
                    outline: 'none', width: '100%',
                    fontFamily: 'inherit'
                }}
            />
        </Box>
    );

    const { data: notifications } = useQuery(['notifications', user?.id], async () => {
        if (!user?.id) return [];
        const res = await api.get(`/notifications/user/${user.id}`);
        return res.data;
    }, { enabled: !!user?.id && isSessionActive(), refetchInterval: isSessionActive() ? 10000 : false });

    const { data: departmentsData } = useQuery(['sidebar-departments'], async () => {
        const res = await api.get('/departments');
        return res.data;
    }, { enabled: (user?.role === 'SUPER_ADMIN' || user?.role === 'WATUA') && isSessionActive(), staleTime: 300000 });

    const { data: settings } = useQuery(['ministrySettings'], async () => {
        const res = await api.get('/settings');
        return res.data;
    }, { enabled: isSessionActive(), staleTime: 300000 });

    const unreadCount = (notifications || []).filter((n: any) => !n.read).length || 0;

    const isMember = user?.role === 'MEMBER';
    const isPastor = user?.role === 'PASTOR' || user?.role === 'ASSOCIATE_PASTOR';
    const isDeptLeader = user?.role === 'DEPARTMENT_LEADER';
    const isHighAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SYSTEM_ADMIN' || user?.role === 'SECRETARY' || user?.role === 'WATUA';
    const dashboardHome = isPastor
        ? { name: 'PASTORAL PALACE', href: '/pastor', icon: LayoutDashboard }
        : { name: 'EXECUTIVE PALACE', href: '/executive', icon: LayoutDashboard };
    
    const primaryNavItems = isMember 
        ? memberNavItems 
        : (user?.role === 'SUPER_ADMIN' 
            ? [{ ...dashboardHome, name: 'EXECUTIVE PALACE', href: '/executive' }, ...adminNavItems.slice(1), { name: 'MISSION COMMAND', href: '/bishop', icon: Shield }]
            : (user?.role === 'SYSTEM_ADMIN' || user?.role === 'DEPARTMENT_LEADER'
                ? [dashboardHome]
                : [dashboardHome, ...adminNavItems.slice(1)]));

    // Everything shows in the drawer
    const allNavItems = isMember
        ? [
              { name: 'Dashboard', href: '/', icon: LayoutDashboard },
              { name: 'Register Child', href: '/register-child', icon: Baby },
              { name: 'My Profile', href: '/profile', icon: UserCheck },
          ]
        : [
            dashboardHome,
              ...(user?.role === 'SUPER_ADMIN' ? [{ name: 'MISSION COMMAND', href: '/bishop', icon: Shield }] : []),
              ...(isHighAdmin ? [
                  { name: 'Departments', href: '/departments', icon: Users },
                  { name: 'Projects', href: '/projects', icon: Briefcase },
                  { name: 'Events', href: '/calendar', icon: Calendar },
                  { name: 'Plans', href: '/plans', icon: ClipboardList },
                  { name: 'Announcements', href: '/announcements', icon: Bell },
                  { name: 'Support Hub', href: '/support', icon: Coins }
              ] : (isDeptLeader ? [
                   { name: 'MASTER OPERATIONS TRACK', href: '/executive', icon: Shield }
               ] : [])),
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

            <Box sx={{ px: 2, pb: 2 }}>
                {renderSearchField(true)}
                {renderSearchResults(true)}
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

            {/* COMMAND CONSOLE - Universal Dashboard Access for Bishop and Watua */}
            {(user?.role === 'SUPER_ADMIN' || user?.role === 'WATUA') && (
                <>
                    <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
                    <Typography variant="caption" sx={{ px: 3, py: 1, display: 'block', color: 'orange', fontWeight: 950, letterSpacing: 2 }}>
                        COMMAND CONSOLE
                    </Typography>
                    <List sx={{ px: 2 }} disablePadding>
                        {[
                            { name: 'PALACE CONTROL', href: '/bishop', icon: Shield, color: 'var(--cyan)' },
                            { name: 'PASTORAL DESK', href: '/pastor', icon: Briefcase, color: 'primary.main' },
                            { name: 'MEMBER VIEW', href: '/member-portal', icon: LayoutDashboard, color: 'success.main' },
                            ...(user?.role === 'WATUA' ? [{ name: 'SYSTEM TERMINAL', href: '/watua', icon: Command, color: '#c175ff' }] : []),
                        ].map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton 
                                        component={Link} 
                                        to={item.href}
                                        onClick={handleDrawerToggle}
                                        sx={{ 
                                            borderRadius: 0, py: 0.5,
                                            border: isActive ? '1px solid orange' : '1px solid transparent',
                                            bgcolor: isActive ? 'rgba(255, 165, 0, 0.1)' : 'transparent',
                                            color: isActive ? 'orange' : 'text.secondary',
                                            '&:hover': { bgcolor: 'rgba(255, 165, 0, 0.05)', color: 'orange' }
                                        }}
                                    >
                                        <ListItemIcon sx={{ color: isActive ? 'orange' : item.color, minWidth: 32 }}>
                                            <item.icon size={16} />
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary={item.name} 
                                            primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: isActive ? 900 : 600 }} 
                                        />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                    </List>
                </>
            )}

            {/* SECTORAL COMMAND OVERRIDE - For Bishop and Watua */}
            {(user?.role === 'SUPER_ADMIN' || user?.role === 'WATUA') && departmentsData && departmentsData.length > 0 && (
                <>
                    <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
                    <Typography variant="caption" sx={{ px: 3, py: 1, display: 'block', color: 'var(--cyan)', fontWeight: 900, letterSpacing: 2 }}>
                        SECTORAL COMMAND
                    </Typography>
                    <List sx={{ px: 2 }} disablePadding>
                        {departmentsData.map((dept: any) => {
                            const href = `/department/${dept.id}`;
                            const isActive = location.pathname === href;
                            return (
                                <ListItem key={dept.id} disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton 
                                        component={Link} 
                                        to={href}
                                        onClick={handleDrawerToggle}
                                        sx={{ 
                                            borderRadius: 0, py: 0.5,
                                            border: isActive ? '1px solid var(--primary-glow)' : '1px solid transparent',
                                            bgcolor: isActive ? 'rgba(79, 139, 255, 0.1)' : 'transparent',
                                            color: isActive ? 'primary.main' : 'text.secondary',
                                            '&:hover': { bgcolor: 'rgba(79, 139, 255, 0.1)', color: 'primary.main' }
                                        }}
                                    >
                                        <ListItemIcon sx={{ color: isActive ? 'var(--cyan)' : 'inherit', minWidth: 32 }}>
                                            <Users size={14} />
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary={dept.name} 
                                            primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: isActive ? 800 : 500 }} 
                                        />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                    </List>
                </>
            )}

            {!isStandalone && (
                <Box sx={{ mt: 'auto', p: 2 }}>
                    <Button
                        variant="contained"
                        fullWidth
                        startIcon={<Smartphone size={18} />}
                        onClick={() => { setInstallModalOpen(true); handleDrawerToggle(); }}
                        sx={{ 
                            justifyContent: 'flex-start', py: 1.5, px: 2,
                            bgcolor: 'rgba(193, 117, 255, 0.1)',
                            border: '1px solid rgba(193, 117, 255, 0.2)',
                            color: '#c175ff',
                            fontWeight: 900,
                            letterSpacing: 1,
                            '&:hover': { bgcolor: 'rgba(193, 117, 255, 0.2)' }
                        }}
                    >
                        INSTALL APP
                    </Button>
                </Box>
            )}
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
                                : (user?.role === 'SUPER_ADMIN' ? "PALACE CONTROL PORTAL" : "EXECUTIVE PALACE PORTAL")}
                        </Typography>

                        {/* Global Ministry Themes display */}
                        {settings && (settings.themeOfYear || settings.themeOfMonth) && (
                            <Box sx={{ display: { xs: 'none', lg: 'flex' }, mr: 4, gap: 1, alignItems: 'center' }}>
                                {settings.themeOfYear && (
                                    <Box sx={{ border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.02)', px: 1.5, py: 0.5 }}>
                                        <Typography variant="caption" sx={{ color: 'var(--cyan)', fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase' }}>
                                            {settings.themeOfYear}
                                        </Typography>
                                    </Box>
                                )}
                                {settings.themeOfMonth && (
                                    <Box sx={{ border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.02)', px: 1.5, py: 0.5 }}>
                                        <Typography variant="caption" sx={{ color: '#ffcc00', fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase' }}>
                                            {settings.themeOfMonth}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        )}

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
                            
                            {/* 🛰️ SYNC TELEMETRY */}
                            <Box sx={{ display: { xs: 'none', lg: 'block' }, mr: 1 }}>
                                <SyncIndicator />
                            </Box>

                            <IconButton
                                aria-label="Search"
                                onClick={() => setMobileSearchOpen((v) => !v)}
                                sx={{ display: { xs: 'flex', md: 'none' }, color: mobileSearchOpen ? 'var(--cyan)' : 'var(--text-secondary)' }}
                            >
                                <SearchIcon size={20} />
                            </IconButton>

                            {/* Global Search Bar (desktop) */}
                            <Box ref={searchRef} sx={{ position: 'relative', display: { xs: 'none', md: 'block' } }}>
                                {renderSearchField()}
                                {renderSearchResults()}
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
                                
                                {!isStandalone && (
                                    <>
                                        <Divider sx={{ borderColor: 'var(--glass-border)' }} />
                                        <MenuItem
                                            onClick={() => { handleProfileClose(); setInstallModalOpen(true); }}
                                            sx={{ 
                                                gap: 1.5, py: 1.5, 
                                                color: 'var(--cyan)',
                                                bgcolor: 'rgba(0, 255, 234, 0.05)',
                                                '&:hover': { bgcolor: 'rgba(0, 255, 234, 0.15)' }
                                            }}
                                        >
                                            <DownloadCloud size={16} />
                                            <Typography variant="body2" fontWeight={900}>INSTALL APP</Typography>
                                            <Box sx={{ 
                                                ml: 'auto', px: 0.8, py: 0.2, 
                                                bgcolor: 'var(--cyan)', color: 'black', 
                                                fontSize: '0.6rem', fontWeight: 900, 
                                                borderRadius: 0 
                                            }}>
                                                OFFLINE
                                            </Box>
                                        </MenuItem>
                                    </>
                                )}
                            </Menu>
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>

            {mobileSearchOpen && (
                <Box
                    ref={searchRef}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        position: 'sticky',
                        top: 70,
                        zIndex: (theme) => theme.zIndex.drawer,
                        px: 2,
                        py: 1.5,
                        bgcolor: 'var(--glass-base)',
                        borderBottom: '1px solid var(--glass-border)',
                        backdropFilter: 'blur(20px)'
                    }}
                >
                    {renderSearchField(true)}
                    {renderSearchResults(true)}
                </Box>
            )}
            
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
            <InstallAppModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />
        </>
    );
}
