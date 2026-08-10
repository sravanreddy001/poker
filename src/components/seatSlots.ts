export interface SlotCoord {
  left: string;
  top: string;
}

export const SLOT_COORDS: SlotCoord[] = [
  { left: '50%', top: '100%' }, // 0: Hero / Bottom
  { left: '0%', top: '74%' },   // 1: Left-lower
  { left: '0%', top: '26%' },   // 2: Left-upper
  { left: '50%', top: '0%' },    // 3: Top
  { left: '100%', top: '26%' }, // 4: Right-upper
  { left: '100%', top: '74%' }, // 5: Right-lower
];

export function getSeatSlot(playerId: number, totalPlayers: number): number {
  if (totalPlayers <= 1 || playerId === 0) return 0;
  if (totalPlayers === 6) return playerId;
  if (totalPlayers === 2) return playerId === 1 ? 3 : 0;
  if (totalPlayers === 3) return playerId === 1 ? 2 : playerId === 2 ? 4 : 0;
  if (totalPlayers === 4) return [0, 1, 3, 5][playerId] ?? playerId;
  if (totalPlayers === 5) return [0, 1, 2, 4, 5][playerId] ?? playerId;
  return playerId;
}

export const BTN_OFFSETS: SlotCoord[] = [
  { left: '42%', top: '86%' }, // Button at Hero (Slot 0)
  { left: '14%', top: '74%' }, // Button at Slot 1
  { left: '14%', top: '26%' }, // Button at Slot 2
  { left: '42%', top: '14%' }, // Button at Slot 3
  { left: '86%', top: '26%' }, // Button at Slot 4
  { left: '86%', top: '74%' }, // Button at Slot 5
];

export function getBtnCoord(btnSeat: number, totalPlayers: number): SlotCoord {
  const slot = getSeatSlot(btnSeat, totalPlayers);
  return BTN_OFFSETS[slot] ?? BTN_OFFSETS[0];
}
