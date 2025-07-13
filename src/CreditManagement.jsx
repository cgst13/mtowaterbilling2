import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, Avatar, CircularProgress, Container
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, AccountBalanceWallet as WalletIcon, Edit as EditIcon } from '@mui/icons-material';
import { supabase } from './supabaseClient';
import PageHeader from './PageHeader';
import { useGlobalSnackbar } from './GlobalSnackbar';
import AnimatedBackground from './AnimatedBackground';
import useMediaQuery from '@mui/material/useMediaQuery';

const CreditManagement = () => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const showSnackbar = useGlobalSnackbar();
  const [editMode, setEditMode] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');

  useEffect(() => {
    if (search.trim() === '') {
      setLoading(true);
      const fetchWithCredit = async () => {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .gt('credit_balance', 0);
        setCustomers(error ? [] : data || []);
        setLoading(false);
      };
      fetchWithCredit();
      return;
    }
    setLoading(true);
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .ilike('name', `%${search}%`);
      setCustomers(error ? [] : data || []);
      setLoading(false);
    };
    const delayDebounce = setTimeout(fetchCustomers, 400);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  const handleAddCreditClick = (customer) => {
    setSelectedCustomer(customer);
    setCreditAmount('');
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleEditCreditClick = (customer) => {
    setSelectedCustomer(customer);
    setCreditAmount(customer.credit_balance ? String(customer.credit_balance) : '');
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedCustomer(null);
    setCreditAmount('');
    setEditMode(false);
  };

  const handleAddCredit = async () => {
    if (!creditAmount || isNaN(Number(creditAmount))) {
      showSnackbar('Enter a valid amount', 'error');
      return;
    }
    let newCredit;
    if (editMode) {
      newCredit = Number(creditAmount);
    } else {
      newCredit = Number(selectedCustomer.credit_balance || 0) + Number(creditAmount);
    }
    const { error } = await supabase
      .from('customers')
      .update({ credit_balance: newCredit })
      .eq('customerid', selectedCustomer.customerid);
    if (!error) {
      showSnackbar(editMode ? 'Credit updated successfully' : 'Credit added successfully', 'success');
      setCustomers(customers.map(c => c.customerid === selectedCustomer.customerid ? { ...c, credit_balance: newCredit } : c));
      handleDialogClose();
    } else {
      showSnackbar(editMode ? 'Failed to update credit' : 'Failed to add credit', 'error');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 0, sm: 3 }, bgcolor: '#f7f9fb', width: '100%', overflow: 'hidden' }}>
      {/* Simple Title Header */}
      <Box sx={{ py: { xs: 1, sm: 4 }, px: { xs: 1, sm: 2 }, width: '100%' }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#22223b', mb: 0.5, fontSize: { xs: 20, sm: 24 } }}>
            Credit Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manually add credits to customer accounts
          </Typography>
        </Box>
        <Box sx={{ maxWidth: 400, mb: 3, width: '100%' }}>
          <TextField
            label="Search customer name"
            variant="outlined"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ width: '100%' }}
            inputProps={{ style: { fontSize: 15 } }}
          />
        </Box>
        <Paper elevation={0} sx={{ borderRadius: 2, boxShadow: 'none', width: '100%', mb: 2 }}>
          <Table sx={{ width: '100%', fontSize: { xs: 12, sm: 15 } }} size={isMobile ? 'small' : 'medium'}>
            <TableHead>
              <TableRow sx={{ background: '#f1f3f6' }}>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Barangay</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Current Credit</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center"><CircularProgress size={32} sx={{ my: 3 }} /></TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: { xs: 13, sm: 15 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, mb: 1, fontSize: { xs: 15, sm: 18 } }}>
                      No customers found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try searching for a customer name.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c, i) => (
                  <TableRow key={c.customerid} sx={{ background: i % 2 === 0 ? '#fff' : '#f7f9fb', transition: 'none' }}>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>{c.name}</TableCell>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>{c.barangay}</TableCell>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>{c.type}</TableCell>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>{c.credit_balance ? `₱${Number(c.credit_balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00'}</TableCell>
                    <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                      <Button variant="contained" onClick={() => handleAddCreditClick(c)} sx={{ fontWeight: 500, borderRadius: 2, minWidth: 44, mr: 1, px: 2 }}>{'Add Credit'}</Button>
                      {Number(c.credit_balance) > 0 && (
                        <Button variant="outlined" onClick={() => handleEditCreditClick(c)} sx={{ fontWeight: 500, borderRadius: 2, minWidth: 44, px: 2 }}>Edit</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="xs" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2, bgcolor: '#fff', minHeight: isMobile ? '100vh' : 'auto', width: '100vw', m: 0 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: { xs: 18, sm: 20 }, px: { xs: 2, sm: 3 } }}>{editMode ? 'Edit Credit' : `Add Credit to ${selectedCustomer?.name}`}</DialogTitle>
        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          <TextField
            label="Credit Amount"
            type="number"
            value={creditAmount}
            onChange={e => setCreditAmount(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
            inputProps={{ min: 0, style: { fontSize: 15 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
          <Button onClick={handleDialogClose} sx={{ borderRadius: 2, minWidth: 100, width: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
          <Button onClick={handleAddCredit} variant="contained" sx={{ borderRadius: 2, minWidth: 120, width: { xs: '100%', sm: 'auto' } }}>{editMode ? 'Update Credit' : 'Add Credit'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CreditManagement; 