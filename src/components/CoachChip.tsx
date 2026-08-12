import React from 'react';

export interface CoachChipProps {
  anchor: 'CARDS' | 'POT' | 'VILLAIN' | 'STACK';
  value: string;
  hue: string;
  state: 'idle' | 'live' | 'good' | 'violated' | 'dimmed';
  onOpenPopover?: () => void;
  isPopoverOpen?: boolean;
}

/**
 * The chip is only the marker. Its explanation is rendered by CoachChips in a
 * single docked panel, because a popover anchored to the chip itself sat on top
 * of the hero's hole cards no matter which side it flipped to.
 */
export const CoachChip: React.FC<CoachChipProps> = ({
  anchor,
  value,
  hue,
  state,
  onOpenPopover,
  isPopoverOpen = false,
}) => {
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
    </div>
  );
};
