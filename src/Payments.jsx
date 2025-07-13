import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Checkbox, Stack, Avatar, TablePagination, CircularProgress, Grid, Tabs, Tab, Skeleton, Container, useMediaQuery, Chip, GlobalStyles
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { SentimentDissatisfied as EmptyIcon, Receipt as ReceiptIcon, Payment as PaymentIcon } from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/Download';
import PageHeader from './PageHeader';
import { useGlobalSnackbar } from './GlobalSnackbar';
import AnimatedBackground from './AnimatedBackground';
import WaterDropIcon from '@mui/icons-material/WaterDrop';

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

const Payments = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBills, setSelectedBills] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [paying, setPaying] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [paidBills, setPaidBills] = useState([]);
  const [paidPage, setPaidPage] = useState(0);
  const [paidRowsPerPage, setPaidRowsPerPage] = useState(15);
  const [user, setUser] = useState({ name: '', role: '' });

  // Add state for payment amount and credit
  const [paymentAmount, setPaymentAmount] = useState('');
  const [creditApplied, setCreditApplied] = useState(0);
  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const showSnackbar = useGlobalSnackbar();
  const isMobile = useMediaQuery('(max-width:600px)');

  // Responsive column visibility helper
  const isXs = useMediaQuery('(max-width:600px)');

  // Fetch customers matching search
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
    const fetchCustomers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .ilike('name', `%${searchTerm}%`);
      setSearchResults(error ? [] : data || []);
      setLoading(false);
    };
    const delayDebounce = setTimeout(fetchCustomers, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  // Fetch bills for selected customer
  useEffect(() => {
    if (!selectedCustomer) {
      setBills([]);
      setSelectedBills([]);
      return;
    }
    const fetchBills = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('customerid', selectedCustomer.customerid)
        .order('billedmonth', { ascending: false });
      setBills(error ? [] : data || []);
      setSelectedBills([]);
      setLoading(false);
    };
    fetchBills();
  }, [selectedCustomer]);

  // Fetch paid bills when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      (async () => {
        const { data, error } = await supabase
          .from('bills')
          .select('*')
          .eq('customerid', selectedCustomer.customerid)
          .eq('paymentstatus', 'Paid')
          .order('dateencoded', { ascending: false });
        if (!error) setPaidBills(data || []);
      })();
    } else {
      setPaidBills([]);
    }
  }, [selectedCustomer]);

  // When customer is selected, refetch their info to get latest credit_balance
  useEffect(() => {
    if (!selectedCustomer) return;
    const fetchCustomer = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('customerid', selectedCustomer.customerid)
        .single();
      if (!error && data) {
        setSelectedCustomer(data);
      }
    };
    fetchCustomer();
  }, [selectedCustomer?.customerid]);

  // Fetch current user's full name on mount
  useEffect(() => {
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
  }, []);

  // Helper: Calculate total due for selected bills
  const getTotalDue = () => {
    const selected = bills.filter(b => selectedBills.includes(b.billid));
    return selected.reduce((sum, b) => sum + (Number(b.totalbillamount) || Number(b.basicamount) || 0), 0);
  };

  // Helper: Calculate how much credit will be applied
  useEffect(() => {
    if (!selectedCustomer || !selectedBills.length) {
      setCreditApplied(0);
      return;
    }
    const totalDue = getTotalDue();
    const credit = Number(selectedCustomer.credit_balance) || 0;
    setCreditApplied(Math.min(totalDue, credit));
  }, [selectedCustomer, selectedBills]);

  // Helper: Calculate total billed for selected bills (now includes surcharge)
  const getTotalBilled = () => {
    if (!selectedCustomer || !selectedBills.length) return 0;
    const discountRate = Number(selectedCustomer.discount) || 0;
    if (selectedBills.length === 1) {
      const bill = bills.find(b => b.billid === selectedBills[0]);
      if (!bill) return 0;
      const surcharge = calculateSurcharge(bill.billedmonth, bill.basicamount);
      const discountAmount = ((Number(bill.basicamount) || 0) * discountRate) / 100;
      const totalBeforeCredit = (Number(bill.totalbillamount) || Number(bill.basicamount) || 0) + surcharge - discountAmount;
      const credit = Number(selectedCustomer.credit_balance) || 0;
      return Math.max(totalBeforeCredit - credit, 0);
    } else {
      const selected = bills.filter(b => selectedBills.includes(b.billid));
      const totalSurcharge = selected.reduce((sum, b) => sum + (Number(calculateSurcharge(b.billedmonth, b.basicamount)) || 0), 0);
      const totalDiscount = selected.reduce((sum, b) => sum + (((Number(b.basicamount) || 0) * discountRate) / 100), 0);
      const totalAmountBeforeCredit = selected.reduce((sum, b) => sum + (Number(b.totalbillamount) || Number(b.basicamount) || 0), 0) + totalSurcharge - totalDiscount;
      const credit = Number(selectedCustomer.credit_balance) || 0;
      return Math.max(totalAmountBeforeCredit - credit, 0);
    }
  };

  // Set paymentAmount to total billed by default, and update if total billed changes
  React.useEffect(() => {
    const totalBilled = getTotalBilled();
    // Only update if paymentAmount is empty or matches previous total billed
    if (
      paymentAmount === '' ||
      Number(paymentAmount) === prevTotalBilledRef.current
    ) {
      setPaymentAmount(totalBilled ? totalBilled.toString() : '');
      }
    prevTotalBilledRef.current = totalBilled;
    // eslint-disable-next-line
  }, [selectedBills, bills, selectedCustomer]);

  // Track previous total billed for comparison
  const prevTotalBilledRef = React.useRef(0);

  // Unpaid bills for table
  const unpaidBills = bills.filter(b => b.paymentstatus !== 'Paid');
  const paginatedBills = unpaidBills.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Checkbox logic
  const isAllSelected = paginatedBills.length > 0 && paginatedBills.every(b => selectedBills.includes(b.billid));
  const isIndeterminate = selectedBills.length > 0 && !isAllSelected;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedBills(paginatedBills.map(b => b.billid));
    } else {
      setSelectedBills([]);
    }
  };

  const handleSelectBill = (billid) => {
    setSelectedBills(prev =>
      prev.includes(billid) ? prev.filter(id => id !== billid) : [...prev, billid]
    );
  };

  // Update handleMarkAsPaid to handle overpayment/credit
  const handleMarkAsPaid = async () => {
    setPaying(true);
    try {
      const now = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
      let totalBilled = 0;
      let overpayment = 0;
      let selected = bills.filter(b => selectedBills.includes(b.billid));
      selected = selected.sort((a, b) => new Date(a.billedmonth) - new Date(b.billedmonth));
      const discountRate = Number(selectedCustomer.discount) || 0;
      if (selected.length === 1) {
        const bill = selected[0];
        const surcharge = calculateSurcharge(bill.billedmonth, bill.basicamount);
        const discountAmount = ((Number(bill.basicamount) || 0) * discountRate) / 100;
        const totalBeforeCredit = (Number(bill.totalbillamount) || Number(bill.basicamount) || 0) + surcharge - discountAmount;
        const credit = Number(selectedCustomer.credit_balance) || 0;
        totalBilled = Math.max(totalBeforeCredit - credit, 0);
      } else {
        const totalSurcharge = selected.reduce((sum, b) => sum + (Number(calculateSurcharge(b.billedmonth, b.basicamount)) || 0), 0);
        const totalDiscount = selected.reduce((sum, b) => sum + (((Number(b.basicamount) || 0) * discountRate) / 100), 0);
        const totalAmountBeforeCredit = selected.reduce((sum, b) => sum + (Number(b.totalbillamount) || Number(b.basicamount) || 0), 0) + totalSurcharge - totalDiscount;
        const credit = Number(selectedCustomer.credit_balance) || 0;
        totalBilled = Math.max(totalAmountBeforeCredit - credit, 0);
      }
      const payment = Number(paymentAmount);
      overpayment = payment - totalBilled;
      for (let i = 0; i < selected.length; i++) {
        const bill = selected[i];
        const surcharge = calculateSurcharge(bill.billedmonth, bill.basicamount);
        const billDiscount = Number((((Number(bill.basicamount) || 0) * discountRate) / 100).toFixed(2));
        const billTotal = (Number(bill.totalbillamount) || Number(bill.basicamount) || 0) + surcharge - billDiscount;
        let advancePayment = null;
        if (i === selected.length - 1 && overpayment > 0) {
          advancePayment = overpayment;
        } else {
          advancePayment = null;
        }
        const updatePayload = {
          ...bill,
          paymentstatus: 'Paid',
          datepaid: now,
          paidby: user.name,
          basicamount: bill.basicamount,
          surchargeamount: surcharge,
          discountamount: billDiscount,
          totalbillamount: billTotal,
          advancepaymentamount: advancePayment,
        };
        Object.keys(updatePayload).forEach(key => {
          if (updatePayload[key] === undefined) updatePayload[key] = null;
        });
        const { error: billError } = await supabase
          .from('bills')
          .update(updatePayload)
          .eq('billid', bill.billid);
        if (billError) {
          showSnackbar('Failed to update bill #' + bill.billid + ': ' + billError.message, 'error');
          setPaying(false);
          return;
        }
      }
      // 2. Update customer credit_balance
      const { error: creditError } = await supabase
        .from('customers')
        .update({ credit_balance: overpayment })
        .eq('customerid', selectedCustomer.customerid);
      if (creditError) {
        showSnackbar('Payment succeeded, but failed to update credit balance: ' + creditError.message, 'warning');
      } else {
        showSnackbar('Payment successful! Thank you for your payment.', 'success');
      }
      // Refresh bills and customer info
      // 1. Refresh unpaid bills
      const { data: billsData } = await supabase
        .from('bills')
        .select('*')
        .eq('customerid', selectedCustomer.customerid)
        .order('billedmonth', { ascending: false });
      setBills(billsData || []);
      setSelectedBills([]);
      setPaymentAmount('');
      setCreditApplied(0);
      // 2. Refetch customer info
      const { data: cust } = await supabase
        .from('customers')
        .select('*')
        .eq('customerid', selectedCustomer.customerid)
        .single();
      if (cust) setSelectedCustomer(cust);
    } catch (err) {
      showSnackbar('Payment failed: ' + (err.message || err), 'error');
    } finally {
      setPaying(false);
    }
  };

  // Helper to format amounts
  const formatAmount = (value) => value !== null && value !== undefined && value !== '' ? `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

  // Surcharge calculation function (same as Billing.jsx)
  function calculateSurcharge(billedMonth, basicAmount) {
    if (!billedMonth || !basicAmount || isNaN(Number(basicAmount))) return 0;
    let [year, month] = billedMonth.slice(0, 7).split('-').map(Number);
    let dueMonth = month + 1;
    let dueYear = year;
    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear += 1;
    }
    const dueDate = new Date(`${dueYear}-${dueMonth.toString().padStart(2, '0')}-20T00:00:00`);
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

  return (
    <>
      <GlobalStyles styles={{
        html: { width: '100vw', maxWidth: '100vw', overflowX: 'hidden', margin: 0, padding: 0 },
        body: { width: '100vw', maxWidth: '100vw', overflowX: 'hidden', margin: 0, padding: 0 },
        '#root': { width: '100vw', maxWidth: '100vw', overflowX: 'hidden', margin: 0, padding: 0 },
      }} />
      <Box sx={{ minHeight: '100vh', bgcolor: '#f7f7f7', width: '100vw', maxWidth: '100vw', overflowX: 'hidden', p: 0, m: 0 }}>
        <Box sx={{ maxWidth: 1200, width: '100%', mx: 'auto', overflowX: 'hidden', p: 0, m: 0, px: { xs: 1, sm: 2 } }}>
          {/* Header */}
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, pt: 4, pb: 2, justifyContent: 'flex-start' }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48, boxShadow: 2 }}>
              <WaterDropIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700} sx={{ color: 'primary.main', letterSpacing: 1, mb: 0.5 }}>Payments</Typography>
              <Typography variant="subtitle1" sx={{ color: '#666', fontWeight: 400 }}>Manage and process customer payments</Typography>
          </Box>
          </Box>
          {/* Always visible search box at top left of Payments page */}
          <Box sx={{ width: { xs: '100%', sm: 340 }, maxWidth: 400, mb: 2 }}>
            <Paper sx={{
              p: 1.5,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              boxShadow: 3,
              bgcolor: '#fff',
              width: '100%',
              m: 0
            }}>
              <SearchIcon sx={{ color: 'primary.main', mr: 1 }} />
              <TextField
                label="Search customer name"
                variant="standard"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                size="small"
                fullWidth
                placeholder="Type to search..."
                InputProps={{ disableUnderline: true, sx: { fontSize: 18, pl: 1, bgcolor: 'transparent' } }}
                sx={{ background: 'transparent', fontSize: 18 }}
              />
            </Paper>
          </Box>

          {/* Enhanced Customer Search Results (if searching, but not yet selected) */}
          {!selectedCustomer && searchResults.length > 0 && (
            <Box sx={{ width: '100%', maxWidth: 500, mx: 'auto', mt: 6 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, mt: 3 }}>
                        {searchResults.map(c => (
                  <Paper
                            key={c.customerid}
                    elevation={selectedCustomer?.customerid === c.customerid ? 6 : 2}
                    sx={{
                      cursor: 'pointer',
                      p: 2,
                      borderRadius: 3,
                      minWidth: 220,
                      maxWidth: 320,
                      boxShadow: selectedCustomer?.customerid === c.customerid ? 6 : 2,
                      border: selectedCustomer?.customerid === c.customerid ? '2px solid #1976d2' : '1px solid #e0e0e0',
                      transition: 'box-shadow 0.2s, border 0.2s',
                      '&:hover': {
                        boxShadow: 6,
                        border: '2px solid #1976d2',
                        background: '#f0f8ff',
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                    }}
                            onClick={() => setSelectedCustomer(c)}
                          >
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                      <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 700 }}>
                        {c.name?.[0] || '?'}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 17, color: '#222' }}>{c.name}</Typography>
                        <Typography variant="caption" color="text.secondary">ID: {c.customerid}</Typography>
                          </Box>
                      </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mb: 0.5 }}>
                      <Chip label={c.type} size="small" sx={{ fontWeight: 600, bgcolor: '#e0e0e0', color: '#333' }} />
                      <Chip label={c.barangay} size="small" sx={{ fontWeight: 600, bgcolor: '#e0e0e0', color: '#333' }} />
                    </Stack>
                    <Typography variant="body2" sx={{ color: '#888', mt: 0.5 }}>Credit: ₱{Number(c.credit_balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Typography>
                    </Paper>
                ))}
                        </Box>
                            </Box>
          )}

          {/* 2. After selecting customer: Customer Info + Bills Table/Payment History full width */}
          {selectedCustomer && (
            <Box sx={{ width: '100%', maxWidth: 1000, mx: 'auto', mb: 3 }}>
              <Paper sx={{
                mb: 2,
                p: 3,
                borderRadius: 4,
                boxShadow: 4,
                bgcolor: '#f4faff',
                width: '100%',
                maxWidth: '100%',
                mx: 'auto',
                border: '1.5px solid #e3eafc',
                transition: 'box-shadow 0.2s',
              }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                  <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 700 }}>
                    {selectedCustomer.name?.[0] || '?'}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 17, color: '#222' }}>{selectedCustomer.name}</Typography>
                    <Typography variant="caption" color="text.secondary">ID: {selectedCustomer.customerid}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedCustomer.address}</Typography>
                    <Typography variant="body2" color="text.secondary">Contact: {selectedCustomer.contactnumber || selectedCustomer.contact || '-'}</Typography>
                  </Box>
                  <Chip label={selectedCustomer.type} size="small" sx={{ fontWeight: 600, bgcolor: '#e0e0e0', color: '#333' }} />
                  <Chip label={selectedCustomer.barangay} size="small" sx={{ fontWeight: 600, bgcolor: '#e0e0e0', color: '#333' }} />
                  <Chip label={`Discount: ${Number(selectedCustomer.discount || 0)}%`} size="small" sx={{ fontWeight: 600, bgcolor: '#e3fbe3', color: 'green', ml: 1 }} />
                  <Typography variant="body2" sx={{ color: '#888', ml: 1 }}>
                    Credit Balance: ₱{Number(selectedCustomer.credit_balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ ml: 2, height: 32, alignSelf: 'flex-start' }}
                    onClick={() => { setSelectedCustomer(null); setSelectedBills([]); }}
                  >
                    Change Customer
                  </Button>
                </Stack>
              </Paper>
            </Box>
          )}

          {/* After the unified customer info container, always render the tabs and tables when selectedCustomer is set: */}
          {selectedCustomer && (
            <Box sx={{ width: '100%', maxWidth: 1000, mx: 'auto' }}>
              <Tabs
                value={tabIndex}
                onChange={(e, v) => setTabIndex(v)}
                sx={{ minHeight: { xs: 36, sm: 48 }, background: '#f4faff', borderRadius: 3, boxShadow: 1, px: 1 }}
                variant={isXs ? 'fullWidth' : 'standard'}
              >
                <Tab label="Unpaid Bills" sx={{ fontSize: { xs: 13, sm: 15 }, fontWeight: 600, textTransform: 'none' }} />
                <Tab label="Payment History" sx={{ fontSize: { xs: 13, sm: 15 }, fontWeight: 600, textTransform: 'none' }} />
              </Tabs>
              {tabIndex === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 120, width: '100%', overflowX: 'hidden' }}>
                  {/* For Unpaid Bills Table */}
                  <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: 3, bgcolor: '#fff', width: '100%', maxWidth: 1000, mx: 'auto', border: '1.5px solid #e3eafc', overflowX: { xs: 'auto', sm: 'visible' }, mb: 2 }}>
                    <Table
                      stickyHeader
                      sx={{
                        width: '100%',
                        tableLayout: 'auto',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        fontSize: { xs: 12, sm: 14 },
                        minWidth: 0,
                        maxWidth: '100%',
                        '& tbody tr': {
                          transition: 'background 0.2s',
                        },
                        '& tbody tr:nth-of-type(odd)': {
                          background: '#f8fafc',
                        },
                        '& tbody tr:hover': {
                          background: '#e3eafc',
                        },
                      }}
                    >
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#e3eafc' }}>
                          <TableCell padding="checkbox" />
                          <TableCell sx={{ maxWidth: 80, whiteSpace: 'normal', wordBreak: 'break-word' }}>Bill ID</TableCell>
                          <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>Billed Month</TableCell>
                          {!isXs && <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>Previous Reading</TableCell>}
                          {!isXs && <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>Current Reading</TableCell>}
                          {!isXs && <TableCell sx={{ maxWidth: 90, whiteSpace: 'normal', wordBreak: 'break-word' }}>Consumption</TableCell>}
                          <TableCell sx={{ maxWidth: 110, whiteSpace: 'normal', wordBreak: 'break-word' }}>Amount Due</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {loading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              {Array.from({ length: isXs ? 4 : 7 }).map((__, j) => (
                                <TableCell key={j}><Skeleton variant="text" width={60} /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : paginatedBills.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isXs ? 4 : 7} align="center" sx={{ py: 6 }}>
                              <Typography variant="body2" sx={{ color: '#888' }}>
                                No unpaid bills found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedBills.map((b, i) => (
                            <TableRow
                              key={b.billid}
                              sx={{ '&:last-child td': { borderBottom: 0 } }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedBills.includes(b.billid)}
                                  onChange={() => handleSelectBill(b.billid)}
                                />
                              </TableCell>
                              <TableCell sx={{ maxWidth: 80, whiteSpace: 'normal', wordBreak: 'break-word' }}>{b.billid}</TableCell>
                              <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>{b.billedmonth ? b.billedmonth.slice(0, 7) : ''}</TableCell>
                              {!isXs && <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>{b.previousreading}</TableCell>}
                              {!isXs && <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>{b.currentreading}</TableCell>}
                              {!isXs && <TableCell sx={{ maxWidth: 90, whiteSpace: 'normal', wordBreak: 'break-word' }}>{b.consumption}</TableCell>}
                              <TableCell sx={{ maxWidth: 110, whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 600, color: 'primary.main' }}>₱{Number(b.totalbillamount || b.basicamount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <TablePagination
                      component="div"
                      count={unpaidBills.length}
                      page={page}
                      onPageChange={(e, newPage) => setPage(newPage)}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={e => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                      }}
                      rowsPerPageOptions={[15, 25, 50]}
                      sx={{ '.MuiTablePagination-toolbar': { px: { xs: 1, sm: 2 } }, fontSize: { xs: 12, sm: 14 } }}
                    />
                  </TableContainer>
                  {/* Only show summary and payment if bills are selected */}
                  {selectedBills.length > 0 && (
                    <>
                      {/* Bill Summary and Payment Amount section here */}
                      <Paper sx={{ mt: 2, bgcolor: '#f8fafc', borderRadius: 4, p: 3, boxShadow: 2, width: '100%', maxWidth: 1000, mx: 'auto', boxSizing: 'border-box', border: '1.5px solid #e3eafc', overflowX: 'auto' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'primary.main', fontSize: { xs: 15, sm: 17 } }}>Bill Summary</Typography>
                        {selectedBills.length === 0 ? (
                          <Box sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                            <Typography variant="body2" sx={{ fontSize: { xs: 12, sm: 14 } }}>Select a bill to see its summary.</Typography>
                          </Box>
                        ) : selectedBills.length === 1 ? (() => {
                          const bill = bills.find(b => b.billid === selectedBills[0]);
                          if (!bill) return null;
                          const discountRate = Number(selectedCustomer.discount) || 0;
                          const surcharge = calculateSurcharge(bill.billedmonth, bill.basicamount);
                          const discountAmount = ((Number(bill.basicamount) || 0) * discountRate) / 100;
                          const totalBeforeCredit = (Number(bill.totalbillamount) || Number(bill.basicamount) || 0) + surcharge - discountAmount;
                          const credit = Number(selectedCustomer.credit_balance) || 0;
                          return (
                            <Stack spacing={1} sx={{ fontSize: { xs: 12, sm: 14 } }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Basic Amount:</Typography>
                                <Typography variant="body2">{formatAmount(bill.basicamount)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Surcharge:</Typography>
                                <Typography variant="body2">{formatAmount(surcharge)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Discount ({discountRate}%):</Typography>
                                <Typography variant="body2" color="warning.main">-{formatAmount(discountAmount)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Credit Applied:</Typography>
                                <Typography variant="body2" color="success.main">-{formatAmount(credit)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Total Amount:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatAmount(totalBeforeCredit - credit)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>Total Billed:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>{formatAmount(totalBeforeCredit - credit)}</Typography>
                              </Box>
                            </Stack>
                          );
                        })() : (() => {
                          const selected = bills.filter(b => selectedBills.includes(b.billid));
                          const discountRate = Number(selectedCustomer.discount) || 0;
                          const totalBasic = selected.reduce((sum, b) => sum + (Number(b.basicamount) || 0), 0);
                          const totalSurcharge = selected.reduce((sum, b) => sum + (Number(calculateSurcharge(b.billedmonth, b.basicamount)) || 0), 0);
                          const totalDiscount = selected.reduce((sum, b) => sum + (((Number(b.basicamount) || 0) * discountRate) / 100), 0);
                          const totalAmountBeforeCredit = selected.reduce((sum, b) => sum + (Number(b.totalbillamount) || Number(b.basicamount) || 0), 0) + totalSurcharge - totalDiscount;
                          const credit = Number(selectedCustomer.credit_balance) || 0;
                          return (
                            <Stack spacing={1} sx={{ fontSize: { xs: 12, sm: 14 } }}>
                              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>{selectedBills.length} bills selected</Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Total Basic Amount:</Typography>
                                <Typography variant="body2">{formatAmount(totalBasic)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Total Surcharge:</Typography>
                                <Typography variant="body2">{formatAmount(totalSurcharge)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Total Discount ({discountRate}%):</Typography>
                                <Typography variant="body2" color="warning.main">-{formatAmount(totalDiscount)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Credit Applied:</Typography>
                                <Typography variant="body2" color="success.main">-{formatAmount(credit)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
                                <Typography variant="body2">Total Amount:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatAmount(totalAmountBeforeCredit - credit)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>Total Billed:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>{formatAmount(totalAmountBeforeCredit - credit)}</Typography>
                              </Box>
                            </Stack>
                          );
                        })()}
                      </Paper>
                      <Paper sx={{ mt: 2, p: 3, bgcolor: '#f4faff', borderRadius: 4, boxShadow: 2, width: '100%', maxWidth: 1000, mx: 'auto', border: '1.5px solid #e3eafc', overflowX: 'auto' }}>
                        <TextField
                          label="Payment Amount"
                          type="number"
                          value={paymentAmount}
                          onChange={e => setPaymentAmount(e.target.value)}
                          size="small"
                          sx={{ width: '100%', mb: 2, background: '#fff', borderRadius: 2 }}
                          inputProps={{ min: 0 }}
                        />
                        <TextField
                          label="Payment Date"
                          type="date"
                          value={paymentDate}
                          onChange={e => setPaymentDate(e.target.value)}
                          size="small"
                          sx={{ width: '100%', mb: 2, background: '#fff', borderRadius: 2 }}
                          InputLabelProps={{ shrink: true }}
                        />
                        {paymentAmount && Number(paymentAmount) > 0 && Number(paymentAmount) > Number((() => {
                          if (selectedBills.length === 1) {
                            const bill = bills.find(b => b.billid === selectedBills[0]);
                            if (bill) {
                              const discountRate = Number(selectedCustomer.discount) || 0;
                              const discountAmount = ((Number(bill.basicamount) || 0) * discountRate) / 100;
                              const surcharge = calculateSurcharge(bill.billedmonth, bill.basicamount);
                              const totalBeforeCredit = (Number(bill.totalbillamount) || Number(bill.basicamount) || 0) + surcharge - discountAmount;
                              const credit = Number(selectedCustomer.credit_balance) || 0;
                              return Math.max(totalBeforeCredit - credit, 0);
                            }
                          } else {
                            const selected = bills.filter(b => selectedBills.includes(b.billid));
                            const discountRate = Number(selectedCustomer.discount) || 0;
                            const totalDiscount = selected.reduce((sum, b) => sum + (((Number(b.basicamount) || 0) * discountRate) / 100), 0);
                            const totalSurcharge = selected.reduce((sum, b) => sum + (Number(calculateSurcharge(b.billedmonth, b.basicamount)) || 0), 0);
                            const totalAmountBeforeCredit = selected.reduce((sum, b) => sum + (Number(b.totalbillamount) || Number(b.basicamount) || 0), 0) + totalSurcharge - totalDiscount;
                            const credit = Number(selectedCustomer.credit_balance) || 0;
                            return Math.max(totalAmountBeforeCredit - credit, 0);
                          }
                          return 0;
                        })()) && (
                          <Typography variant="body2" color="success.main" sx={{ mt: 1, fontWeight: 500 }}>
                            Overpayment will be credited: {formatAmount(Number(paymentAmount) - Number((() => {
                              if (selectedBills.length === 1) {
                                const bill = bills.find(b => b.billid === selectedBills[0]);
                                if (bill) {
                                  const discountRate = Number(selectedCustomer.discount) || 0;
                                  const discountAmount = ((Number(bill.basicamount) || 0) * discountRate) / 100;
                                  const surcharge = calculateSurcharge(bill.billedmonth, bill.basicamount);
                                  const totalBeforeCredit = (Number(bill.totalbillamount) || Number(bill.basicamount) || 0) + surcharge - discountAmount;
                                  const credit = Number(selectedCustomer.credit_balance) || 0;
                                  return Math.max(totalBeforeCredit - credit, 0);
                                }
                              } else {
                                const selected = bills.filter(b => selectedBills.includes(b.billid));
                                const discountRate = Number(selectedCustomer.discount) || 0;
                                const totalDiscount = selected.reduce((sum, b) => sum + (((Number(b.basicamount) || 0) * discountRate) / 100), 0);
                                const totalSurcharge = selected.reduce((sum, b) => sum + (Number(calculateSurcharge(b.billedmonth, b.basicamount)) || 0), 0);
                                const totalAmountBeforeCredit = selected.reduce((sum, b) => sum + (Number(b.totalbillamount) || Number(b.basicamount) || 0), 0) + totalSurcharge - totalDiscount;
                                const credit = Number(selectedCustomer.credit_balance) || 0;
                                return Math.max(totalAmountBeforeCredit - credit, 0);
                              }
                              return 0;
                            })()))}
                          </Typography>
                        )}
                        <Button
                          variant="contained"
                          color="primary"
                          disabled={selectedBills.length === 0 || paying}
                          onClick={handleMarkAsPaid}
                          sx={{ minWidth: 180, fontWeight: 700, borderRadius: 3, mt: 2, width: '100%', boxShadow: 2, textTransform: 'none', letterSpacing: 0.5 }}
                        >
                          {paying ? <CircularProgress size={22} sx={{ color: 'white', mr: 1 }} /> : null}
                          {paying ? 'Processing...' : 'Mark as Paid'}
                        </Button>
                      </Paper>
                    </>
                  )}
                </Box>
              )}
              {tabIndex === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 120, width: '100%', overflowX: 'hidden' }}>
                  {/* For Payment History Table */}
                  <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: 3, bgcolor: '#fff', width: '100%', maxWidth: 1000, mx: 'auto', border: '1.5px solid #e3eafc', overflowX: { xs: 'auto', sm: 'visible' }, mb: 2 }}>
                    <Table
                      sx={{
                        width: '100%',
                        tableLayout: 'auto',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        fontSize: { xs: 12, sm: 14 },
                        minWidth: 0,
                        maxWidth: '100%',
                        '& tbody tr': {
                          transition: 'background 0.2s',
                        },
                        '& tbody tr:nth-of-type(odd)': {
                          background: '#f8fafc',
                        },
                        '& tbody tr:hover': {
                          background: '#e3eafc',
                        },
                      }}
                    >
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#e3eafc' }}>
                          <TableCell sx={{ maxWidth: 80, whiteSpace: 'normal', wordBreak: 'break-word' }}>Bill ID</TableCell>
                          <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>Billed Month</TableCell>
                          {!isXs && <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>Previous Reading</TableCell>}
                          {!isXs && <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>Current Reading</TableCell>}
                          {!isXs && <TableCell sx={{ maxWidth: 90, whiteSpace: 'normal', wordBreak: 'break-word' }}>Consumption</TableCell>}
                          <TableCell sx={{ maxWidth: 110, whiteSpace: 'normal', wordBreak: 'break-word' }}>Amount Paid</TableCell>
                          <TableCell sx={{ maxWidth: 110, whiteSpace: 'normal', wordBreak: 'break-word' }}>Date Paid</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paidBills.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isXs ? 5 : 7} align="center">
                              <Typography variant="body2" sx={{ color: '#888' }}>
                                No payment history found.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paidBills.slice(paidPage * paidRowsPerPage, paidPage * paidRowsPerPage + paidRowsPerPage).map((bill) => (
                            <TableRow key={bill.billid} sx={{ bgcolor: '#fff', '&:last-child td': { borderBottom: 0 } }}>
                              <TableCell sx={{ maxWidth: 80, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bill.billid}</TableCell>
                              <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bill.billedmonth ? bill.billedmonth.slice(0, 7) : ''}</TableCell>
                              {!isXs && <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bill.previousreading}</TableCell>}
                              {!isXs && <TableCell sx={{ maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bill.currentreading}</TableCell>}
                              {!isXs && <TableCell sx={{ maxWidth: 90, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bill.consumption}</TableCell>}
                              <TableCell sx={{ maxWidth: 110, whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 600, color: 'primary.main' }}>₱{Number(bill.totalbillamount || bill.basicamount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell sx={{ maxWidth: 110, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bill.datepaid ? new Date(bill.datepaid).toLocaleDateString() : ''}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <TablePagination
                      component="div"
                      count={paidBills.length}
                      page={paidPage}
                      onPageChange={(e, newPage) => setPaidPage(newPage)}
                      rowsPerPage={paidRowsPerPage}
                      onRowsPerPageChange={e => {
                        setPaidRowsPerPage(parseInt(e.target.value, 10));
                        setPaidPage(0);
                      }}
                      rowsPerPageOptions={[15, 25, 50]}
                      sx={{ '.MuiTablePagination-toolbar': { px: { xs: 1, sm: 2 } }, fontSize: { xs: 12, sm: 14 } }}
                    />
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
};

export default Payments; 