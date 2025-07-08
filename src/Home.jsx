import React from 'react';
import {
  AppBar, Toolbar, Typography, Box, Grid, Card, CardContent, Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Drawer, List, ListItem, ListItemIcon, ListItemText, CssBaseline, Divider, useTheme
} from '@mui/material';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PaymentIcon from '@mui/icons-material/Payment';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';

const drawerWidth = 220;

const summary = [
  { label: 'Total Customers', value: 1200, icon: <PeopleIcon color="primary" /> },
  { label: 'Unpaid Bills', value: 87, icon: <ReceiptIcon color="error" /> },
  { label: 'Revenue This Month', value: '₱ 250,000', icon: <AttachMoneyIcon color="success" /> },
  { label: 'Water Usage (m³)', value: 32000, icon: <WaterDropIcon color="info" /> },
];

const recentActivity = [
  { id: 1, name: 'Juan Dela Cruz', activity: 'Paid Bill', date: '2024-06-01', amount: '₱ 500' },
  { id: 2, name: 'Maria Santos', activity: 'New Connection', date: '2024-06-02', amount: '-' },
  { id: 3, name: 'Pedro Reyes', activity: 'Paid Bill', date: '2024-06-02', amount: '₱ 700' },
  { id: 4, name: 'Ana Lopez', activity: 'Bill Generated', date: '2024-06-03', amount: '₱ 450' },
];

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon /> },
  { text: 'Customers', icon: <PeopleIcon /> },
  { text: 'Billing', icon: <ReceiptIcon /> },
  { text: 'Payments', icon: <PaymentIcon /> },
  { text: 'Reports', icon: <AssessmentIcon /> },
  { text: 'Settings', icon: <SettingsIcon /> },
  { text: 'Logout', icon: <LogoutIcon /> },
];

export default function Home() {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', bgcolor: '#f4f6fa', minHeight: '100vh' }}>
      <CssBaseline />
      {/* Sidebar Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: 'primary.main',
            color: '#fff',
            border: 'none',
          },
        }}
      >
        <Toolbar sx={{ minHeight: 64 }}>
          <WaterDropIcon sx={{ mr: 1, color: '#fff' }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: '#fff' }}>
            Water Billing
          </Typography>
        </Toolbar>
        <Divider sx={{ bgcolor: 'rgba(255,255,255,0.15)' }} />
        <List>
          {menuItems.map((item, idx) => (
            <ListItem button key={item.text} sx={{
              '&:hover': { bgcolor: 'primary.dark' },
              mt: idx === 0 ? 1 : 0
            }}>
              <ListItemIcon sx={{ color: '#fff' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 500 }} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, ml: { sm: `${drawerWidth}px` } }}>
        {/* AppBar */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#fff', color: 'primary.main', boxShadow: 1, borderRadius: 2, mb: 3 }}>
          <Toolbar>
            <MenuIcon sx={{ display: { sm: 'none' }, mr: 2 }} />
            <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 700 }}>
              Dashboard
            </Typography>
            <Avatar sx={{ bgcolor: 'primary.main', color: '#fff', mr: 1 }}>U</Avatar>
            <Typography variant="body1" sx={{ mr: 2, color: 'primary.main' }}>Admin</Typography>
          </Toolbar>
        </AppBar>

        {/* Summary Cards */}
        <Grid container spacing={3}>
          {summary.map((item, idx) => (
            <Grid item xs={12} sm={6} md={3} key={item.label}>
              <Card sx={{ display: 'flex', alignItems: 'center', p: 2, boxShadow: 3, borderRadius: 3, bgcolor: '#fff' }}>
                <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', mr: 2, width: 48, height: 48 }}>
                  {item.icon}
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{item.value}</Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Main Content: Recent Activity & Chart */}
        <Grid container spacing={3} sx={{ mt: 2 }}>
          {/* Recent Activity Table */}
          <Grid item xs={12} md={7}>
            <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Recent Activity</Typography>
                <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Activity</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentActivity.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.activity}</TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Placeholder for Chart */}
          <Grid item xs={12} md={5}>
            <Card sx={{ height: '100%', boxShadow: 3, borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Water Usage Trend</Typography>
                <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'grey.400' }}>
                  {/* Replace with chart component later */}
                  <Typography variant="body2">[Chart Placeholder]</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
} 