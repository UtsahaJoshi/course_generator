import React from 'react';
import logo from '../logo.png';

function CourseHeader({ isFadingOut }) {
  return (
    <header className={`header ${isFadingOut ? 'fading-out' : ''}`}>
      <img src={logo} className="App-logo" alt="logo" />
      <div className="header-text">
        <h1 className="header-title">Learn Quantum Computing</h1>
        <p className="header-subtitle">
          Type a quantum-computing topic → get 2-page structured content
        </p>
      </div>
    </header>
  );
}

export default CourseHeader;
