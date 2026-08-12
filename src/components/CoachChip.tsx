import React, { useRef, useEffect, useState } from 'react';

export interface CoachChipProps {
  anchor: 'CARDS' | 'POT' | 'VILLAIN' | 'STACK';
  value: string;
  hue: string;
  state: 'idle' | 'live' | 'good' | 'violated' | 'dimmed';
  onOpenPopover?: () => void;
  popoverContent?: React.ReactNode;
  isPopoverOpen?: boolean;
  onPopoverClose?: () => void;
}

export const CoachChip: React.FC<CoachChipProps> = ({
  anchor,
  value,
  hue,
  state,
  onOpenPopover,
  popoverContent,
  isPopoverOpen = false,
  onPopoverClose,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverSide, setPopoverSide] = useState<'left' | 'right'>('right');

  // Handle click outside to close popover
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onPopoverClose?.();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPopoverClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPopoverOpen, onPopoverClose]);

  // Determine popover side to avoid overflow
  useEffect(() => {
    if (!isPopoverOpen || !popoverRef.current || !buttonRef.current) return;

    const rect = popoverRef.current.getBoundingClientRect();
    const frameRect = document.querySelector('.app-root')?.getBoundingClientRect();

    if (frameRect) {
      // If popover would overflow right edge, flip to left
      if (rect.right > frameRect.right - 8) {
        setPopoverSide('left');
      } else {
        setPopoverSide('right');
      }
    }
  }, [isPopoverOpen]);

  const getBorderColor = () => {
    if (state === 'dimmed') return 'rgba(255, 255, 255, 0.14)';
    if (state === 'good') return 'var(--emerald)';
    if (state === 'violated') return 'var(--coral)';
    if (state === 'live') return hue;
    return 'rgba(255, 255, 255, 0.14)'; // idle
  };

  const getBoxShadow = () => {
    if (state === 'live') {
      return `0 0 12px ${hue}40`;
    }
    return 'none';
  };

  const getOpacity = state === 'dimmed' ? 0.34 : 1;

  return (
    <div className="coach-chip-wrapper">
      <button
        ref={buttonRef}
        className="coach-chip"
        style={{
          backgroundColor: hue,
          borderColor: getBorderColor(),
          boxShadow: getBoxShadow(),
          opacity: getOpacity,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={onOpenPopover}
        aria-expanded={isPopoverOpen}
        aria-label={`${anchor}: ${value}`}
        title={`${anchor}: ${value}`}
      >
        <span className="coach-chip-value">{value}</span>
      </button>

      {isPopoverOpen && popoverContent && (
        <div
          ref={popoverRef}
          className={`coach-chip-popover coach-chip-popover-${popoverSide}`}
          role="dialog"
          aria-label={`${anchor} details`}
        >
          {popoverContent}
        </div>
      )}
    </div>
  );
};
