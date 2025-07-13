import React from 'react';
import { Box, Typography, Paper, Container } from '@mui/material';
import AnimatedBackground from './AnimatedBackground';
import PageHeader from './PageHeader';
import useMediaQuery from '@mui/material/useMediaQuery';

const RPTCalculator = () => {
  const isMobile = useMediaQuery('(max-width:600px)');
  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 1, sm: 3 }, bgcolor: '#f7f7f7', width: '100%', overflow: 'hidden' }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={600} sx={{ mb: 0.5, color: '#222' }}>RPT Calculator</Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>Real Property Tax Calculator Tool</Typography>
        </Box>
        <Paper sx={{ p: { xs: 1, sm: 2 }, mb: 2, borderRadius: 2, boxShadow: 'none', width: '100%' }}>
          <Box sx={{ width: '100%', height: { xs: 300, sm: 400, md: 700 }, borderRadius: 2, overflow: 'hidden' }}>
            <iframe
              title="RPT Calculator"
              src="https://script.google.com/macros/s/AKfycbzdhU6lDW5kd9w28hE3inteCV1zdz_VLUOOD_RAWwUlyIyNCTsoMfklGIbOKsf5TX96qg/exec"
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
            />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default RPTCalculator; 