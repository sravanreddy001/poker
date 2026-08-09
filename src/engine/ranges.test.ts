import { describe, it, expect } from 'vitest';
import { parseCard } from './cards';
import { canonicalName, combosOf, HAND_ORDER, rangeTopPercent, removeDead } from './ranges';

describe('ranges', () => {
  it('names hands canonically', () => {
    expect(canonicalName(parseCard('As'), parseCard('Ks'))).toBe('AKs');
    expect(canonicalName(parseCard('As'), parseCard('Kh'))).toBe('AKo');
    expect(canonicalName(parseCard('As'), parseCard('Ah'))).toBe('AA');
    expect(canonicalName(parseCard('Kh'), parseCard('As'))).toBe('AKo');
  });

  it('produces the right combo counts', () => {
    expect(combosOf('AA')).toHaveLength(6);
    expect(combosOf('AKs')).toHaveLength(4);
    expect(combosOf('AKo')).toHaveLength(12);
  });

  it('covers all 169 canonical hands exactly once', () => {
    expect(HAND_ORDER).toHaveLength(169);
    expect(new Set(HAND_ORDER).size).toBe(169);
  });

  it('accounts for all 1326 combos across the 169 hands', () => {
    const total = HAND_ORDER.reduce((n, h) => n + combosOf(h).length, 0);
    expect(total).toBe(1326);
  });

  it('ranks premium hands at the top', () => {
    expect(HAND_ORDER.slice(0, 5)).toContain('AA');
    expect(HAND_ORDER.slice(0, 5)).toContain('KK');
    expect(HAND_ORDER.indexOf('AA')).toBeLessThan(HAND_ORDER.indexOf('72o'));
  });

  it('ranks suited above the same offsuit hand', () => {
    expect(HAND_ORDER.indexOf('AKs')).toBeLessThan(HAND_ORDER.indexOf('AKo'));
    expect(HAND_ORDER.indexOf('76s')).toBeLessThan(HAND_ORDER.indexOf('76o'));
  });

  it('builds top-percent ranges of roughly the right size', () => {
    const r = rangeTopPercent(0.2);
    expect(r.combos.length).toBeGreaterThan(200);
    expect(r.combos.length).toBeLessThan(340);
  });

  it('removes dead cards', () => {
    const r = rangeTopPercent(1.0);
    const dead = [parseCard('As')];
    const filtered = removeDead(r, dead);
    expect(filtered.combos.every(([a, b]) => a !== dead[0] && b !== dead[0])).toBe(true);
    expect(filtered.combos.length).toBeLessThan(r.combos.length);
  });
});
