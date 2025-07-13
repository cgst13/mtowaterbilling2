import React, { useState, useEffect } from 'react';
import { 
  AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem, 
  ListItemIcon, ListItemText, Box, CssBaseline, Container, Paper, Avatar,
  Grid, Card, CardContent, Chip, Button, Divider
} from '@mui/material';
import { 
  Menu as MenuIcon, Dashboard as DashboardIcon, People as PeopleIcon, 
  Receipt as ReceiptIcon, Payment as PaymentIcon, Person as PersonIcon,
  TrendingUp as TrendingUpIcon, Water as WaterIcon, AttachMoney as MoneyIcon,
  Notifications as NotificationsIcon, Settings as SettingsIcon,
  Logout as LogoutIcon, Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { styled } from '@mui/system';

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
  }),
);

const StatsCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  height: '100%',
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
  },
}));

const ActionCard = styled(Card)(({ theme }) => ({
  height: '100%',
  transition: 'all 0.2s ease-in-out',
  border: '1px solid #e2e8f0',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    borderColor: '#4f46e5',
  },
}));

const Home = ({ icon, title }) => {
  const [open, setOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, active: true },
    { text: 'Customers', icon: <PeopleIcon /> },
    { text: 'Billing', icon: <ReceiptIcon /> },
    { text: 'Payments', icon: <PaymentIcon /> },
    { text: 'Analytics', icon: <AnalyticsIcon /> },
    { text: 'Users', icon: <PersonIcon /> },
  ];

  const statsData = [
    { title: 'Total Customers', value: '1,247', icon: <PeopleIcon />, color: '#4f46e5' },
    { title: 'Monthly Revenue', value: '₱125,430', icon: <MoneyIcon />, color: '#059669' },
    { title: 'Water Consumption', value: '45,230 L', icon: <WaterIcon />, color: '#0ea5e9' },
    { title: 'Pending Bills', value: '89', icon: <ReceiptIcon />, color: '#f59e0b' },
  ];

  const quickActions = [
    { title: 'Add New Customer', description: 'Register a new water service customer', color: '#4f46e5' },
    { title: 'Generate Bills', description: 'Create monthly billing statements', color: '#059669' },
    { title: 'Process Payment', description: 'Record customer payments', color: '#0ea5e9' },
    { title: 'View Reports', description: 'Access detailed analytics and reports', color: '#8b5cf6' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f7f7', width: '100%', overflow: 'hidden', p: { xs: 1, sm: 3 } }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={600} sx={{ mb: 0.5, color: '#222' }}>Dashboard Overview</Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>LGU Concepcion, Romblon - Water Billing Management System</Typography>
        </Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: '#888' }}>{currentDateTime.toLocaleString()}</Typography>
        </Box>
        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {statsData.map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 'none', bgcolor: '#fff', textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, color: '#222' }}>{stat.value}</Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>{stat.title}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        {/* Quick Actions */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#222', mb: 2 }}>Quick Actions</Typography>
          <Grid container spacing={2}>
            {quickActions.map((action, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 'none', bgcolor: '#fff', textAlign: 'center' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#222' }}>{action.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>{action.description}</Typography>
                  <Button variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 500, width: '100%' }}>Get Started</Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
        {/* Recent Activity */}
        <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 'none', bgcolor: '#fff' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#222', mb: 2 }}>Recent Activity</Typography>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body2" sx={{ color: '#888' }}>
              No recent activity to display. Start by adding customers or processing payments.
            </Typography>
            <Button variant="contained" sx={{ mt: 2, borderRadius: 2, fontWeight: 500 }}>View All Activities</Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Home;