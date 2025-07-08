import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { blue, teal } from '@mui/material/colors';
import Login from './Login';
import Home from './Home';
import Customers from './Customers';
import Layout from './Layout';
import Billing from './Billing';
import { AccountCircle, Dashboard } from '@mui/icons-material';

const theme = createTheme({
  palette: {
    primary: {
      main: blue[700],
    },
    secondary: {
      main: teal[500],
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={
            <Login 
              icon={<AccountCircle fontSize="large" color="primary" />}
              title="Water Billing System"
            />
          } />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/" element={<Layout />}>
            <Route path="home" element={
              <Home 
                icon={<Dashboard fontSize="large" color="primary" />}
                title="Dashboard"
              />
            } />
            <Route path="customers" element={<Customers />} />
            <Route path="billing" element={<Billing />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;