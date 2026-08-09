import React, { useState } from 'react';

interface BottomSheetProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  title,
  children,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`bottom-sheet ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
      <button
        type="button"
        className="bottom-sheet-handle-bar"
        onClick={() => setExpanded((prev) => !prev)}
        aria-label="Toggle analysis drawer"
      >
        <span className="handle-pill" />
        <span className="bottom-sheet-title">{title}</span>
        <span className="handle-chevron">{expanded ? '▼' : '▲'}</span>
      </button>

      <div className="bottom-sheet-content">{children}</div>
    </div>
  );
};
