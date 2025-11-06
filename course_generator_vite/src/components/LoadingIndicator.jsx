import React from 'react';
import logo from '../logo.png';

function LoadingIndicator() {
  return (
    <div className="loading-container">
      <img src={logo} className="loading-logo" alt="logo" />
      <p className="loading-text">Generating quantum content...</p>
    </div>
  );
}

export default LoadingIndicator;
