import React from 'react';
import './Schedule.css'; // Uses the same CSS for waves

const AnimatedBackground = () => (
  <div className="schedule-bg">
    <div className="schedule-waves">
      <div className="schedule-wave schedule-wave1"></div>
      <div className="schedule-wave schedule-wave2"></div>
      <div className="schedule-wave schedule-wave3"></div>
    </div>
  </div>
);

export default AnimatedBackground; 