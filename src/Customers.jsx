import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress,
  TablePagination, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl, Snackbar, Alert, Card, CardContent, Stack, Avatar, Tooltip, Grid, Skeleton, Container
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Group as GroupIcon, Search as SearchIcon, FilterList as FilterListIcon, SentimentDissatisfied as EmptyIcon } from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/Download';
import PageHeader from './PageHeader';
import { useGlobalSnackbar } from './GlobalSnackbar';
import AnimatedBackground from './AnimatedBackground';
import useMediaQuery from '@mui/material/useMediaQuery';

// Remove static barangayList
// const barangayList = [
//   'San Jose', 'San Juan', 'San Pedro', 'San Pablo', 'San Isidro', 'San Antonio', 'San Nicolas', 'San Rafael', 'San Roque', 'San Vicente', 'Other'
// ];

const initialForm = { name: '', type: '', barangay: '', discount: '', remarks: '' };

function exportToCSV(data, filename) {
  if (!data || !data.length) return;
  const replacer = (key, value) => value === null ? '' : value;
  const header = Object.keys(data[0]);
  const csv = [
    header.join(','),
    ...data.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Add this helper function above the Customers component
async function generateUniqueCustomerId(supabase) {
  let id, exists;
  do {
    id = Math.floor(100000 + Math.random() * 900000); // 6-digit number
    const { data } = await supabase.from('customers').select('customerid').eq('customerid', id);
    exists = data && data.length > 0;
  } while (exists);
  return id;
}

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
  const showSnackbar = useGlobalSnackbar();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [sortOption, setSortOption] = useState('name_asc'); // Added sort option
  const [totalCount, setTotalCount] = useState(0);
  const isMobile = useMediaQuery('(max-width:600px)');

  // Add this useEffect for fetching customers with correct dependencies
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      const from = page * rowsPerPage;
      const to = from + rowsPerPage - 1;
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('date_added', { ascending: false })
        .range(from, to);
      if (search) query = query.ilike('name', `%${search}%`);
      if (filterBarangay) query = query.eq('barangay', filterBarangay);
      if (filterType) query = query.eq('type', filterType);
      const { data, error, count } = await query;
      if (!error) {
        setCustomers(data || []);
        setTotalCount(count || 0);
      } else setError('Failed to fetch customers');
      setLoading(false);
    };
    fetchCustomers();
  }, [page, rowsPerPage, search, filterBarangay, filterType]);

  const fetchDiscountOptions = async () => {
    const { data, error } = await supabase
      .from('discount')
      .select('*');
    if (!error) {
      console.log('Discount options fetched:', data); // Debug log
      setDiscountOptions(data || []);
    } else {
      console.error('Error fetching discount options:', error);
    }
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
    fetchDiscountOptions();
    fetchTypeOptions();
    fetchBarangayOptions();
  }, []);

  const handleSearch = (c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterBarangay || c.barangay === filterBarangay) &&
    (!filterType || c.type === filterType);

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
    if (!form.name) return showSnackbar('Name is required', 'error');
    if (editId) {
      // Edit
      const { error } = await supabase
        .from('customers')
        .update({ ...form })
        .eq('customerid', editId);
      if (!error) showSnackbar(`Customer "${form.name}" updated successfully.`, 'success');
      else {
        console.error('Update failed:', error);
        showSnackbar(`Update failed: ${error?.message || 'Unknown error'}`, 'error');
      }
    } else {
      // Add
      const customerid = await generateUniqueCustomerId(supabase);
      const { error } = await supabase
        .from('customers')
        .insert([{ ...form, customerid }]);
      if (!error) showSnackbar(`Customer "${form.name}" added successfully.`, 'success');
      else showSnackbar(`Add failed: ${error?.message || 'Unknown error'}`, 'error');
    }
    setOpenDialog(false);
    // fetchCustomers(); // This is now handled by the useEffect
  };

  const handleDelete = async (id) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('customerid', id);
    if (!error) showSnackbar('Customer deleted successfully.', 'success');
    else showSnackbar(`Delete failed: ${error?.message || 'Unknown error'}`, 'error');
    // fetchCustomers(); // This is now handled by the useEffect
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
    <Box sx={{ minHeight: '100vh', p: { xs: 0, sm: 3 }, bgcolor: '#f7f9fb', width: '100%', overflow: 'hidden' }}>
      <Box sx={{ py: { xs: 1, sm: 4 }, px: { xs: 1, sm: 2 }, width: '100%' }}>
        {/* Simple Header */}
        <Box sx={{ mb: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', width: '100%' }}>
          <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#22223b', mb: 0.5, fontSize: { xs: 20, sm: 24 } }}>
              Customers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total: {totalCount}
            </Typography>
          </Box>
          {/* Filters and Actions */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch" sx={{ mt: { xs: 2, sm: 0 }, width: { xs: '100%', sm: 'auto' } }}>
            <TextField
              label="Search by name"
              variant="outlined"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              sx={{ width: { xs: '100%', sm: 180 } }}
              inputProps={{ style: { fontSize: 15 } }}
            />
            <FormControl sx={{ minWidth: { xs: '100%', sm: 120 }, width: { xs: '100%', sm: 120 } }} size="small">
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
            <FormControl sx={{ minWidth: { xs: '100%', sm: 120 }, width: { xs: '100%', sm: 120 } }} size="small">
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
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => exportToCSV(customers, 'customers.csv')}
              sx={{ fontWeight: 500, borderRadius: 2, minWidth: 44, width: { xs: '100%', sm: 'auto' } }}
            >
              Export
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleDialogOpen()}
              sx={{ fontWeight: 500, borderRadius: 2, minWidth: 44, width: { xs: '100%', sm: 'auto' } }}
            >
              Add
            </Button>
          </Stack>
        </Box>
        {/* Table Section */}
        <Paper elevation={0} sx={{ borderRadius: 2, boxShadow: 'none', width: '100%', mb: 2 }}>
          <Table sx={{ width: '100%', fontSize: { xs: 12, sm: 15 } }} size={isMobile ? 'small' : 'medium'}>
            <TableHead>
              <TableRow sx={{ background: '#f1f3f6' }}>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Barangay</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 }, display: { xs: 'none', md: 'table-cell' } }}>Discount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 }, display: { xs: 'none', lg: 'table-cell' } }}>Remarks</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: rowsPerPage }).map((_, i) => (
                  <TableRow key={i} sx={{ background: i % 2 === 0 ? '#fff' : '#f7f9fb' }}>
                    <TableCell sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={40} /></TableCell>
                    <TableCell sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={60} /></TableCell>
                    <TableCell sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={40} /></TableCell>
                    <TableCell sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={50} /></TableCell>
                    <TableCell sx={{ px: { xs: 1, sm: 2 }, display: { xs: 'none', md: 'table-cell' } }}><Skeleton variant="text" width={40} /></TableCell>
                    <TableCell sx={{ px: { xs: 1, sm: 2 }, display: { xs: 'none', lg: 'table-cell' } }}><Skeleton variant="text" width={60} /></TableCell>
                    <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={40} /></TableCell>
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: { xs: 13, sm: 15 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, mb: 1, fontSize: { xs: 15, sm: 18 } }}>
                      No customers found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your search or filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer, index) => (
                  <TableRow
                    key={customer.customerid}
                    sx={{ background: index % 2 === 0 ? '#fff' : '#f7f9fb', transition: 'none' }}
                  >
                    <TableCell sx={{ color: '#22223b', fontWeight: 500, fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>{customer.customerid}</TableCell>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>{customer.name}</TableCell>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>{customer.type}</TableCell>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>{customer.barangay}</TableCell>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 }, display: { xs: 'none', md: 'table-cell' } }}>{customer.discount}</TableCell>
                    <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 }, display: { xs: 'none', lg: 'table-cell' } }}>{customer.remarks}</TableCell>
                    <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                      <IconButton color="primary" onClick={() => handleDialogOpen(customer)} size="small">
                        <EditIcon />
                      </IconButton>
                      <IconButton color="error" onClick={() => handleDeleteClick(customer.customerid)} size="small">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            sx={{ background: '#f7f9fb', borderTop: '1px solid #e5e7eb', '.MuiTablePagination-toolbar': { px: { xs: 1, sm: 2 } }, '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontWeight: 500, color: '#374151', fontSize: { xs: 13, sm: 15 } } }}
          />
        </Paper>
      </Box>
      {/* Dialog for Add/Edit */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="xs" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2, bgcolor: '#fff', minHeight: isMobile ? '100vh' : 'auto', width: '100vw', m: 0 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: { xs: 18, sm: 20 }, color: '#22223b', pb: 1, px: { xs: 2, sm: 3 } }}>
          {editId ? 'Edit Customer' : 'Add Customer'}
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <TextField
              label="Customer Name"
              name="name"
              value={form.name}
              onChange={handleFormChange}
              fullWidth
              required
              placeholder="Enter full name..."
              inputProps={{ style: { fontSize: 15 } }}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                name="type"
                value={form.type}
                label="Type"
                onChange={handleFormChange}
              >
                {typeOptions.map(t => <MenuItem key={t.type} value={t.type}>{t.type}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Barangay</InputLabel>
              <Select
                name="barangay"
                value={form.barangay}
                label="Barangay"
                onChange={handleFormChange}
              >
                {barangayOptions.map(b => <MenuItem key={b.barangay} value={b.barangay}>{b.barangay}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Discount</InputLabel>
              <Select
                name="discount"
                value={form.discount}
                label="Discount"
                onChange={handleFormChange}
              >
                <MenuItem value="">None</MenuItem>
                {discountOptions.map((d, index) => (
                  <MenuItem key={index} value={d.discountpercentage || d.discount || d.type || d.id}>
                    {d.type ? `${d.type} (${d.discountpercentage || d.discount || 0}%)` : d.discountpercentage ? `${d.discountpercentage}%` : d.discount || 'Discount Option'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Remarks"
              name="remarks"
              value={form.remarks}
              onChange={handleFormChange}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              placeholder="Additional notes or remarks..."
              inputProps={{ style: { fontSize: 15 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
          <Button onClick={handleDialogClose} variant="outlined" sx={{ borderRadius: 2, minWidth: 100, width: { xs: '100%', sm: 'auto' } }}>
            Cancel
          </Button>
          <Button onClick={handleAddOrEdit} variant="contained" sx={{ borderRadius: 2, minWidth: 120, width: { xs: '100%', sm: 'auto' } }}>
            {editId ? 'Save Changes' : 'Add Customer'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2, bgcolor: '#fff', width: '100vw', m: 0 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: { xs: 16, sm: 18 } }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: { xs: 14, sm: 15 } }}>Are you sure you want to delete this customer?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
          <Button onClick={handleDeleteCancel} sx={{ minHeight: 44, fontSize: { xs: 14, sm: 15 }, width: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" sx={{ minHeight: 44, fontSize: { xs: 14, sm: 15 }, width: { xs: '100%', sm: 'auto' } }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Customers; 