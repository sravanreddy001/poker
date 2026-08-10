import React, { useEffect, useRef, useState } from 'react';

export type SnapPoint = 'peek' | 'half' | 'full';

export interface BottomSheetProps {
  snap: SnapPoint;
  onSnapChange: (snap: SnapPoint) => void;
  children: React.ReactNode;
  activeTab: 'equity' | 'lines' | 'villain';
  onTabChange: (tab: 'equity' | 'lines' | 'villain') => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  snap,
  onSnapChange,
  children,
  activeTab,
  onTabChange,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);

  const isPresented = snap !== 'peek';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPresented) {
        onSnapChange('peek');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresented, onSnapChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    dragStartHeight.current = sheetRef.current?.getBoundingClientRect().height || 0;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = e.clientY - dragStartY.current;
    setDragOffset(deltaY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = e.clientY - dragStartY.current;
    dragStartY.current = null;
    setDragOffset(0);

    if (deltaY < -60) {
      if (snap === 'half') onSnapChange('full');
      else if (snap === 'peek') onSnapChange('half');
    } else if (deltaY > 60) {
      if (snap === 'full') onSnapChange('half');
      else if (snap === 'half') onSnapChange('peek');
    }
  };

  const selectTab = (tab: 'equity' | 'lines' | 'villain') => {
    onTabChange(tab);
    if (tab === 'villain' && snap === 'half') {
      onSnapChange('full');
    }
  };

  return (
    <>
      {/* Scrim Overlay */}
      {isPresented && (
        <div
          className="bottom-sheet-scrim"
          onClick={() => onSnapChange('peek')}
          aria-hidden="true"
        />
      )}

      <div
        ref={sheetRef}
        className={`bottom-sheet-modal snap-${snap}`}
        style={dragOffset !== 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        role={isPresented ? 'dialog' : undefined}
        aria-modal={isPresented ? true : undefined}
        aria-label="Math and analysis drawer"
      >
        {/* Grabber Bar & Handle */}
        <div
          className="sheet-handle-bar"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <span className="handle-pill" />
        </div>

        {/* Tab Header Navigation */}
        <div className="sheet-tab-header">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'equity' ? 'active' : ''}`}
            onClick={() => selectTab('equity')}
          >
            Equity
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'lines' ? 'active' : ''}`}
            onClick={() => selectTab('lines')}
          >
            Lines & EV
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'villain' ? 'active' : ''}`}
            onClick={() => selectTab('villain')}
          >
            Villain Range
          </button>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={() => onSnapChange('peek')}
            aria-label="Close analysis sheet"
          >
            ✕
          </button>
        </div>

        {/* Sheet Main Scroll Content */}
        <div className="sheet-scroll-body">{children}</div>
      </div>
    </>
  );
};
