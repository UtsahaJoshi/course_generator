import React from 'react';

function BranchChoices({ choices, onChoiceClick, onDeepClick, showBack, onBackClick, selectedKey }) {
  if (!Array.isArray(choices) || choices.length === 0) {
    return (
      <footer className="choices-bar">
        <button className="deep-button" onClick={onDeepClick} title="Generate a deeper, more advanced take">
          Dig deeper!
        </button>
        {showBack && (
          <button className="back-button" onClick={onBackClick} title="Go back to previous content">
            ← Back
          </button>
        )}
      </footer>
    );
  }

  return (
    <footer className="choices-bar" aria-label="Continue learning choices">
      {/* Two branch choices */}
      {choices.map((choice) => {
        const isSelected = selectedKey === choice.key;
        return (
          <button
            key={choice.key}
            className={`choice-chip ${isSelected ? 'choice-chip--selected' : ''}`}
            onClick={() => onChoiceClick(choice)}
            title={choice.text}
          >
            {choice.text}
          </button>
        );
      })}

      {/* Dig deeper (full width row) */}
      <div className="choices-row-wide">
        <button className={`deep-button ${selectedKey === 'deep' ? 'deep-button--selected' : ''}`} onClick={onDeepClick}>
          Dig deeper!
        </button>

        {showBack && (
          <button className="back-button" onClick={onBackClick} title="Go back to previous content">
            ← Back
          </button>
        )}
      </div>
    </footer>
  );
}

export default BranchChoices;
