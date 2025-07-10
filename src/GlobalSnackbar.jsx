import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

const GlobalSnackbarContext = createContext();

export const GlobalSnackbarProvider = ({ children }) => {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const showSnackbar = useCallback((message, severity = 'info', duration = 5000) => {
    setSnackbar({ open: true, message, severity, duration });
  }, []);

  const handleClose = useCallback(() => {
    setSnackbar(s => ({ ...s, open: false }));
  }, []);

  return (
    <GlobalSnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.duration || 5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={handleClose}
          variant="filled"
          sx={{ fontWeight: 600, fontSize: '1.1rem', minWidth: 320 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </GlobalSnackbarContext.Provider>
  );
};

export const useGlobalSnackbar = () => {
  const ctx = useContext(GlobalSnackbarContext);
  if (!ctx) throw new Error('useGlobalSnackbar must be used within a GlobalSnackbarProvider');
  return ctx.showSnackbar;
}; 