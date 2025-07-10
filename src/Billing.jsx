import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl, Snackbar, Alert, TablePagination, Stack, Autocomplete, Tabs, Tab, Card, CardContent, Avatar, Tooltip, CircularProgress, Divider, CardHeader, Skeleton, Container
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Receipt as ReceiptIcon, Group as GroupIcon, Search as SearchIcon, FilterList as FilterListIcon, SentimentDissatisfied as EmptyIcon } from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/Download';
import PageHeader from './PageHeader';
import { useGlobalSnackbar } from './GlobalSnackbar';
import AnimatedBackground from './AnimatedBackground';

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

// Surcharge calculation function
function calculateSurcharge(billedMonth, basicAmount) {
  if (!billedMonth || !basicAmount || isNaN(Number(basicAmount))) return 0;
  // billedMonth is in 'YYYY-MM' or 'YYYY-MM-01' format
  let [year, month] = billedMonth.slice(0, 7).split('-').map(Number);
  // Due date is 20th of the following month
  let dueMonth = month + 1;
  let dueYear = year;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  const dueDate = new Date(`${dueYear}-${dueMonth.toString().padStart(2, '0')}-20T00:00:00`);
  // End of due month
  const endOfDueMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59);
  const now = new Date();
  const basic = Number(basicAmount);
  let surcharge = 0;
  if (now > dueDate && now <= endOfDueMonth) {
    surcharge = basic * 0.10;
  } else if (now > endOfDueMonth) {
    surcharge = basic * 0.10;
    surcharge += (basic + surcharge) * 0.05;
  }
  return Number(surcharge.toFixed(2));
}

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

const Billing = () => {
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const showSnackbar = useGlobalSnackbar();
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
  // Add state for customer table pagination
  const [customerPage, setCustomerPage] = useState(0);
  const [customerRowsPerPage, setCustomerRowsPerPage] = useState(10);
  // Add state for recent bills pagination in modal
  const [modalBillsPage, setModalBillsPage] = useState(0);
  const [modalBillsRowsPerPage, setModalBillsRowsPerPage] = useState(15);
  // Add state for recent bills pagination in the Recent Bills tab
  const [recentBillsPage, setRecentBillsPage] = useState(0);
  const [recentBillsRowsPerPage, setRecentBillsRowsPerPage] = useState(10);
  const [customerTotalCount, setCustomerTotalCount] = useState(0);
  const [user, setUser] = useState({ name: '', role: '' });

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annDialogOpen, setAnnDialogOpen] = useState(false);
  const [annForm, setAnnForm] = useState({ title: '', description: '', status: 'active' });
  const [annSubmitting, setAnnSubmitting] = useState(false);
  const [annEditId, setAnnEditId] = useState(null);

  const fetchBills = async () => {
    setLoading(true);
    let query = supabase
      .from('bills')
      .select('*')
      .order('dateencoded', { ascending: false })
      .limit(10); // Only fetch 10 most recent bills
    if (filterCustomer) query = query.eq('customerid', filterCustomer);
    const { data, error } = await query;
    console.log('Fetched bills:', data); // Debug log
    if (error) console.error('Fetch bills error:', error); // Debug log
    if (!error) setBills(data || []);
    setLoading(false);
  };

  const fetchCustomers = async () => {
    const from = customerPage * customerRowsPerPage;
    const to = from + customerRowsPerPage - 1;
    let query = supabase
      .from('customers')
      .select('customerid, name, type, barangay', { count: 'exact' })
      .range(from, to);
    if (customerSearch) query = query.ilike('name', `%${customerSearch}%`);
    if (filterBarangay) query = query.eq('barangay', filterBarangay);
    if (filterType) query = query.eq('type', filterType);
    if (sortOption === 'name_asc') query = query.order('name', { ascending: true });
    if (sortOption === 'name_desc') query = query.order('name', { ascending: false });
    const { data, error, count } = await query;
    if (!error) {
      setCustomers(data || []);
      setCustomerTotalCount(count || 0);
    }
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
  }, []); // Always fetch bills on mount

  useEffect(() => {
    fetchCustomers();
    fetchBarangayOptions();
    fetchTypeOptions();
    // Fetch current user's full name
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
  }, []); // Only run once on mount

  // Remove in-memory filteredCustomers and paginatedCustomers
  // Add this useEffect for fetching customers with correct dependencies
  useEffect(() => {
    const fetchCustomers = async () => {
      const from = customerPage * customerRowsPerPage;
      const to = from + customerRowsPerPage - 1;
      let query = supabase
        .from('customers')
        .select('customerid, name, type, barangay', { count: 'exact' })
        .range(from, to);
      if (customerSearch) query = query.ilike('name', `%${customerSearch}%`);
      if (filterBarangay) query = query.eq('barangay', filterBarangay);
      if (filterType) query = query.eq('type', filterType);
      if (sortOption === 'name_asc') query = query.order('name', { ascending: true });
      if (sortOption === 'name_desc') query = query.order('name', { ascending: false });
      const { data, error, count } = await query;
      if (!error) {
        setCustomers(data || []);
        setCustomerTotalCount(count || 0);
      }
    };
    fetchCustomers();
  }, [customerPage, customerRowsPerPage, customerSearch, filterBarangay, filterType, sortOption]);

  // Auto-calculate basicamount when consumption or selected customer changes
  useEffect(() => {
    if (!selectedCustomer || form.previousreading === '' || form.currentreading === '') return;
    const custType = typeOptions.find(t => t.type === selectedCustomer.type);
    if (!custType) return;
    const prev = Number(form.previousreading);
    const curr = Number(form.currentreading);
    const consumption = curr - prev > 0 ? curr - prev : 0;
    let basic = 0;
    if (consumption === 0) {
      basic = Number(custType.rate1) || 0; // Minimum charge for 1 cubic
    } else if (consumption <= 3) {
      basic = consumption * (Number(custType.rate1) || 0);
    } else {
      basic = (3 * (Number(custType.rate1) || 0)) + ((consumption - 3) * (Number(custType.rate2) || 0));
    }
    setForm(f => ({ ...f, consumption, basicamount: basic.toFixed(2) }));
  }, [form.previousreading, form.currentreading, selectedCustomer, typeOptions]);

  // Update surcharge when billedmonth or basicamount changes
  useEffect(() => {
    if (!form.billedmonth || !form.basicamount) return;
    const surcharge = calculateSurcharge(form.billedmonth, form.basicamount);
    setForm(f => ({ ...f, surchargeamount: surcharge }));
  }, [form.billedmonth, form.basicamount]);

  // Add a ref for the Current Reading input
  const currentReadingRef = useRef(null);

  // Focus Current Reading input when modal opens
  useEffect(() => {
    if (openDialog && currentReadingRef.current) {
      setTimeout(() => currentReadingRef.current.focus(), 100);
    }
  }, [openDialog]);

  const handleDialogOpen = async (customer = null, bill = null) => {
    if (bill) {
      setForm({
        ...bill,
        billedmonth: bill.billedmonth ? bill.billedmonth.slice(0, 7) : ''
      });
      setEditId(bill.billid);
      setSelectedCustomer(customer);
    } else {
      // Get the most recent billed month from recentBills, fallback to ''
      let mostRecentBilledMonth = '';
      if (customer && customer.customerid) {
        // Find the latest bill for this customer from the same sorting as the recent bills table
        const customerRecentBills = bills
          .filter(b => b.customerid === customer.customerid)
          .sort((a, b) => new Date(b.billedmonth || b.dateencoded) - new Date(a.billedmonth || a.dateencoded));
        if (customerRecentBills.length > 0 && customerRecentBills[0].billedmonth) {
          // Get next month after the latest billed month
          const latest = customerRecentBills[0].billedmonth;
          let [year, month] = latest.slice(0, 7).split('-').map(Number);
          month += 1;
          if (month > 12) {
            month = 1;
            year += 1;
          }
          mostRecentBilledMonth = `${year}-${month.toString().padStart(2, '0')}`;
        } else {
          // Default to current month
          const now = new Date();
          mostRecentBilledMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        }
      } else {
        // Default to current month
        const now = new Date();
        mostRecentBilledMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      }
      let previousReading = '';
      if (customer && customer.customerid) {
        // Find the latest bill for this customer from the same sorting as the recent bills table
        const customerRecentBills = bills
          .filter(b => b.customerid === customer.customerid)
          .sort((a, b) => new Date(b.billedmonth || b.dateencoded) - new Date(a.billedmonth || a.dateencoded));
        if (customerRecentBills.length > 0) {
          previousReading = customerRecentBills[0].currentreading || '';
        }
      }
      setForm({ ...initialForm, customerid: customer?.customerid || '', billedmonth: mostRecentBilledMonth, previousreading: previousReading });
      setEditId(null);
      setSelectedCustomer(customer);
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
    // Prevent adding if Current Reading is empty
    if (!form.currentreading || form.currentreading === '') {
      showSnackbar('Please enter a valid current reading.', 'error');
      if (currentReadingRef.current) currentReadingRef.current.focus();
      return;
    }
    // Prevent adding if current reading is less than previous reading
    if (
      form.previousreading !== '' &&
      form.currentreading !== '' &&
      Number(form.currentreading) < Number(form.previousreading)
    ) {
      showSnackbar('Current reading cannot be less than previous reading.', 'error');
      if (currentReadingRef.current) currentReadingRef.current.focus();
      return;
    }
    // Calculate totalbillamount if not set
    let total = parseFloat(form.basicamount) || 0;
    total += parseFloat(form.surchargeamount) || 0;
    total -= parseFloat(form.discountamount) || 0;
    setForm(f => ({ ...f, totalbillamount: total }));
    // Do not calculate or set totalbillamount in Billing
    let payload = { ...form, totalbillamount: null };
    // Clean payload: convert empty strings to null for numeric/date fields
    Object.keys(payload).forEach(key => {
      if (
        [
          'previousreading', 'currentreading', 'consumption', 'basicamount', 'surchargeamount', 'discountamount', 'totalbillamount', 'advancepaymentamount', 'customerid'
        ].includes(key)
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
    // Ensure dateencoded is set for new bills
    if (!editId && !payload.dateencoded) {
      payload.dateencoded = new Date().toISOString();
    }
    // Set customerid for new bills
    if (!editId && selectedCustomer && selectedCustomer.customerid) {
      payload.customerid = selectedCustomer.customerid;
    }
    // Set customername for new bills
    if (!editId && selectedCustomer && selectedCustomer.name) {
      payload.customername = selectedCustomer.name;
    }
    // Set encodedby to current user's full name
    payload.encodedby = user.name;
    // Restrict duplicate bill for same customer and month
    if (!editId) {
      const { data: existing, error: checkError } = await supabase
        .from('bills')
        .select('billid')
        .eq('customerid', payload.customerid)
        .eq('billedmonth', payload.billedmonth);
      if (checkError) {
        showSnackbar('Failed to check for duplicate bill.', 'error');
        return;
      }
      if (existing && existing.length > 0) {
        const customerName = selectedCustomer?.name || 'Unknown Customer';
        let billedMonthDisplay = payload.billedmonth;
        if (billedMonthDisplay && billedMonthDisplay.length >= 7) {
          billedMonthDisplay = billedMonthDisplay.slice(0, 7);
        }
        showSnackbar(`A bill for ${customerName} and month ${billedMonthDisplay} already exists. Please choose a different month or customer.`, 'error');
        return;
      }
    }
    if (editId) {
      console.log('Update bill payload:', payload);
      delete payload.customers;
      const { error } = await supabase
        .from('bills')
        .update(payload)
        .eq('billid', editId);
      if (!error) showSnackbar('Bill details have been updated successfully.', 'success');
      else {
        console.error('Update bill failed:', error);
        showSnackbar('Failed to update bill details.', 'error');
      }
      fetchBills();
    } else {
      console.log('Bill payload:', payload);
      const { data, error } = await supabase
        .from('bills')
        .insert([payload])
        .select(); // Get the inserted bill back
      if (!error) {
        showSnackbar('New bill has been added successfully.', 'success');
        if (data && data[0]) {
          setBills(prev => [data[0], ...prev.slice(0, 9)]); // Optimistically add new bill to top, keep max 10
        } else {
          fetchBills(); // fallback
        }
      } else {
        console.error('Add bill failed:', error);
        showSnackbar('Failed to add new bill.', 'error');
      }
    }
    setOpenDialog(false);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('billid', id);
    if (!error) showSnackbar('Bill has been deleted successfully.', 'success');
    else showSnackbar('Failed to delete bill.', 'error');
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
  console.log('Recent bills (sorted):', recentBills); // Debug log

  // Add formatters
  const formatAmount = (value) => value !== null && value !== undefined && value !== '' ? `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
  const formatCubic = (value) => value !== null && value !== undefined && value !== '' ? Math.round(Number(value)).toLocaleString('en-PH') + ' m³' : '';

  const showReadingWarning =
    form.previousreading !== '' &&
    form.currentreading !== '' &&
    Number(form.currentreading) < Number(form.previousreading);

  // Paginate recentBills for display in the Recent Bills tab
  const paginatedRecentBills = recentBills.slice(
    recentBillsPage * recentBillsRowsPerPage,
    recentBillsPage * recentBillsRowsPerPage + recentBillsRowsPerPage
  );

  // Fetch announcements from Supabase
  useEffect(() => {
    if (tab !== 2) return;
    const fetchAnnouncements = async () => {
      setAnnLoading(true);
      const { data, error } = await supabase
        .from('announcement')
        .select('*')
        .order('date_posted', { ascending: false });
      setAnnouncements(error ? [] : data || []);
      setAnnLoading(false);
    };
    fetchAnnouncements();
  }, [tab, annDialogOpen]);

  // Add announcement handler
  const openAnnDialog = (announcement = null) => {
    if (announcement) {
      setAnnForm({
        title: announcement.title,
        description: announcement.description,
        status: announcement.status,
      });
      setAnnEditId(announcement.id);
    } else {
      setAnnForm({ title: '', description: '', status: 'active' });
      setAnnEditId(null);
    }
    setAnnDialogOpen(true);
  };

  // Add or update announcement handler
  const handleAddAnnouncement = async () => {
    if (!annForm.title || !annForm.description) {
      showSnackbar('Title and Description are required.', 'error');
      return;
    }
    setAnnSubmitting(true);
    let error;
    if (annEditId) {
      // Update
      const { error: updateError } = await supabase
        .from('announcement')
        .update({
          title: annForm.title,
          description: annForm.description,
          status: annForm.status,
        })
        .eq('id', annEditId);
      error = updateError;
    } else {
      // Add
      const { error: insertError } = await supabase
        .from('announcement')
        .insert([{
          title: annForm.title,
          description: annForm.description,
          status: annForm.status,
          posted_by: user.name || 'Unknown'
        }]);
      error = insertError;
    }
    setAnnSubmitting(false);
    if (!error) {
      showSnackbar(annEditId ? 'Announcement updated successfully.' : 'Announcement added successfully.', 'success');
      setAnnDialogOpen(false);
      setAnnForm({ title: '', description: '', status: 'active' });
      setAnnEditId(null);
    } else {
      showSnackbar(annEditId ? 'Failed to update announcement.' : 'Failed to add announcement.', 'error');
    }
  };

  return (
    <Box sx={{ position: 'relative', minHeight: '100vh', p: 0 }}>
      <AnimatedBackground />
      <Container maxWidth="lg" sx={{ py: 4, position: 'relative', zIndex: 2 }}>
        <PageHeader title="Billing & Announcements" />
        {(loading || customers.length === 0) ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label="Add Bill" />
              <Tab label="Recent Bills" />
              <Tab label="Announcements" />
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
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 2px 8px rgba(30,58,138,0.04)', mb: 2 }}>
                  <Table sx={{ minWidth: 800 }} stickyHeader>
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
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton variant="text" width={80} /></TableCell>
                            <TableCell><Skeleton variant="text" width={120} /></TableCell>
                            <TableCell><Skeleton variant="text" width={80} /></TableCell>
                            <TableCell><Skeleton variant="text" width={100} /></TableCell>
                            <TableCell align="right"><Skeleton variant="text" width={100} /></TableCell>
                          </TableRow>
                        ))
                      ) : bills.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'text.secondary' }}>
                              <EmptyIcon sx={{ fontSize: 48, mb: 1 }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                No bills found
                              </Typography>
                              <Typography variant="body2">Try adjusting your search or filters.</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((customer) => (
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
                                <Button variant="contained" size="small" onClick={async () => { await handleDialogOpen(customer); }}>
                                  Add Bill
                                </Button>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      {customers.length === 0 && (
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
                  <TablePagination
                    component="div"
                    count={customerTotalCount}
                    page={customerPage}
                    onPageChange={(e, newPage) => setCustomerPage(newPage)}
                    rowsPerPage={customerRowsPerPage}
                    onRowsPerPageChange={e => {
                      setCustomerRowsPerPage(parseInt(e.target.value, 10));
                      setCustomerPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                  />
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
                      {paginatedRecentBills.map((bill) => (
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
                              <IconButton color="primary" onClick={() => {
                                const customer = customers.find(c => c.customerid === bill.customerid);
                                handleDialogOpen(customer, bill);
                              }}><EditIcon /></IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton color="error" onClick={() => handleDeleteClick(bill.billid)}><DeleteIcon /></IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedRecentBills.length === 0 && (
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
                  <TablePagination
                    component="div"
                    count={recentBills.length}
                    page={recentBillsPage}
                    onPageChange={(e, newPage) => setRecentBillsPage(newPage)}
                    rowsPerPage={recentBillsRowsPerPage}
                    onRowsPerPageChange={e => {
                      setRecentBillsRowsPerPage(parseInt(e.target.value, 10));
                      setRecentBillsPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                  />
                </TableContainer>
              </>
            )}
            {tab === 2 && (
              <Paper elevation={1} sx={{ p: 4, borderRadius: 2, background: '#f0f9ff', minHeight: 200 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Announcements
                  </Typography>
                  <Button variant="contained" onClick={() => openAnnDialog()}>
                    Add Announcement
                  </Button>
                </Stack>
                {annLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                ) : announcements.length === 0 ? (
                  <Typography variant="body1" color="text.secondary">
                    No announcements yet.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 0, background: 'transparent' }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Date Posted</TableCell>
                          <TableCell>Posted By</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {announcements.map(a => (
                          <TableRow key={a.id}>
                            <TableCell>{a.title}</TableCell>
                            <TableCell>{a.description}</TableCell>
                            <TableCell>{a.status}</TableCell>
                            <TableCell>{a.date_posted ? new Date(a.date_posted).toLocaleString() : ''}</TableCell>
                            <TableCell>{a.posted_by}</TableCell>
                            <TableCell align="right">
                              <Button size="small" startIcon={<EditIcon />} onClick={() => openAnnDialog(a)}>
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                <Dialog open={annDialogOpen} onClose={() => setAnnDialogOpen(false)} maxWidth="sm" fullWidth>
                  <DialogTitle>{annEditId ? 'Edit Announcement' : 'Add Announcement'}</DialogTitle>
                  <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                      <TextField
                        label="Title"
                        value={annForm.title}
                        onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))}
                        fullWidth
                        required
                      />
                      <TextField
                        label="Description"
                        value={annForm.description}
                        onChange={e => setAnnForm(f => ({ ...f, description: e.target.value }))}
                        fullWidth
                        multiline
                        minRows={3}
                        required
                      />
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={annForm.status}
                          label="Status"
                          onChange={e => setAnnForm(f => ({ ...f, status: e.target.value }))}
                        >
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="archived">Archived</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => { setAnnDialogOpen(false); setAnnEditId(null); }}>Cancel</Button>
                    <Button onClick={handleAddAnnouncement} variant="contained" disabled={annSubmitting}>
                      {annSubmitting ? (annEditId ? 'Saving...' : 'Adding...') : (annEditId ? 'Save' : 'Add')}
                    </Button>
                  </DialogActions>
                </Dialog>
              </Paper>
            )}
          </>
        )}
      </Container>
      {/* Dialogs and Snackbar remain unchanged */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 24, pb: 0, color: '#1e293b', letterSpacing: 0.5 }}>{editId ? 'Edit Bill' : 'Add Bill'}</DialogTitle>
        <DialogContent sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 0,
          mt: 1,
          p: 0,
          minHeight: 420,
          background: '#f3f6fa',
          borderRadius: 3,
          boxShadow: 2,
          position: 'relative'
        }}>
          {/* Recent bills for selected customer (left side) */}
          {selectedCustomer && (
            <Card elevation={2} sx={{
              minWidth: 380, maxWidth: 600, flex: 1.2,
              background: 'linear-gradient(135deg, #f8fafc 60%, #e0e7ef 100%)',
              borderRadius: 0,
              borderRight: { md: '1.5px solid #e0e0e0' },
              boxShadow: 'none',
              display: 'flex', flexDirection: 'column', height: '100%',
              justifyContent: 'flex-start',
              px: 0, py: 0
            }}>
              <CardHeader title="Recent Bills" sx={{
                fontWeight: 700, fontSize: 18, color: '#334155', background: 'transparent', pb: 0, pt: 2, pl: 3
              }} />
              <CardContent sx={{ p: 0, pl: 3, pr: 2, pt: 1, pb: 1, minWidth: 350, maxHeight: 320, overflowY: 'auto' }}>
                <Table size="small" sx={{ mb: 1, minWidth: 420 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: 15 }}>Month</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#64748b', fontSize: 15 }}>Prev</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#64748b', fontSize: 15 }}>Curr</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#64748b', fontSize: 15 }}>Cons</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#64748b', fontSize: 15 }}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bills
                      .filter(b => b.customerid === selectedCustomer.customerid)
                      .sort((a, b) => new Date(b.billedmonth || b.dateencoded) - new Date(a.billedmonth || a.dateencoded))
                      .slice(modalBillsPage * modalBillsRowsPerPage, modalBillsPage * modalBillsRowsPerPage + modalBillsRowsPerPage)
                      .map(bill => (
                        <TableRow key={bill.billid} hover sx={{ transition: 'background 0.2s', '&:hover': { background: '#e3e9f6' } }}>
                          <TableCell>{bill.billedmonth ? bill.billedmonth.slice(0, 7) : ''}</TableCell>
                          <TableCell align="right">{bill.previousreading}</TableCell>
                          <TableCell align="right">{bill.currentreading}</TableCell>
                          <TableCell align="right">{bill.consumption}</TableCell>
                          <TableCell align="right">{formatAmount(bill.basicamount)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={bills.filter(b => b.customerid === selectedCustomer.customerid).length}
                  page={modalBillsPage}
                  onPageChange={(e, newPage) => setModalBillsPage(newPage)}
                  rowsPerPage={modalBillsRowsPerPage}
                  onRowsPerPageChange={e => {
                    setModalBillsRowsPerPage(parseInt(e.target.value, 10));
                    setModalBillsPage(0);
                  }}
                  rowsPerPageOptions={[15, 30, 50]}
                  labelRowsPerPage={''}
                  sx={{ mt: 1, mb: 0, '.MuiTablePagination-toolbar': { minHeight: 32, height: 32, pl: 0, pr: 0 }, '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: 12 } }}
                />
              </CardContent>
            </Card>
          )}
          {/* Vertical divider for desktop */}
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' }, mx: 0, my: 3, borderColor: '#e0e0e0', width: '1.5px' }} />
          {/* Bill input fields (right side) */}
          <Card elevation={2} sx={{ flex: 0.8, minWidth: 0, background: '#fff', borderRadius: 0, boxShadow: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
            <CardHeader title={editId ? 'Edit Bill Details' : 'Add Bill Details'} sx={{ fontWeight: 700, fontSize: 18, color: '#334155', background: 'transparent', pb: 0, pt: 2, pl: 0 }} />
            <CardContent sx={{ p: 0, pt: 1 }}>
              {selectedCustomer && (
                <Box sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, background: '#f9fafb' }}>
                  <Typography variant="subtitle2">Customer Details</Typography>
                  <Typography>ID: {selectedCustomer.customerid}</Typography>
                  <Typography>Name: {selectedCustomer.name}</Typography>
                  <Typography>Type: {selectedCustomer.type}</Typography>
                  <Typography>Barangay: {selectedCustomer.barangay}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <TextField
                  label="Billed Month"
                  name="billedmonth"
                  type="month"
                  value={form.billedmonth}
                  onChange={handleFormChange}
                  InputLabelProps={{ shrink: true }}
                  required
                  sx={{ flex: 1 }}
                />
                <TextField label="Previous Reading" name="previousreading" type="number" value={form.previousreading} onChange={handleFormChange} required sx={{ flex: 1 }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mt: 2 }}>
                <TextField label="Current Reading" name="currentreading" type="number" value={form.currentreading} onChange={handleFormChange} required sx={{ flex: 1 }} inputRef={currentReadingRef} />
                <TextField label="Consumption" name="consumption" type="number" value={form.consumption} InputProps={{ readOnly: true }} sx={{ flex: 1 }} />
              </Box>
              {showReadingWarning && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                  Note: Current reading is less than previous reading!
                </Typography>
              )}
              <TextField label="Basic Amount" name="basicamount" type="text" value={formatAmount(form.basicamount)} InputProps={{ readOnly: true }} required sx={{ mt: 2, maxWidth: 300 }} />
            </CardContent>
          </Card>
        </DialogContent>
        <DialogActions sx={{ pr: 3, pb: 2, background: '#f3f6fa', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button onClick={() => { setSelectedCustomer(null); handleDialogClose(); }} variant="outlined" sx={{ minWidth: 110, fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleAddOrEdit} variant="contained" sx={{ minWidth: 110, fontWeight: 600 }}>{editId ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
      {/* Remove local Snackbar/Alert, global snackbar will handle alerts */}
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