import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl, Snackbar, Alert, TablePagination, Stack, Autocomplete, Tabs, Tab, Card, CardContent, Avatar, Tooltip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Receipt as ReceiptIcon, Group as GroupIcon, Search as SearchIcon, FilterList as FilterListIcon } from '@mui/icons-material';

const paymentStatusList = ['Unpaid', 'Paid', 'Partial', 'Overdue'];

const initialForm = {
  customerid: '',
  billedmonth: '',
  previousreading: '',
  currentreading: '',
  consumption: '',
  basicamount: '',
  surchargeamount: '',
  discountamount: '',
  totalbillamount: '',
  advancepaymentamount: '',
  paymentstatus: 'Unpaid',
  encodedby: '',
  paidby: '',
  datepaid: ''
};

const Billing = () => {
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [filterCustomer, setFilterCustomer] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [tab, setTab] = useState(0);
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [filterBarangay, setFilterBarangay] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortOption, setSortOption] = useState('name_asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);

  const fetchBills = async () => {
    setLoading(true);
    let query = supabase
      .from('bills')
      .select('*, customers(name)')
      .order('billedmonth', { ascending: false });
    if (filterCustomer) query = query.eq('customerid', filterCustomer);
    const { data, error } = await query;
    if (!error) setBills(data || []);
    setLoading(false);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('customerid, name, type, barangay');
    if (!error) setCustomers(data || []);
  };

  const fetchBarangayOptions = async () => {
    const { data, error } = await supabase
      .from('barangays')
      .select('barangay');
    if (!error) setBarangayOptions(data || []);
  };
  // Update fetchTypeOptions to include rate1 and rate2
  const fetchTypeOptions = async () => {
    const { data, error } = await supabase
      .from('customer_type')
      .select('type, rate1, rate2');
    if (!error) setTypeOptions(data || []);
  };

  useEffect(() => {
    fetchBills();
    fetchCustomers();
    fetchBarangayOptions();
    fetchTypeOptions();
  }, [filterCustomer]);

  // Auto-calculate basicamount when consumption or selected customer changes
  useEffect(() => {
    if (!selectedCustomer || !form.consumption || isNaN(Number(form.consumption))) return;
    const custType = typeOptions.find(t => t.type === selectedCustomer.type);
    if (!custType) return;
    const consumption = Number(form.consumption);
    const rate1 = Number(custType.rate1) || 0;
    const rate2 = Number(custType.rate2) || 0;
    let basic = 0;
    if (consumption <= 3) {
      basic = consumption * rate1;
    } else {
      basic = (3 * rate1) + ((consumption - 3) * rate2);
    }
    setForm(f => ({ ...f, basicamount: basic.toFixed(2) }));
    // eslint-disable-next-line
  }, [form.consumption, selectedCustomer, typeOptions]);

  const handleDialogOpen = (bill = null) => {
    if (bill) {
      setForm({ ...bill });
      setEditId(bill.billid);
    } else {
      setForm(initialForm);
      setEditId(null);
    }
    setOpenDialog(true);
  };
  const handleDialogClose = () => setOpenDialog(false);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...form, [name]: value };
    // Auto-calculate consumption
    if (name === 'previousreading' || name === 'currentreading') {
      const prev = parseFloat(name === 'previousreading' ? value : form.previousreading) || 0;
      const curr = parseFloat(name === 'currentreading' ? value : form.currentreading) || 0;
      updated.consumption = curr - prev > 0 ? curr - prev : '';
    }
    setForm(updated);
  };

  const handleAddOrEdit = async () => {
    // Calculate totalbillamount if not set
    let total = parseFloat(form.basicamount) || 0;
    total += parseFloat(form.surchargeamount) || 0;
    total -= parseFloat(form.discountamount) || 0;
    setForm(f => ({ ...f, totalbillamount: total }));
    let payload = { ...form, totalbillamount: total };
    // Clean payload: convert empty strings to null for numeric/date fields
    Object.keys(payload).forEach(key => {
      if (
        ['previousreading', 'currentreading', 'consumption', 'basicamount', 'surchargeamount', 'discountamount', 'totalbillamount', 'advancepaymentamount'].includes(key)
        && payload[key] === ''
      ) {
        payload[key] = null;
      }
      if (
        ['billedmonth', 'datepaid'].includes(key)
        && payload[key] === ''
      ) {
        payload[key] = null;
      }
    });
    // Convert billedmonth from 'YYYY-MM' to 'YYYY-MM-01' for PostgreSQL date
    if (payload.billedmonth && /^\d{4}-\d{2}$/.test(payload.billedmonth)) {
      payload.billedmonth = payload.billedmonth + '-01';
    }
    if (editId) {
      console.log('Update bill payload:', payload);
      delete payload.customers;
      const { error } = await supabase
        .from('bills')
        .update(payload)
        .eq('billid', editId);
      if (!error) setSnackbar({ open: true, message: 'Bill updated', severity: 'success' });
      else {
        console.error('Update bill failed:', error);
        setSnackbar({ open: true, message: 'Update failed', severity: 'error' });
      }
    } else {
      console.log('Bill payload:', payload);
      const { error } = await supabase
        .from('bills')
        .insert([payload]);
      if (!error) setSnackbar({ open: true, message: 'Bill added', severity: 'success' });
      else {
        console.error('Add bill failed:', error);
        setSnackbar({ open: true, message: 'Add failed', severity: 'error' });
      }
    }
    setOpenDialog(false);
    fetchBills();
  };

  const handleDelete = async (id) => {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('billid', id);
    if (!error) setSnackbar({ open: true, message: 'Bill deleted', severity: 'success' });
    else setSnackbar({ open: true, message: 'Delete failed', severity: 'error' });
    fetchBills();
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDeleteClick = (billid) => {
    setBillToDelete(billid);
    setDeleteDialogOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (billToDelete) {
      await handleDelete(billToDelete);
      setBillToDelete(null);
      setDeleteDialogOpen(false);
    }
  };
  const handleDeleteCancel = () => {
    setBillToDelete(null);
    setDeleteDialogOpen(false);
  };

  // Filter bills by customer name
  const filteredBills = bills.filter(bill => {
    const name = bill.customername || bill.customers?.name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Filter for recent bills (last 10, sorted by dateencoded desc)
  const recentBills = [...bills].sort((a, b) => new Date(b.dateencoded) - new Date(a.dateencoded)).slice(0, 10);

  // Filter and sort customers by search, barangay, type, and sort option
  let filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) &&
    (!filterBarangay || c.barangay === filterBarangay) &&
    (!filterType || c.type === filterType)
  );
  if (sortOption === 'name_asc') filteredCustomers = filteredCustomers.sort((a, b) => a.name.localeCompare(b.name));
  if (sortOption === 'name_desc') filteredCustomers = filteredCustomers.sort((a, b) => b.name.localeCompare(a.name));

  // Add formatters
  const formatAmount = (value) => value !== null && value !== undefined && value !== '' ? `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
  const formatCubic = (value) => value !== null && value !== undefined && value !== '' ? Math.round(Number(value)).toLocaleString('en-PH') + ' m³' : '';

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, background: '#f4f6fa', minHeight: '100vh' }}>
      <Card elevation={3} sx={{ maxWidth: 1400, mx: 'auto', p: 0, overflow: 'visible' }}>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Add Bill" />
            <Tab label="Recent Bills" />
          </Tabs>
          {tab === 0 && (
            <>
              <Paper elevation={1} sx={{ mb: 3, p: 2, borderRadius: 2, background: '#f9fafb' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
                  <TextField
                    label="Search customer name"
                    variant="outlined"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    size="small"
                    InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> }}
                    sx={{ width: 200 }}
                  />
                  <FormControl sx={{ minWidth: 160 }} size="small">
                    <InputLabel>Barangay</InputLabel>
                    <Select
                      value={filterBarangay}
                      label="Barangay"
                      onChange={e => setFilterBarangay(e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      {barangayOptions.map(b => <MenuItem key={b.barangay} value={b.barangay}>{b.barangay}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ minWidth: 160 }} size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={filterType}
                      label="Type"
                      onChange={e => setFilterType(e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      {typeOptions.map(t => <MenuItem key={t.type} value={t.type}>{t.type}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ minWidth: 140 }} size="small">
                    <InputLabel>Sort</InputLabel>
                    <Select
                      value={sortOption}
                      label="Sort"
                      onChange={e => setSortOption(e.target.value)}
                    >
                      <MenuItem value="name_asc">Name A-Z</MenuItem>
                      <MenuItem value="name_desc">Name Z-A</MenuItem>
                    </Select>
                  </FormControl>
                  <FilterListIcon sx={{ color: 'text.secondary', ml: 1 }} />
                </Stack>
              </Paper>
              <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 3, mb: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: '#f1f5f9' }}>
                      <TableCell>ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Barangay</TableCell>
                      <TableCell align="right">Add Bill</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.customerid} hover sx={{ transition: 'background 0.2s', '&:hover': { background: '#e3e9f6' } }}>
                        <TableCell>{customer.customerid}</TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.main', fontSize: 14 }}>
                              {customer.name ? customer.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                            </Avatar>
                            {customer.name}
                          </Stack>
                        </TableCell>
                        <TableCell>{customer.type}</TableCell>
                        <TableCell>{customer.barangay}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Add Bill">
                            <Button variant="contained" size="small" onClick={() => { setSelectedCustomer(customer); setForm(f => ({ ...initialForm, customerid: customer.customerid })); setOpenDialog(true); }}>
                              Add Bill
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Box sx={{ py: 4, color: 'text.secondary' }}>
                            <GroupIcon sx={{ fontSize: 48, mb: 1 }} />
                            <Typography>No customers found.</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          {tab === 1 && (
            <>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <ReceiptIcon color="primary" sx={{ fontSize: 40 }} />
                <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>Recent Bills</Typography>
              </Stack>
              <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 3, mb: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: '#f1f5f9' }}>
                      <TableCell>Bill ID</TableCell>
                      <TableCell>Customer Name</TableCell>
                      <TableCell>Billed Month</TableCell>
                      <TableCell>Previous Reading</TableCell>
                      <TableCell>Current Reading</TableCell>
                      <TableCell>Consumption</TableCell>
                      <TableCell>Basic Amount</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentBills.map((bill) => (
                      <TableRow key={bill.billid} hover sx={{ transition: 'background 0.2s', '&:hover': { background: '#e3e9f6' } }}>
                        <TableCell>{bill.billid}</TableCell>
                        <TableCell>{bill.customername || bill.customers?.name || ''}</TableCell>
                        <TableCell>{bill.billedmonth}</TableCell>
                        <TableCell>{formatCubic(bill.previousreading)}</TableCell>
                        <TableCell>{formatCubic(bill.currentreading)}</TableCell>
                        <TableCell>{formatCubic(bill.consumption)}</TableCell>
                        <TableCell>{formatAmount(bill.basicamount)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton color="primary" onClick={() => handleDialogOpen(bill)}><EditIcon /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton color="error" onClick={() => handleDeleteClick(bill.billid)}><DeleteIcon /></IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentBills.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Box sx={{ py: 4, color: 'text.secondary' }}>
                            <ReceiptIcon sx={{ fontSize: 48, mb: 1 }} />
                            <Typography>No bills found.</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </CardContent>
      </Card>
      {/* Dialogs and Snackbar remain unchanged */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Bill' : 'Add Bill'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Show customer details if selected */}
          {selectedCustomer && (
            <Box sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, background: '#f9fafb' }}>
              <Typography variant="subtitle2">Customer Details</Typography>
              <Typography>ID: {selectedCustomer.customerid}</Typography>
              <Typography>Name: {selectedCustomer.name}</Typography>
              <Typography>Type: {selectedCustomer.type}</Typography>
              <Typography>Barangay: {selectedCustomer.barangay}</Typography>
            </Box>
          )}
          {/* Only show required fields */}
          <TextField
            label="Billed Month"
            name="billedmonth"
            type="month"
            value={form.billedmonth}
            onChange={handleFormChange}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField label="Previous Reading" name="previousreading" type="number" value={form.previousreading} onChange={handleFormChange} required />
          <TextField label="Current Reading" name="currentreading" type="number" value={form.currentreading} onChange={handleFormChange} required />
          <TextField label="Consumption" name="consumption" type="number" value={form.consumption} InputProps={{ readOnly: true }} />
          <TextField label="Basic Amount" name="basicamount" type="text" value={formatAmount(form.basicamount)} InputProps={{ readOnly: true }} required />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSelectedCustomer(null); handleDialogClose(); }}>Cancel</Button>
          <Button onClick={handleAddOrEdit} variant="contained">{editId ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this bill?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Billing; 