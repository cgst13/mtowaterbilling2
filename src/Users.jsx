import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, TextField, Select, MenuItem, Stack, IconButton, CircularProgress, Container
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Person as PersonIcon } from '@mui/icons-material';
import { supabase } from './supabaseClient';
import PageHeader from './PageHeader';
import { useGlobalSnackbar } from './GlobalSnackbar';
import AnimatedBackground from './AnimatedBackground';
import useMediaQuery from '@mui/material/useMediaQuery';

const roleOptions = ['Admin', 'Collector', 'Reader'];
const statusOptions = ['active', 'inactive', 'pending'];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({
    userid: '',
    email: '',
    firstname: '',
    lastname: '',
    password: '', // not used in form, but kept for insert
    department: '',
    position: '',
    role: 'Collector',
    status: 'active',
    datecreated: '',
    lastlogin: ''
  });
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const showSnackbar = useGlobalSnackbar();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('users').select('*').order('datecreated', { ascending: false });
      setUsers(error ? [] : data || []);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase.from('departments').select('*');
      console.log('Departments fetched:', data, error); // DEBUG LOG
      if (!error && data) {
        setDepartmentOptions(data.map(d => d.name || d.department || d.dept_name || d.title));
      } else {
        setDepartmentOptions([]);
      }
    };
    fetchDepartments();
  }, []);

  const handleDialogOpen = (user = null) => {
    if (user) {
      setEditMode(true);
      setSelectedUser(user);
      setForm({
        userid: user.userid,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        password: '',
        department: user.department || '',
        position: user.position || '',
        role: user.role || 'Collector',
        status: user.status || 'active',
        datecreated: user.datecreated || '',
        lastlogin: user.lastlogin || ''
      });
    } else {
      setEditMode(false);
      setSelectedUser(null);
      setForm({
        userid: '',
        email: '',
        firstname: '',
        lastname: '',
        password: '',
        department: '',
        position: '',
        role: 'Collector',
        status: 'active',
        datecreated: '',
        lastlogin: ''
      });
    }
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setForm({
      userid: '',
      email: '',
      firstname: '',
      lastname: '',
      password: '',
      department: '',
      position: '',
      role: 'Collector',
      status: 'active',
      datecreated: '',
      lastlogin: ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveUser = async () => {
    if (!form.email || !form.firstname || !form.lastname || !form.role || !form.status) {
      const missing = [];
      if (!form.email) missing.push('Email');
      if (!form.firstname) missing.push('First Name');
      if (!form.lastname) missing.push('Last Name');
      if (!form.role) missing.push('Role');
      if (!form.status) missing.push('Status');
      showSnackbar(`Please fill in the following required fields: ${missing.join(', ')}`, 'error');
      return;
    }
    if (editMode) {
      const { error } = await supabase
        .from('users')
        .update({
          firstname: form.firstname,
          lastname: form.lastname,
          department: form.department,
          position: form.position,
          role: form.role,
          status: form.status
        })
        .eq('userid', form.userid);
      if (!error) {
        showSnackbar(`User "${form.firstname} ${form.lastname}" updated successfully.`, 'success');
        setUsers(users.map(u => u.userid === form.userid ? { ...u, ...form } : u));
        handleDialogClose();
      } else {
        showSnackbar(`Failed to update user: ${error?.message || 'Unknown error'}`, 'error');
      }
    } else {
      // Generate uuid for new user
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 18);
      const { error } = await supabase
        .from('users')
        .insert([{ 
          userid: uuid,
          firstname: form.firstname,
          lastname: form.lastname,
          password: 'admin',
          department: form.department || null,
          position: form.position || null,
          role: form.role || null,
          email: form.email || null,
          status: form.status || null
        }]);
      if (!error) {
        showSnackbar(`User "${form.firstname} ${form.lastname}" (${form.email}) added successfully.`, 'success');
        setUsers([{ ...form, userid: uuid, datecreated: new Date().toISOString() }, ...users]);
        handleDialogClose();
      } else {
        showSnackbar(`Failed to add user: ${error?.message || 'Unknown error'}`, 'error');
      }
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('userid', selectedUser.userid);
    if (!error) {
      showSnackbar(`User "${selectedUser.firstname} ${selectedUser.lastname}" deleted successfully.`, 'success');
      setUsers(users.filter(u => u.userid !== selectedUser.userid));
      setDeleteDialogOpen(false);
    } else {
      showSnackbar(`Failed to delete user: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 1, sm: 3 }, bgcolor: '#f7f7f7', width: '100%', overflow: 'hidden' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={600} sx={{ mb: 0.5, color: '#222' }}>Users</Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>Manage user accounts and permissions</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
          <Button variant="contained" onClick={() => handleDialogOpen()} sx={{ borderRadius: 2, minWidth: 120, width: { xs: '100%', sm: 'auto' }, fontWeight: 500 }}>Add User</Button>
        </Stack>
        <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2, boxShadow: 'none', mb: 2 }}>
          <TableContainer sx={{ maxHeight: { xs: 440, sm: 600 }, overflowX: 'auto' }}>
            <Table stickyHeader size="small" sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>First Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Last Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Position</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#333', borderBottom: '1px solid #e0e0e0' }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center"><CircularProgress size={24} /></TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">No users found.</TableCell>
                  </TableRow>
                ) : (
                  users.map((user, idx) => (
                    <TableRow key={user.userid} sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8f8f8', '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>{user.firstname}</TableCell>
                      <TableCell>{user.lastname}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>{user.position}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{user.status}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="outlined" sx={{ borderRadius: 2, minWidth: 0, px: 1 }} onClick={() => handleDialogOpen(user)}>Edit</Button>
                          <Button size="small" variant="outlined" color="error" sx={{ borderRadius: 2, minWidth: 0, px: 1 }} onClick={() => { setSelectedUser(user); setDeleteDialogOpen(true); }}>Delete</Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        {/* User Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleDialogClose}
          fullScreen={isMobile}
          PaperProps={{ sx: { borderRadius: { xs: 0, sm: 2 }, width: { xs: '100%', sm: 400 }, m: 0 } }}
        >
          <DialogTitle sx={{ fontWeight: 600, color: '#222', pb: 0 }}>{editMode ? 'Edit User' : 'Add User'}</DialogTitle>
          <DialogContent sx={{ bgcolor: '#fff', p: 2 }}>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="First Name" name="firstname" value={form.firstname} onChange={handleFormChange} fullWidth size="small" autoFocus required />
              <TextField label="Last Name" name="lastname" value={form.lastname} onChange={handleFormChange} fullWidth size="small" required />
              <TextField label="Email" name="email" value={form.email} onChange={handleFormChange} fullWidth size="small" required />
              <Select label="Department" name="department" value={form.department} onChange={handleFormChange} displayEmpty size="small" fullWidth>
                <MenuItem value=""><em>None</em></MenuItem>
                {departmentOptions.map((d, i) => <MenuItem key={i} value={d}>{d}</MenuItem>)}
              </Select>
              <TextField label="Position" name="position" value={form.position} onChange={handleFormChange} fullWidth size="small" />
              <Select label="Role" name="role" value={form.role} onChange={handleFormChange} size="small" fullWidth>
                {roleOptions.map((r, i) => <MenuItem key={i} value={r}>{r}</MenuItem>)}
              </Select>
              <Select label="Status" name="status" value={form.status} onChange={handleFormChange} size="small" fullWidth>
                {statusOptions.map((s, i) => <MenuItem key={i} value={s}>{s}</MenuItem>)}
              </Select>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#fff', px: 2, pb: 2 }}>
            <Button onClick={handleDialogClose} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
            <Button onClick={handleSaveUser} variant="contained" sx={{ borderRadius: 2, fontWeight: 500 }}>{editMode ? 'Save' : 'Add'}</Button>
          </DialogActions>
        </Dialog>
        {/* Delete Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          PaperProps={{ sx: { borderRadius: { xs: 0, sm: 2 }, width: { xs: '100%', sm: 360 }, m: 0 } }}
        >
          <DialogTitle sx={{ fontWeight: 600, color: '#222' }}>Delete User</DialogTitle>
          <DialogContent sx={{ bgcolor: '#fff', p: 2 }}>
            <Typography>Are you sure you want to delete this user?</Typography>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#fff', px: 2, pb: 2 }}>
            <Button onClick={() => setDeleteDialogOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
            <Button onClick={handleDeleteUser} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 500 }}>Delete</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default Users; 