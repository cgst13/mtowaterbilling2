import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress,
  TablePagination, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl, Snackbar, Alert, Card, CardContent, Stack, Avatar
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Person as PersonIcon, LocationOn as LocationOnIcon, Discount as DiscountIcon, CalendarToday as CalendarTodayIcon, Notes as NotesIcon, Group as GroupIcon } from '@mui/icons-material';

// Remove static barangayList
// const barangayList = [
//   'San Jose', 'San Juan', 'San Pedro', 'San Pablo', 'San Isidro', 'San Antonio', 'San Nicolas', 'San Rafael', 'San Roque', 'San Vicente', 'Other'
// ];

const initialForm = { name: '', type: '', barangay: '', discount: '', remarks: '' };

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [discountOptions, setDiscountOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterBarangay, setFilterBarangay] = useState('');
  const [filterType, setFilterType] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('date_added', { ascending: false });
    if (!error) setCustomers(data || []);
    else setError('Failed to fetch customers');
    setLoading(false);
  };

  const fetchDiscountOptions = async () => {
    const { data, error } = await supabase
      .from('discount')
      .select('*');
    if (!error) setDiscountOptions(data || []);
  };

  const fetchTypeOptions = async () => {
    const { data, error } = await supabase
      .from('customer_type')
      .select('*');
    if (!error) setTypeOptions(data || []);
  };

  const fetchBarangayOptions = async () => {
    const { data, error } = await supabase
      .from('barangays')
      .select('*');
    if (!error) setBarangayOptions(data || []);
  };

  useEffect(() => {
    fetchCustomers();
    fetchDiscountOptions();
    fetchTypeOptions();
    fetchBarangayOptions();
  }, []);

  const handleSearch = (c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterBarangay || c.barangay === filterBarangay) &&
    (!filterType || c.type === filterType);

  const filteredCustomers = customers.filter(handleSearch);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDialogOpen = (customer = null) => {
    if (customer) {
      setForm({ ...customer });
      setEditId(customer.customerid);
    } else {
      setForm(initialForm);
      setEditId(null);
    }
    setOpenDialog(true);
  };
  const handleDialogClose = () => setOpenDialog(false);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddOrEdit = async () => {
    if (!form.name) return setSnackbar({ open: true, message: 'Name is required', severity: 'error' });
    if (editId) {
      // Edit
      const { error } = await supabase
        .from('customers')
        .update({ ...form })
        .eq('customerid', editId);
      if (!error) setSnackbar({ open: true, message: 'Customer updated', severity: 'success' });
      else {
        console.error('Update failed:', error);
        setSnackbar({ open: true, message: 'Update failed', severity: 'error' });
      }
    } else {
      // Add
      const { error } = await supabase
        .from('customers')
        .insert([{ ...form }]);
      if (!error) setSnackbar({ open: true, message: 'Customer added', severity: 'success' });
      else setSnackbar({ open: true, message: 'Add failed', severity: 'error' });
    }
    setOpenDialog(false);
    fetchCustomers();
  };

  const handleDelete = async (id) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('customerid', id);
    if (!error) setSnackbar({ open: true, message: 'Customer deleted', severity: 'success' });
    else setSnackbar({ open: true, message: 'Delete failed', severity: 'error' });
    fetchCustomers();
  };

  const handleDeleteClick = (customerid) => {
    setCustomerToDelete(customerid);
    setDeleteDialogOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (customerToDelete) {
      await handleDelete(customerToDelete);
      setCustomerToDelete(null);
      setDeleteDialogOpen(false);
    }
  };
  const handleDeleteCancel = () => {
    setCustomerToDelete(null);
    setDeleteDialogOpen(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card elevation={3} sx={{ maxWidth: 1300, mx: 'auto', p: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              <GroupIcon fontSize="large" />
            </Avatar>
            <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>Customers</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleDialogOpen()}>
              Add Customer
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Search by name"
              variant="outlined"
              value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ width: 220 }}
              size="small"
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
          </Stack>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <>
              <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><PersonIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Name</TableCell>
                      <TableCell><GroupIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Type</TableCell>
                      <TableCell><LocationOnIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Barangay</TableCell>
                      <TableCell><DiscountIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Discount</TableCell>
                      <TableCell><CalendarTodayIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Date Added</TableCell>
                      <TableCell><NotesIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Remarks</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredCustomers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((customer) => (
                      <TableRow key={customer.customerid} hover>
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
                        <TableCell>{
                          (() => {
                            const found = discountOptions.find(opt => String(opt.discountpercentage) === String(customer.discount));
                            return found ? `${found.type} (${found.discountpercentage}%)` : customer.discount;
                          })()
                        }</TableCell>
                        <TableCell>{customer.date_added}</TableCell>
                        <TableCell>{customer.remarks}</TableCell>
                        <TableCell align="right">
                          <IconButton color="primary" onClick={() => handleDialogOpen(customer)}><EditIcon /></IconButton>
                          <IconButton color="error" onClick={() => handleDeleteClick(customer.customerid)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
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
              <TablePagination
                component="div"
                count={filteredCustomers.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </>
          )}
          <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="xs" fullWidth>
            <DialogTitle>{editId ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField label="Name" name="name" value={form.name} onChange={handleFormChange} required />
              <FormControl>
                <InputLabel>Type</InputLabel>
                <Select name="type" value={form.type} label="Type" onChange={handleFormChange} required>
                  {typeOptions.map(t => <MenuItem key={t.type} value={t.type}>{t.type}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Barangay</InputLabel>
                <Select name="barangay" value={form.barangay} label="Barangay" onChange={handleFormChange} required>
                  {barangayOptions.map(b => <MenuItem key={b.barangay} value={b.barangay}>{b.barangay}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Discount</InputLabel>
                <Select
                  name="discount"
                  value={form.discount}
                  label="Discount"
                  onChange={handleFormChange}
                  required
                >
                  {discountOptions.map(opt => (
                    <MenuItem key={opt.type} value={opt.discountpercentage}>
                      {opt.type} ({opt.discountpercentage}%)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Remarks" name="remarks" value={form.remarks} onChange={handleFormChange} multiline rows={2} />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDialogClose}>Cancel</Button>
              <Button onClick={handleAddOrEdit} variant="contained">{editId ? 'Update' : 'Add'}</Button>
            </DialogActions>
          </Dialog>
          <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent>
              <Typography>Are you sure you want to delete this customer?</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDeleteCancel}>Cancel</Button>
              <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
            </DialogActions>
          </Dialog>
          <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
          </Snackbar>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Customers; 