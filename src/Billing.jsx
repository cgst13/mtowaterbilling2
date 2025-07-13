import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl, Snackbar, Alert, TablePagination, Stack, Autocomplete, Tabs, Tab, Card, CardContent, Avatar, Tooltip, CircularProgress, Divider, CardHeader, Skeleton, Container, Grid, Chip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Receipt as ReceiptIcon, Group as GroupIcon, Search as SearchIcon, FilterList as FilterListIcon, SentimentDissatisfied as EmptyIcon, Announcement as AnnouncementIcon, Close as CloseIcon } from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/Download';
import PageHeader from './PageHeader';
import { useGlobalSnackbar } from './GlobalSnackbar';
import AnimatedBackground from './AnimatedBackground';
import useMediaQuery from '@mui/material/useMediaQuery';

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

  // Add state for recent bills filters
  const [recentBillsMonth, setRecentBillsMonth] = useState('');
  const [recentBillsBarangay, setRecentBillsBarangay] = useState('');

  const fetchBills = async () => {
    setLoading(true);
    let allBills = [];
    let hasMore = true;
    let offset = 0;
    const limit = 1000; // Supabase default limit

    try {
      while (hasMore) {
        const { data, error } = await supabase
      .from('bills')
      .select('*')
      .order('dateencoded', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error('Fetch bills error:', error);
          break;
        }

        if (data && data.length > 0) {
          allBills = [...allBills, ...data];
          offset += limit;
          
          // If we got less than the limit, we've reached the end
          if (data.length < limit) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log('Fetched bills:', allBills);
      setBills(allBills);
    } catch (err) {
      console.error('Error fetching bills:', err);
    }
    
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
      // Use a longer timeout to ensure the modal is fully rendered
      const timer = setTimeout(() => {
        if (currentReadingRef.current) {
          currentReadingRef.current.focus();
          // Also select any existing text for easy replacement
          currentReadingRef.current.select();
        }
      }, 300);
      
      return () => clearTimeout(timer);
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
    setModalBillsPage(0); // Reset modal pagination when opening
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
    // Use the calculated totalbillamount in the payload
    let payload = { ...form, totalbillamount: total };
    if (!editId) {
      // Generate a random 8-digit number
      let uniqueBillId;
      let isUnique = false;
      while (!isUnique) {
        uniqueBillId = Math.floor(10000000 + Math.random() * 90000000); // 8-digit
        // Check if this billid already exists in the current bills list (client-side check)
        isUnique = !bills.some(b => b.billid === uniqueBillId);
      }
      payload.billid = uniqueBillId;
    }
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
      payload.dateencoded = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
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
          fetchBills(); // Always fetch all bills after add
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

  // Filter for recent bills (sorted by dateencoded desc) - REMOVE 10 RECORD LIMIT
  const recentBills = [...bills].sort((a, b) => new Date(b.dateencoded) - new Date(a.dateencoded));
  console.log('Recent bills (sorted):', recentBills); // Debug log

  // Add formatters
  const formatAmount = (value) => value !== null && value !== undefined && value !== '' ? `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
  const formatCubic = (value) => value !== null && value !== undefined && value !== '' ? Math.round(Number(value)).toLocaleString('en-PH') + ' m³' : '';

  const showReadingWarning =
    form.previousreading !== '' &&
    form.currentreading !== '' &&
    Number(form.currentreading) < Number(form.previousreading);

  // Filter bills by customer name and billed month for Recent Bills tab (apply filter BEFORE pagination)
  const filteredRecentBills = recentBills.filter(bill => {
    const name = bill.customername || bill.customers?.name || '';
    const matchesName = name.toLowerCase().includes(search.toLowerCase());
    const matchesMonth = recentBillsMonth ? (bill.billedmonth && bill.billedmonth.slice(0, 7) === recentBillsMonth) : true;
    return matchesName && matchesMonth;
  });
  // Paginate filtered results
  const paginatedRecentBills = filteredRecentBills.slice(
    recentBillsPage * recentBillsRowsPerPage,
    recentBillsPage * recentBillsRowsPerPage + recentBillsRowsPerPage
  );

  // Filter and paginate bills for selected customer in modal
  const selectedCustomerBills = selectedCustomer
    ? bills
        .filter(b => String(b.customerid) === String(selectedCustomer.customerid))
        .sort((a, b) => new Date(b.billedmonth || b.dateencoded) - new Date(a.billedmonth || a.dateencoded))
    : [];
  const paginatedSelectedCustomerBills = selectedCustomerBills.slice(
    modalBillsPage * modalBillsRowsPerPage,
    modalBillsPage * modalBillsRowsPerPage + modalBillsRowsPerPage
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

  const isMobile = useMediaQuery('(max-width:600px)');

  // Debug logs for recent bills modal
  useEffect(() => {
      console.log('All bills:', bills);
    if (selectedCustomer) {
      console.log('Selected customer:', selectedCustomer);
      console.log('Filtered bills:', bills.filter(b => String(b.customerid) === String(selectedCustomer.customerid)));
    }
  }, [bills, selectedCustomer]);

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 0, sm: 3 }, bgcolor: '#f7f9fb', width: '100%', overflow: 'hidden' }}>
      <Box sx={{ py: { xs: 1, sm: 4 }, px: { xs: 1, sm: 2 }, width: '100%' }}>
        {/* Simple Title Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#22223b', mb: 0.5, fontSize: { xs: 20, sm: 24 } }}>
            Billing & Announcements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage system announcements and notifications
          </Typography>
        </Box>
        {(loading || customers.length === 0) ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Tabs 
              value={tab} 
              onChange={(_, v) => setTab(v)} 
              sx={{ 
                mb: { xs: 2, sm: 3 },
                '& .MuiTabs-indicator': {
                  height: 3,
                  background: '#3b82f6',
                },
                '& .MuiTab-root': {
                  minHeight: 48,
                  fontSize: { xs: 14, sm: 16 },
                  fontWeight: 600,
                  textTransform: 'none',
                  color: '#64748b',
                  '&:hover': {
                    color: '#1e40af',
                    background: 'rgba(59, 130, 246, 0.04)',
                  },
                  '&.Mui-selected': {
                    color: '#1e40af',
                    background: '#f8fafc',
                  },
                },
              }}
            >
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddIcon sx={{ fontSize: 18 }} />
                    Add Bill
                  </Box>
                } 
              />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ReceiptIcon sx={{ fontSize: 18 }} />
                    Recent Bills
                  </Box>
                } 
              />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AnnouncementIcon sx={{ fontSize: 18 }} />
                    Announcements
                  </Box>
                } 
              />
            </Tabs>
            {tab === 0 && (
              <Box sx={{ mb: 3 }}>
                {/* Simple Header */}
                <Box sx={{ mb: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', width: '100%' }}>
                  <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#22223b', mb: 0.5, fontSize: { xs: 20, sm: 24 } }}>
                      Customer Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Customers: {customerTotalCount}
                    </Typography>
                  </Box>
                  {/* Filters */}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch" sx={{ mt: { xs: 2, sm: 0 }, width: { xs: '100%', sm: 'auto' } }}>
                    <TextField
                      label="Search customer name"
                      variant="outlined"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      size="small"
                      sx={{ width: { xs: '100%', sm: 200 } }}
                      inputProps={{ style: { fontSize: 15 } }}
                    />
                    <FormControl sx={{ minWidth: { xs: '100%', sm: 140 }, width: { xs: '100%', sm: 140 } }} size="small">
                      <InputLabel>Barangay</InputLabel>
                      <Select
                        value={filterBarangay}
                        label="Barangay"
                        onChange={e => {
                          setFilterBarangay(e.target.value);
                          setCustomerPage(0);
                        }}
                      >
                        <MenuItem value="">All Barangays</MenuItem>
                        {barangayOptions.map(b => <MenuItem key={b.barangay} value={b.barangay}>{b.barangay}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: { xs: '100%', sm: 140 }, width: { xs: '100%', sm: 140 } }} size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={filterType}
                        label="Type"
                        onChange={e => {
                          setFilterType(e.target.value);
                          setCustomerPage(0);
                        }}
                      >
                        <MenuItem value="">All Types</MenuItem>
                        {typeOptions.map(t => <MenuItem key={t.type} value={t.type}>{t.type}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: { xs: '100%', sm: 120 }, width: { xs: '100%', sm: 120 } }} size="small">
                      <InputLabel>Sort</InputLabel>
                      <Select
                        value={sortOption}
                        label="Sort"
                        onChange={e => {
                          setSortOption(e.target.value);
                          setCustomerPage(0);
                        }}
                      >
                        <MenuItem value="name_asc">Name A-Z</MenuItem>
                        <MenuItem value="name_desc">Name Z-A</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                </Box>
                
                {/* Table */}
                <Paper elevation={0} sx={{ borderRadius: 2, boxShadow: 'none', width: '100%', mb: 2 }}>
                  <Table sx={{ width: '100%', fontSize: { xs: 12, sm: 15 } }} size={isMobile ? 'small' : 'medium'}>
                    <TableHead>
                      <TableRow sx={{ background: '#f1f3f6' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Customer ID</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Barangay</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i} sx={{ background: i % 2 === 0 ? '#fff' : '#f7f9fb' }}>
                            <TableCell sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={60} /></TableCell>
                            <TableCell sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={100} /></TableCell>
                            <TableCell sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={60} /></TableCell>
                            <TableCell sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={80} /></TableCell>
                            <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}><Skeleton variant="text" width={60} /></TableCell>
                          </TableRow>
                        ))
                      ) : customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: { xs: 13, sm: 15 } }}>
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
                            <TableCell sx={{ color: '#22223b', fontWeight: 500, fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {customer.customerid}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {customer.name}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {customer.type}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {customer.barangay}
                            </TableCell>
                            <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                              <Button 
                                variant="contained" 
                                size="small" 
                                onClick={async () => { await handleDialogOpen(customer); }}
                                sx={{ 
                                  fontWeight: 500,
                                  borderRadius: 2,
                                  px: 2,
                                  minWidth: 44
                                }}
                              >
                                Add Bill
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
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
                    sx={{ background: '#f7f9fb', borderTop: '1px solid #e5e7eb', '.MuiTablePagination-toolbar': { px: { xs: 1, sm: 2 } }, '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontWeight: 500, color: '#374151', fontSize: { xs: 13, sm: 15 } } }}
                  />
                </Paper>
              </Box>
            )}
            {tab === 1 && (
              <Box sx={{ mb: 3 }}>
                {/* Simple Header */}
                <Box sx={{ mb: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', width: '100%' }}>
                  <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#22223b', mb: 0.5, fontSize: { xs: 20, sm: 24 } }}>
                      Recent Bills
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Bills: {recentBills.length}
                    </Typography>
                  </Box>
                  {/* Filters */}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch" sx={{ mt: { xs: 2, sm: 0 }, width: { xs: '100%', sm: 'auto' } }}>
                    <TextField
                      label="Search by customer name"
                      variant="outlined"
                      value={search}
                      onChange={e => { setSearch(e.target.value); setRecentBillsPage(0); }}
                      size="small"
                      sx={{ width: { xs: '100%', sm: 220 } }}
                      inputProps={{ style: { fontSize: 15 } }}
                    />
                    <TextField
                      label="Billed Month"
                      type="month"
                      value={recentBillsMonth}
                      onChange={e => { setRecentBillsMonth(e.target.value); setRecentBillsPage(0); }}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: '100%', sm: 160 } }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => { setSearch(''); setRecentBillsMonth(''); setRecentBillsPage(0); }}
                      sx={{ 
                        minWidth: 120, 
                        height: 40,
                        borderRadius: 2,
                        fontWeight: 500,
                        width: { xs: '100%', sm: 'auto' }
                      }}
                    >
                      Clear
                    </Button>
                  </Stack>
                </Box>
                
                {/* Table */}
                <Paper elevation={0} sx={{ borderRadius: 2, boxShadow: 'none', width: '100%', mb: 2 }}>
                  <Table size={isMobile ? 'small' : 'medium'} sx={{ width: '100%', fontSize: { xs: 12, sm: 15 } }}>
                    <TableHead>
                      <TableRow sx={{ background: '#f1f3f6' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Bill ID</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Billed Month</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Previous Reading</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Current Reading</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Consumption</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Basic Amount</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedRecentBills
                        .map((bill, index) => (
                          <TableRow 
                            key={bill.billid} 
                            sx={{ background: index % 2 === 0 ? '#fff' : '#f7f9fb', transition: 'none' }}
                          >
                            <TableCell sx={{ color: '#22223b', fontWeight: 500, fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {bill.billid}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {bill.customername || bill.customers?.name || ''}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {bill.billedmonth ? bill.billedmonth.slice(0, 7) : ''}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {formatCubic(bill.previousreading)}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {formatCubic(bill.currentreading)}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {formatCubic(bill.consumption)}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontWeight: 600, fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {formatAmount(bill.basicamount)}
                            </TableCell>
                            <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <IconButton 
                                  color="primary" 
                                  onClick={() => {
                                    const customer = customers.find(c => c.customerid === bill.customerid);
                                    handleDialogOpen(customer, bill);
                                  }}
                                  size="small"
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton 
                                  color="error" 
                                  onClick={() => handleDeleteClick(bill.billid)}
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      {paginatedRecentBills.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary', fontSize: { xs: 13, sm: 15 } }}>
                            <Typography variant="h6" sx={{ fontWeight: 500, mb: 1, fontSize: { xs: 15, sm: 18 } }}>
                              No bills found
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Try adjusting your search or filters.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <TablePagination
                    component="div"
                    count={filteredRecentBills.length}
                    page={recentBillsPage}
                    onPageChange={(e, newPage) => setRecentBillsPage(newPage)}
                    rowsPerPage={recentBillsRowsPerPage}
                    onRowsPerPageChange={e => {
                      setRecentBillsRowsPerPage(parseInt(e.target.value, 10));
                      setRecentBillsPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                    sx={{ background: '#f7f9fb', borderTop: '1px solid #e5e7eb', '.MuiTablePagination-toolbar': { px: { xs: 1, sm: 2 } }, '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontWeight: 500, color: '#374151', fontSize: { xs: 13, sm: 15 } } }}
                  />
                </Paper>
              </Box>
            )}
            {tab === 2 && (
              <Box sx={{ mb: 3 }}>
                {/* Simple Header */}
                <Box sx={{ mb: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', width: '100%' }}>
                  <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#22223b', mb: 0.5, fontSize: { xs: 20, sm: 24 } }}>
                      Announcements
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage system announcements and notifications
                    </Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    onClick={() => openAnnDialog()} 
                    sx={{ 
                      minHeight: 48, 
                      fontSize: { xs: 13, sm: 15 },
                      fontWeight: 500,
                      borderRadius: 2,
                      px: 3,
                      width: { xs: '100%', sm: 'auto' },
                      mt: { xs: 2, sm: 0 }
                    }}
                  >
                    Add Announcement
                  </Button>
                </Box>
                {annLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={48} />
                  </Box>
                ) : announcements.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <AnnouncementIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5, color: '#6b7280' }} />
                    <Typography variant="h6" sx={{ fontWeight: 500, mb: 1, color: '#374151' }}>
                      No announcements yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Create your first announcement to keep users informed
                    </Typography>
                    <Button 
                      variant="outlined" 
                      onClick={() => openAnnDialog()}
                      sx={{ 
                        borderRadius: 2,
                        fontWeight: 500
                      }}
                    >
                      Create First Announcement
                    </Button>
                  </Box>
                ) : (
                  <Paper elevation={0} sx={{ borderRadius: 2, boxShadow: 'none', background: 'white', width: '100%' }}>
                    <Table sx={{ width: '100%', fontSize: { xs: 12, sm: 15 } }}>
                      <TableHead>
                        <TableRow sx={{ background: '#f1f3f6' }}>
                          <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Title</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Description</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Date Posted</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Posted By</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: '#22223b', fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {announcements.map((a, index) => (
                          <TableRow 
                            key={a.id}
                            sx={{ background: index % 2 === 0 ? '#fff' : '#f7f9fb', transition: 'none' }}
                          >
                            <TableCell sx={{ color: '#22223b', fontWeight: 500, fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {a.title}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 300, fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: '#374151',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical'
                                }}
                              >
                                {a.description}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              <Chip 
                                label={a.status} 
                                size="small"
                                sx={{
                                  background: a.status === 'active' ? '#dcfce7' : '#f3f4f6',
                                  color: a.status === 'active' ? '#166534' : '#374151',
                                  fontWeight: 500,
                                  fontSize: '0.75rem'
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontWeight: 500, fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {a.date_posted ? new Date(a.date_posted).toLocaleDateString('en-PH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : ''}
                            </TableCell>
                            <TableCell sx={{ color: '#22223b', fontWeight: 500, fontSize: { xs: 13, sm: 15 }, px: { xs: 1, sm: 2 } }}>
                              {a.posted_by}
                            </TableCell>
                            <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                              <Button 
                                size="small" 
                                startIcon={<EditIcon />} 
                                onClick={() => openAnnDialog(a)}
                                sx={{ 
                                  fontWeight: 500,
                                  borderRadius: 2
                                }}
                              >
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                )}
              </Box>
            )}
          </>
        )}
      </Box>
      {/* Enhanced Add Bill Modal */}
      <Dialog 
        open={openDialog} 
        onClose={handleDialogClose} 
        maxWidth="lg" 
        fullWidth 
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2, bgcolor: '#fff', minHeight: isMobile ? '100vh' : 'auto', width: '100vw', m: 0 } }}
      >
        <DialogTitle 
          sx={{ 
            fontWeight: 600, 
            fontSize: { xs: 18, sm: 20 }, 
            pb: 1, 
            color: '#22223b',
            px: { xs: 2, sm: 3 }
          }}
        >
          {editId ? 'Edit Bill Details' : 'Add New Bill'}
        </DialogTitle>
        
        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Customer Details Card */}
          {selectedCustomer && (
            <Box sx={{ mb: 3, p: 3, background: '#f8fafc', borderRadius: 2, border: '1px solid #e5e7eb' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937', mb: 2 }}>
                Customer Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mb: 1 }}>
                    Customer Name
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, color: '#1f2937' }}>
                    {selectedCustomer.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mb: 1 }}>
                    Customer Type
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, color: '#1f2937' }}>
                    {selectedCustomer.type}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mb: 1 }}>
                    Barangay
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, color: '#1f2937' }}>
                    {selectedCustomer.barangay}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mb: 1 }}>
                    Customer ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, color: '#1f2937' }}>
                    {selectedCustomer.customerid}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Bill Form Card */}
          <Box sx={{ mb: 3, p: 3, background: 'white', borderRadius: 2, border: '1px solid #e5e7eb' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937', mb: 3 }}>
              Bill Information
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Billed Month"
                  name="billedmonth"
                  type="month"
                  value={form.billedmonth}
                  onChange={handleFormChange}
                  InputLabelProps={{ 
                    shrink: true,
                    sx: { fontWeight: 600, color: '#374151' }
                  }}
                  required
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Previous Reading"
                  name="previousreading"
                  type="number"
                  value={form.previousreading}
                  onChange={handleFormChange}
                  InputLabelProps={{ 
                    sx: { fontWeight: 600, color: '#374151' }
                  }}
                  required
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Current Reading"
                  name="currentreading"
                  type="number"
                  value={form.currentreading}
                  onChange={handleFormChange}
                  InputLabelProps={{ 
                    sx: { fontWeight: 600, color: '#374151' }
                  }}
                  required
                  fullWidth
                  inputRef={currentReadingRef}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Consumption"
                  name="consumption"
                  type="number"
                  value={form.consumption}
                  InputProps={{ 
                    readOnly: true,
                    sx: { 
                      background: '#f8fafc',
                      fontWeight: 600,
                      color: '#1f2937'
                    }
                  }}
                  InputLabelProps={{ 
                    sx: { fontWeight: 600, color: '#374151' }
                  }}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Basic Amount"
                  name="basicamount"
                  type="text"
                  value={formatAmount(form.basicamount)}
                  InputProps={{ 
                    readOnly: true,
                    sx: { 
                      background: '#f0fdf4',
                      fontWeight: 700,
                      color: '#166534',
                      fontSize: '1.1rem'
                    }
                  }}
                  InputLabelProps={{ 
                    sx: { fontWeight: 600, color: '#374151' }
                  }}
                  required
                  fullWidth
                />
              </Grid>
            </Grid>
            
            {showReadingWarning && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mt: 2, 
                  borderRadius: 2
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Warning: Current reading is less than previous reading!
                </Typography>
              </Alert>
            )}
          </Box>

          {/* Recent Bills Table for selected customer */}
          {selectedCustomer && (
            <Box sx={{ borderRadius: 2, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <Box sx={{ p: 2, background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
                  Recent Bills for {selectedCustomer.name}
                </Typography>
              </Box>
              
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ background: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Billed Month</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Prev Reading</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Curr Reading</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Consumption</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Basic Amount</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#374151' }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#374151' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedSelectedCustomerBills.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                            <ReceiptIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              No bills found for this customer.
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedSelectedCustomerBills.map(bill => (
                        <TableRow 
                          key={bill.billid}
                          hover
                          sx={{ 
                            '&:hover': { 
                              background: '#f8fafc',
                              transition: 'background 0.2s'
                            } 
                          }}
                        >
                          <TableCell sx={{ fontWeight: 500 }}>
                            {bill.billedmonth ? bill.billedmonth.slice(0, 7) : ''}
                          </TableCell>
                          <TableCell>{formatCubic(bill.previousreading)}</TableCell>
                          <TableCell>{formatCubic(bill.currentreading)}</TableCell>
                          <TableCell>{formatCubic(bill.consumption)}</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: '#166534' }}>
                            {formatAmount(bill.basicamount)}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={bill.paymentstatus} 
                              size="small"
                              sx={{
                                background: bill.paymentstatus === 'Paid' ? '#dcfce7' : 
                                          bill.paymentstatus === 'Unpaid' ? '#fef2f2' :
                                          bill.paymentstatus === 'Partial' ? '#fef3c7' : '#f3f4f6',
                                color: bill.paymentstatus === 'Paid' ? '#166534' :
                                       bill.paymentstatus === 'Unpaid' ? '#dc2626' :
                                       bill.paymentstatus === 'Partial' ? '#92400e' : '#374151',
                                fontWeight: 500,
                                fontSize: '0.75rem'
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton 
                              color="primary" 
                              onClick={() => handleDialogOpen(selectedCustomer, bill)}
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={selectedCustomerBills.length}
                  page={modalBillsPage}
                  onPageChange={(e, newPage) => setModalBillsPage(newPage)}
                  rowsPerPage={modalBillsRowsPerPage}
                  onRowsPerPageChange={e => {
                    setModalBillsRowsPerPage(parseInt(e.target.value, 10));
                    setModalBillsPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 15, 25]}
                  sx={{
                    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                      fontWeight: 500,
                      color: '#374151'
                    }
                  }}
                />
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        
        {/* Dialog Actions */}
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
          <Button 
            onClick={() => { setSelectedCustomer(null); handleDialogClose(); }} 
            variant="outlined" 
            sx={{ 
              borderRadius: 2,
              minWidth: 100,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddOrEdit} 
            variant="contained" 
            sx={{ 
              borderRadius: 2,
              minWidth: 120,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            {editId ? 'Update Bill' : 'Add Bill'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2, bgcolor: '#fff' } }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: { xs: 16, sm: 18 } }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: { xs: 14, sm: 15 } }}>Are you sure you want to delete this bill?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
          <Button onClick={handleDeleteCancel} sx={{ minHeight: 44, fontSize: { xs: 14, sm: 15 }, width: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" sx={{ minHeight: 44, fontSize: { xs: 14, sm: 15 }, width: { xs: '100%', sm: 'auto' } }}>Delete</Button>
        </DialogActions>
      </Dialog>
      {/* Add/Edit Announcement Dialog */}
      <Dialog
        open={annDialogOpen}
        onClose={() => setAnnDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2, bgcolor: '#fff', width: '100vw', m: 0 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: { xs: 18, sm: 20 }, px: { xs: 2, sm: 3 } }}>
          {annEditId ? 'Edit Announcement' : 'Add Announcement'}
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <TextField
              label="Title"
              value={annForm.title}
              onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))}
              fullWidth
              required
              inputProps={{ style: { fontSize: 15 } }}
            />
            <TextField
              label="Description"
              value={annForm.description}
              onChange={e => setAnnForm(f => ({ ...f, description: e.target.value }))}
              fullWidth
              multiline
              minRows={3}
              required
              inputProps={{ style: { fontSize: 15 } }}
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
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
          <Button onClick={() => setAnnDialogOpen(false)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 500, width: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddAnnouncement}
            disabled={annSubmitting}
            sx={{ borderRadius: 2, fontWeight: 500, width: { xs: '100%', sm: 'auto' } }}
          >
            {annEditId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Billing; 