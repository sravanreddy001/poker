import { describe, it, expect } from 'vitest';
import { getSeatSlot, getBtnCoord } from './seatSlots';

describe('seatSlots', () => {
  it('maps Hero (id=0) to slot 0 for 2 to 6 players', () => {
    for (let count = 2; count <= 6; count++) {
      expect(getSeatSlot(0, count)).toBe(0);
    }
  });

  it('assigns unique slots for all players in 2-6 player games', () => {
    for (let count = 2; count <= 6; count++) {
      const slots = new Set<number>();
      for (let p = 0; p < count; p++) {
        const slot = getSeatSlot(p, count);
        expect(slots.has(slot)).toBe(false);
        slots.add(slot);
      }
      expect(slots.size).toBe(count);
    }
  });

  it('derives dealer button coordinates from button seat', () => {
    const coord0 = getBtnCoord(0, 6);
    expect(coord0).toEqual({ left: '42%', top: '86%' });

    const coord3 = getBtnCoord(3, 6);
    expect(coord3).toEqual({ left: '42%', top: '14%' });
  });
});
