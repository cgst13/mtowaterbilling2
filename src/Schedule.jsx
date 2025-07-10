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
    <Box sx={{ p: 0, minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Animated background */}
      <div className="schedule-bg">
        <div className="schedule-waves">
          <div className="schedule-wave schedule-wave1"></div>
          <div className="schedule-wave schedule-wave2"></div>
          <div className="schedule-wave schedule-wave3"></div>
        </div>
      </div>
      <Box sx={{ position: 'relative', zIndex: 2, p: { xs: 1, md: 3 } }}>
        <div className="schedule-card">
          <div className="schedule-header">
            <CalendarTodayIcon className="schedule-icon" />
            Collection Schedule
          </div>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Current Schedule" />
            <Tab label="History" />
          </Tabs>
          {tab === 0 && (
            <>
              <div className="schedule-subtitle">
                Generate and view collection schedules for all collectors
              </div>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#0284c7' }}>
                For {now.toLocaleString(undefined, { month: 'long' })} {scheduleYear}
              </Typography>
              <div style={{ marginBottom: 24 }}>
                <Stack direction="row" alignItems="center" gap={2}>
                  <GroupIcon sx={{ color: '#0ea5e9', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    Collectors
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                    ({collectors.length} found)
                  </Typography>
                </Stack>
              </div>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
              ) : collectors.length === 0 ? (
                <Typography>No collectors found.</Typography>
              ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 0, background: 'transparent', mb: 3 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {collectors.map(c => (
                        <TableRow key={c.userid}>
                          <TableCell>{c.firstname} {c.lastname}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {schedule.length > 0 && (
                <div className="schedule-table">
                  <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 0, background: 'transparent' }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Barangay</TableCell>
                          <TableCell>Collector</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {schedule.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell>{formatDateWithDay(s.date)}</TableCell>
                            <TableCell>{s.barangay}</TableCell>
                            <TableCell>{s.collector_name || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>
              )}
              {/* Floating Action Button for Generate Schedule */}
              <div className="schedule-fab" title="Generate Collection Schedule" onClick={handleGenerateSchedule} style={{ pointerEvents: loading || collectors.length === 0 || generating ? 'none' : 'auto', opacity: loading || collectors.length === 0 || generating ? 0.6 : 1 }}>
                <CalendarTodayIcon fontSize="inherit" />
              </div>
            </>
          )}
          {tab === 1 && (
            <div className="schedule-table">
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#0284c7' }}>
                Schedule History
              </Typography>
              <Stack direction="row" gap={2} sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={historyMonth}
                    label="Month"
                    onChange={e => setHistoryMonth(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {monthOptions.map(m => (
                      <MenuItem key={m} value={m}>{new Date(0, m - 1).toLocaleString(undefined, { month: 'long' })}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={historyYear}
                    label="Year"
                    onChange={e => setHistoryYear(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {yearOptions.map(y => (
                      <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 0, background: 'transparent' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Barangay</TableCell>
                      <TableCell>Collector</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredHistory.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell>{`${h.year}-${String(h.month).padStart(2, '0')}`}</TableCell>
                        <TableCell>{formatDateWithDay(h.date)}</TableCell>
                        <TableCell>{h.barangay}</TableCell>
                        <TableCell>{h.collector_name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          )}
        </div>
      </Box>
    </Box>
  );
};

export default Schedule; 