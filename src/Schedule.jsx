import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, CircularProgress, Stack, Fab, Tabs, Tab, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import PageHeader from './PageHeader';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import GroupIcon from '@mui/icons-material/Group';
import './Schedule.css';
import { format } from 'date-fns';
import { useGlobalSnackbar } from './GlobalSnackbar';

const BARANGAYS = ['San Pedro', 'Calabasahan', 'Sampong', 'Bakhawan', 'Dalajican'];

function getScheduleDates() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const dueDate = new Date(year, month, 20);
  const dates = [];
  let day = 19;
  while (dates.length < 3 && day > 0) {
    const d = new Date(year, month, day);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.unshift(d);
    }
    day--;
  }
  return dates;
}
function formatDateWithDay(dateStr) {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString()} (${d.toLocaleDateString(undefined, { weekday: 'long' })})`;
}

const Schedule = () => {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState(0);
  const [historyMonth, setHistoryMonth] = useState('all');
  const [historyYear, setHistoryYear] = useState('all');
  const now = new Date();
  const scheduleMonth = now.getMonth() + 1;
  const scheduleYear = now.getFullYear();
  const showSnackbar = useGlobalSnackbar();

  useEffect(() => {
    const fetchCollectors = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'Collector');
      setCollectors(error ? [] : data || []);
      setLoading(false);
    };
    const fetchCurrentSchedule = async () => {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .eq('month', scheduleMonth)
        .eq('year', scheduleYear);
      setSchedule(data || []);
    };
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      setHistory(data || []);
    };
    fetchCollectors();
    fetchCurrentSchedule();
    fetchHistory();
  }, []);

  const handleGenerateSchedule = async () => {
    // Prevent duplicate schedule for the month
    const { data: existing } = await supabase
      .from('schedules')
      .select('*')
      .eq('month', scheduleMonth)
      .eq('year', scheduleYear);
    if (existing && existing.length > 0) {
      showSnackbar('A schedule for this month already exists. You can only generate once per month.', 'warning');
      setGenerating(false);
      return;
    }
    setGenerating(true);
    const dates = getScheduleDates();
    if (collectors.length === 0) {
      setSchedule([]);
      setGenerating(false);
      return;
    }
    // Fetch all past assignments for fairness
    const { data: allAssignments } = await supabase
      .from('schedules')
      .select('*');
    // Build a map: barangay -> collectorId -> count
    const assignmentMap = {};
    BARANGAYS.forEach(b => {
      assignmentMap[b] = {};
      collectors.forEach(c => {
        assignmentMap[b][c.userid] = 0;
      });
    });
    (allAssignments || []).forEach(a => {
      if (assignmentMap[a.barangay] && assignmentMap[a.barangay][a.collector_id] !== undefined) {
        assignmentMap[a.barangay][a.collector_id]++;
      }
    });
    // Enhanced fair distribution logic with max 2 schedules per date
    const assignments = [];
    const dateAssignments = {};
    dates.forEach(date => { dateAssignments[format(date, 'yyyy-MM-dd')] = new Set(); });
    // Track how many assignments each collector has
    const collectorAssignmentCount = {};
    collectors.forEach(c => { collectorAssignmentCount[c.userid] = 0; });
    let barangayIndex = 0;
    // 1. For each date, assign up to 2 barangays to 2 different collectors
    for (let d = 0; d < dates.length && barangayIndex < BARANGAYS.length; d++) {
      const dateStr = format(dates[d], 'yyyy-MM-dd');
      let assignedCollectors = new Set();
      for (let slot = 0; slot < 2 && barangayIndex < BARANGAYS.length; slot++) {
        // Find eligible collectors (not already assigned on this date)
        let minCount = Math.min(...Object.values(collectorAssignmentCount));
        let eligibleCollectors = collectors.filter(c => !dateAssignments[dateStr].has(c.userid) && !assignedCollectors.has(c.userid) && collectorAssignmentCount[c.userid] === minCount);
        if (eligibleCollectors.length === 0) {
          eligibleCollectors = collectors.filter(c => !dateAssignments[dateStr].has(c.userid) && !assignedCollectors.has(c.userid));
        }
        if (eligibleCollectors.length === 0) break; // No eligible collector for this slot
        // Pick one eligible collector (random or first)
        const c = eligibleCollectors[0];
        const barangay = BARANGAYS[barangayIndex];
        assignments.push({
          date: dateStr,
          barangay,
          collector_id: c.userid,
          collector_name: `${c.firstname} ${c.lastname}`,
          month: scheduleMonth,
          year: scheduleYear
        });
        dateAssignments[dateStr].add(c.userid);
        assignedCollectors.add(c.userid);
        collectorAssignmentCount[c.userid]++;
        barangayIndex++;
      }
    }
    // 2. If there are remaining barangays, assign them to collectors with the least assignments, on dates with less than 2 assignments
    while (barangayIndex < BARANGAYS.length) {
      // Find dates with less than 2 assignments
      let availableDates = dates.filter(date => dateAssignments[format(date, 'yyyy-MM-dd')].size < 2);
      if (availableDates.length === 0) break;
      // Find collector(s) with the minimum assignments
      let minCount = Math.min(...Object.values(collectorAssignmentCount));
      let eligibleCollectors = collectors.filter(c => collectorAssignmentCount[c.userid] === minCount);
      let assigned = false;
      for (let date of availableDates) {
        const dateStr = format(date, 'yyyy-MM-dd');
        for (let c of eligibleCollectors) {
          if (!dateAssignments[dateStr].has(c.userid)) {
            const barangay = BARANGAYS[barangayIndex];
            assignments.push({
              date: dateStr,
              barangay,
              collector_id: c.userid,
              collector_name: `${c.firstname} ${c.lastname}`,
              month: scheduleMonth,
              year: scheduleYear
            });
            dateAssignments[dateStr].add(c.userid);
            collectorAssignmentCount[c.userid]++;
            barangayIndex++;
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
      if (!assigned) break; // Should not happen, but safety
    }
    // Save to Supabase
    for (const a of assignments) {
      await supabase.from('schedules').insert([a]);
    }
    setSchedule(assignments);
    setGenerating(false);
    // Refresh history
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    setHistory(data || []);
  };

  // Get unique months/years from history
  const monthOptions = Array.from(new Set(history.map(h => h.month))).sort((a, b) => a - b);
  const yearOptions = Array.from(new Set(history.map(h => h.year))).sort((a, b) => a - b);
  // Filtered history
  const filteredHistory = history.filter(h =>
    (historyMonth === 'all' || h.month === historyMonth) &&
    (historyYear === 'all' || h.year === historyYear)
  );

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 1, sm: 3 }, bgcolor: '#f7f7f7', width: '100%', overflow: 'hidden' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={600} sx={{ mb: 0.5, color: '#222' }}>Schedule</Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>Manage and view collector schedules</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
          <Button variant="contained" onClick={handleGenerateSchedule} sx={{ borderRadius: 2, minWidth: 120, width: { xs: '100%', sm: 'auto' }, fontWeight: 500 }} disabled={generating || loading}>Generate Schedule</Button>
        </Stack>
        <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2, boxShadow: 'none', mb: 2 }}>
          <TableContainer sx={{ maxHeight: { xs: 440, sm: 600 }, overflowX: 'auto' }}>
            <Table stickyHeader size="small" sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Barangay</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Collector</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center"><CircularProgress size={24} /></TableCell>
                  </TableRow>
                ) : schedule.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">No schedule found.</TableCell>
                  </TableRow>
                ) : (
                  schedule.map((row, idx) => (
                    <TableRow key={row.date + row.barangay} sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8f8f8', '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>{formatDateWithDay(row.date)}</TableCell>
                      <TableCell>{row.barangay}</TableCell>
                      <TableCell>{row.collector_name}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 1, color: '#222' }}>Schedule History</Typography>
          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2, boxShadow: 'none', mb: 2 }}>
            <TableContainer sx={{ maxHeight: { xs: 440, sm: 600 }, overflowX: 'auto' }}>
              <Table stickyHeader size="small" sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Month</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Year</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Barangay</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Collector</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell>
                    </TableRow>
                  ) : history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No history found.</TableCell>
                    </TableRow>
                  ) : (
                    history.map((row, idx) => (
                      <TableRow key={row.id || row.date + row.barangay + row.collector_id} sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8f8f8', '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell>{row.month}</TableCell>
                        <TableCell>{row.year}</TableCell>
                        <TableCell>{formatDateWithDay(row.date)}</TableCell>
                        <TableCell>{row.barangay}</TableCell>
                        <TableCell>{row.collector_name}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default Schedule; 