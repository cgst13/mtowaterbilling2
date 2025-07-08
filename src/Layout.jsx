import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem,
  ListItemIcon, ListItemText, Box, CssBaseline, Avatar
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, People as PeopleIcon,
  Receipt as ReceiptIcon, Payment as PaymentIcon, Person as PersonIcon,
  Analytics as AnalyticsIcon, Water as WaterIcon, Notifications as NotificationsIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { styled } from '@mui/system';
import { supabase } from './supabaseClient';

const drawerWidth = 280;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    ...(open && {
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: 0,
    }),
  })
);

const Layout = () => {
  const [open, setOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [user, setUser] = useState({ name: '', role: '' });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const email = localStorage.getItem('userEmail');
        if (!email) {
          console.error('No user email found in localStorage.');
          return;
        }
        const { data, error } = await supabase
          .from('users')
          .select('firstname, lastname, role')
          .eq('email', email)
          .single();
        if (error) {
          console.error('Error fetching user data:', error);
        } else {
          setUser({
            name: `${data.firstname} ${data.lastname}`,
            role: data.role,
          });
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUserData();
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, route: '/home' },
    { text: 'Customers', icon: <PeopleIcon />, route: '/customers' },
    { text: 'Billing', icon: <ReceiptIcon />, route: '/billing' },
    { text: 'Payments', icon: <PaymentIcon /> },
    { text: 'Analytics', icon: <AnalyticsIcon /> },
    { text: 'Users', icon: <PersonIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar sx={{ minHeight: '70px !important' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <WaterIcon sx={{ mr: 2, fontSize: 28 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Water Billing System
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
            <Typography variant="body2" sx={{ mr: 1, opacity: 0.9 }}>
              {user.name}
            </Typography>
            <Typography variant="body2" sx={{ mr: 3, opacity: 0.7 }}>
              ({user.role})
            </Typography>
          </Box>
          <IconButton color="inherit" sx={{ mr: 1 }}>
            <NotificationsIcon />
          </IconButton>
          <Typography variant="body2" sx={{ mr: 3, opacity: 0.9 }}>
            {currentDateTime.toLocaleString()}
          </Typography>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>
            {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'A'}
          </Avatar>
          <IconButton color="inherit" sx={{ ml: 2 }} onClick={handleLogout} title="Logout">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #e2e8f0',
            background: '#ffffff',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <Toolbar sx={{ minHeight: '70px !important' }} />
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600, mb: 2 }}>
            MAIN MENU
          </Typography>
          <List sx={{ p: 0 }}>
            {menuItems.map((item, index) => (
              <ListItem
                button
                key={item.text}
                onClick={() => item.route && navigate(item.route)}
                selected={location.pathname === item.route}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  backgroundColor: location.pathname === item.route ? '#f1f5f9' : 'transparent',
                  '&:hover': {
                    backgroundColor: '#f1f5f9',
                  },
                }}
              >
                <ListItemIcon sx={{ color: location.pathname === item.route ? '#4f46e5' : '#64748b', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiTypography-root': {
                      fontWeight: location.pathname === item.route ? 600 : 400,
                      color: location.pathname === item.route ? '#1e293b' : '#64748b'
                    }
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Main open={open} className="css-iiowsh">
        <Toolbar sx={{ minHeight: '70px !important' }} />
        <Outlet />
      </Main>
    </Box>
  );
};

export default Layout; 