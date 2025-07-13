import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Stack, Card, CardHeader, CardContent, Chip, Avatar, Container } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import PageHeader from './PageHeader';
import { supabase } from './supabaseClient';
import DownloadIcon from '@mui/icons-material/Download';
import BarChartIcon from '@mui/icons-material/BarChart';
import GroupIcon from '@mui/icons-material/Group';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DiscountIcon from '@mui/icons-material/Percent';
import AnimatedBackground from './AnimatedBackground';
import useMediaQuery from '@mui/material/useMediaQuery';

const periodOptions = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annually', value: 'annually' },
  { label: 'Custom', value: 'custom' },
];

function getPeriodRange(period, customStart, customEnd) {
  const now = new Date();
  let start, end;
  if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === 'quarterly') {
    const quarter = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), quarter * 3, 1);
    end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
  } else if (period === 'annually') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  } else if (period === 'custom') {
    start = customStart;
    end = customEnd;
  }
  return { start, end };
}

const paymentStatusOptions = [
  { label: 'Paid', value: 'Paid' },
  { label: 'Unpaid', value: 'Unpaid' },
];

const Reports = () => {
  const [period, setPeriod] = useState('monthly');
  const [customStart, setCustomStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ revenue: 0, consumption: 0, count: 0 });
  const [bills, setBills] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [customerTypeCounts, setCustomerTypeCounts] = useState([]);
  const [barangayCounts, setBarangayCounts] = useState([]);
  const [discountedCustomers, setDiscountedCustomers] = useState([]);
  const isMobile = useMediaQuery('(max-width:600px)');

  const fetchReport = async () => {
    setLoading(true);
    const { start, end } = getPeriodRange(period, customStart, customEnd);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    let query = supabase
      .from('bills')
      .select('*')
      .gte('dateencoded', startStr)
      .lte('dateencoded', endStr);
    if (paymentStatus) query = query.eq('paymentstatus', paymentStatus);
    const { data, error } = await query;
    if (!error && data) {
      setBills(data);
      setSummary({
        revenue: data.reduce((sum, b) => sum + (Number(b.totalbillamount) || 0), 0),
        consumption: data.reduce((sum, b) => sum + (Number(b.consumption) || 0), 0),
        count: data.length,
        basic: data.reduce((sum, b) => sum + (Number(b.basicamount) || 0), 0),
        surcharge: data.reduce((sum, b) => sum + (Number(b.surchargeamount) || 0), 0),
        discount: data.reduce((sum, b) => sum + (Number(b.discountamount) || 0), 0),
        advance: data.reduce((sum, b) => sum + (Number(b.advancepaymentamount) || 0), 0),
      });
    } else {
      setBills([]);
      setSummary({ revenue: 0, consumption: 0, count: 0, basic: 0, surcharge: 0, discount: 0, advance: 0 });
    }
    setLoading(false);
  };

  const fetchCustomerReports = async () => {
    const { data: customers, error } = await supabase.from('customers').select('*');
    if (!error && customers) {
      // By type
      const typeMap = {};
      customers.forEach(c => {
        if (c.type) typeMap[c.type] = (typeMap[c.type] || 0) + 1;
      });
      setCustomerTypeCounts(Object.entries(typeMap));
      // By barangay
      const barangayMap = {};
      customers.forEach(c => {
        if (c.barangay) barangayMap[c.barangay] = (barangayMap[c.barangay] || 0) + 1;
      });
      setBarangayCounts(Object.entries(barangayMap));
      // With active discount
      setDiscountedCustomers(customers.filter(c => Number(c.discount) > 0));
    } else {
      setCustomerTypeCounts([]);
      setBarangayCounts([]);
      setDiscountedCustomers([]);
    }
  };

  useEffect(() => {
    fetchReport();
    fetchCustomerReports();
    // eslint-disable-next-line
  }, [period, customStart, customEnd, paymentStatus]);

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 0, sm: 3 }, bgcolor: '#f7f9fb', width: '100%', overflow: 'hidden' }}>
      {/* Simple Title Header */}
      <Box sx={{ py: { xs: 1, sm: 4 }, px: { xs: 1, sm: 2 }, width: '100%' }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#22223b', mb: 0.5, fontSize: { xs: 20, sm: 24 } }}>
            Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and export billing and customer statistics
          </Typography>
        </Box>
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 3, width: '100%', boxShadow: 'none', background: '#fff' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" mb={2} sx={{ width: '100%' }}>
            <Tabs
              value={period}
              onChange={(_, v) => setPeriod(v)}
              textColor="primary"
              indicatorColor="primary"
              sx={{ minHeight: 44, width: '100%', maxWidth: { xs: '100%', sm: 400 } }}
            >
              {periodOptions.map(opt => (
                <Tab key={opt.value} label={opt.label} value={opt.value} sx={{ minHeight: 44, fontSize: { xs: 13, sm: 15 } }} />
              ))}
            </Tabs>
            {period === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={customStart}
                  onChange={setCustomStart}
                  renderInput={(params) => <TextField {...params} size="small" sx={{ minWidth: 140 }} />}
                />
                <DatePicker
                  label="End Date"
                  value={customEnd}
                  onChange={setCustomEnd}
                  renderInput={(params) => <TextField {...params} size="small" sx={{ minWidth: 140 }} />}
                />
              </LocalizationProvider>
            )}
            <TextField
              select
              label="Payment Status"
              value={paymentStatus}
              onChange={e => setPaymentStatus(e.target.value)}
              size="small"
              sx={{ minWidth: 140 }}
            >
              {paymentStatusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </TextField>
            <Button variant="contained" onClick={fetchReport} disabled={loading} sx={{ borderRadius: 2, fontWeight: 500, minWidth: 100 }}>Refresh</Button>
          </Stack>
          <Grid container spacing={2} sx={{ mb: 2, width: '100%' }}>
            <Grid item xs={12} sm={4} md={2}>
              <Paper sx={{ p: 2, borderRadius: 2, background: '#f1f3f6', textAlign: 'center', boxShadow: 'none' }}>
                <Typography variant="subtitle2" color="primary">Total Revenue</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  ₱{summary.revenue.toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Paper sx={{ p: 2, borderRadius: 2, background: '#f1f3f6', textAlign: 'center', boxShadow: 'none' }}>
                <Typography variant="subtitle2" color="primary">Total Basic</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  ₱{summary.basic?.toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Paper sx={{ p: 2, borderRadius: 2, background: '#f1f3f6', textAlign: 'center', boxShadow: 'none' }}>
                <Typography variant="subtitle2" color="primary">Total Surcharge</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  ₱{summary.surcharge?.toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Paper sx={{ p: 2, borderRadius: 2, background: '#f1f3f6', textAlign: 'center', boxShadow: 'none' }}>
                <Typography variant="subtitle2" color="primary">Total Discount</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  ₱{summary.discount?.toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Paper sx={{ p: 2, borderRadius: 2, background: '#f1f3f6', textAlign: 'center', boxShadow: 'none' }}>
                <Typography variant="subtitle2" color="primary">Total Advance</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  ₱{summary.advance?.toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Paper sx={{ p: 2, borderRadius: 2, background: '#f1f3f6', textAlign: 'center', boxShadow: 'none' }}>
                <Typography variant="subtitle2" color="primary">Total Cubics Used</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {summary.consumption.toLocaleString()} m³
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
        {/* Customers Reports Section */}
        <Paper sx={{ p: 3, borderRadius: 2, mb: 3, background: '#fff', boxShadow: 'none' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#22223b', letterSpacing: 0.5 }}>
            Customer Reports
          </Typography>
          <Grid container spacing={3}>
            {/* Customers by Type */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ borderRadius: 2, boxShadow: 'none', minHeight: 180, display: 'flex', flexDirection: 'column', p: 2, background: '#f1f3f6' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#22223b', mb: 1 }}>Customers by Type</Typography>
                {customerTypeCounts.length === 0 ? (
                  <Typography color="text.secondary">No data</Typography>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', py: 1 }}>
                    {customerTypeCounts.map(([type, count]) => (
                      <Chip key={type} label={`${type}: ${count.toLocaleString()}`} color="primary" variant="outlined" sx={{ fontWeight: 500, fontSize: 15, px: 2 }} />
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
            {/* Customers by Barangay */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ borderRadius: 2, boxShadow: 'none', minHeight: 180, display: 'flex', flexDirection: 'column', p: 2, background: '#f1f3f6' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#22223b', mb: 1 }}>Customers by Barangay</Typography>
                {barangayCounts.length === 0 ? (
                  <Typography color="text.secondary">No data</Typography>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', py: 1 }}>
                    {barangayCounts.map(([barangay, count]) => (
                      <Chip key={barangay} label={`${barangay}: ${count.toLocaleString()}`} color="secondary" variant="outlined" sx={{ fontWeight: 500, fontSize: 15, px: 2 }} />
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
            {/* Customers with Active Discount */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ borderRadius: 2, boxShadow: 'none', minHeight: 180, display: 'flex', flexDirection: 'column', p: 2, background: '#f1f3f6' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#22223b', mb: 1 }}>Customers with Active Discount</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#f59e0b' }}>
                  {discountedCustomers.length.toLocaleString()}
                </Typography>
                {discountedCustomers.length > 0 && (
                  <Box sx={{ maxHeight: 100, overflowY: 'auto', pr: 1 }}>
                    {discountedCustomers.slice(0, 10).map(c => (
                      <Typography key={c.customerid} variant="body2" sx={{ fontSize: 15, mb: 0.5, color: 'text.secondary' }}>
                        {c.name} <span style={{ color: '#64748b' }}>({c.barangay})</span> - <b>{c.discount}%</b>
                      </Typography>
                    ))}
                    {discountedCustomers.length > 10 && <Typography variant="body2" sx={{ color: 'text.secondary' }}>...and {discountedCustomers.length - 10} more</Typography>}
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Box>
  );
};

// Export to CSV helper
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

export default Reports; 