import React from 'react';

function PromptInput({ onInputChange, onButtonClick, promptInput, isFadingOut }) {
  return (
    <div className={`input-container ${isFadingOut ? 'fading-out' : ''}`}>
      <textarea
        className="story-input"
        placeholder="E.g. 'Explain quantum superposition for beginners', 'QC for ML', 'Intro to Shor’s algorithm'..."
        maxLength="400"
        value={promptInput}
        onChange={onInputChange}
      />
      <div className="input-actions">
        <button className="generate-button" onClick={onButtonClick}>
          Generate Course
        </button>
      </div>
    </div>
  );
}

export default PromptInput;
