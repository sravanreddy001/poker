import { describe, it, expect } from 'vitest';
import { handResult } from './sessionUtils';

describe('handResult', () => {
  it('returns positive when hero wins chips', () => {
    const startStack = 100;
    const endStack = 200.50;
    const result = handResult(startStack, endStack);
    expect(result).toBe(100.50);
  });

  it('returns negative when hero loses chips', () => {
    const startStack = 100;
    const endStack = 70;
    const result = handResult(startStack, endStack);
    expect(result).toBe(-30);
  });

  it('returns negative for a preflop fold losing only a blind', () => {
    const startStack = 100;
    const endStack = 99; // Folded to big blind of 1
    const result = handResult(startStack, endStack);
    expect(result).toBe(-1);
  });

  it('handles hero topped up from under 10 to 100 without counting top-up as profit', () => {
    // Hero had 5 chips at end of previous hand
    // Top-up rule sets start stack to 100 for this hand
    const startStack = 100; // This is the topped-up value
    const endStack = 150; // Hero won 50 chips during the hand
    const result = handResult(startStack, endStack);
    // The result should be 50, NOT 145 (which would count the 95-chip top-up as profit)
    expect(result).toBe(50);
  });

  it('returns zero when stack does not change', () => {
    const startStack = 100;
    const endStack = 100;
    const result = handResult(startStack, endStack);
    expect(result).toBe(0);
  });

  it('never returns zero for hands where stack changed', () => {
    // This guards against regressions where won is computed as 0 despite stacks differing
    const startStack = 100;
    const endStack = 150;
    const result = handResult(startStack, endStack);
    expect(result).not.toBe(0);
    expect(result).toBe(50);
  });

  it('handles decimal chip amounts correctly', () => {
    const startStack = 100;
    const endStack = 123.45;
    const result = handResult(startStack, endStack);
    expect(result).toBeCloseTo(23.45, 5);
  });
});
