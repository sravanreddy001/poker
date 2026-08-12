import { describe, it, expect } from 'vitest';
import { matchActionToCandidate } from './evScoring';

describe('evScoring: matchActionToCandidate', () => {
  // Build a realistic set of candidates similar to what the app produces
  const buildCandidates = () => [
    { label: 'fold', amount: 0 },
    { label: 'check', amount: 0 },
    { label: 'call', amount: 10 },
    { label: '1/3 pot', amount: 15 },
    { label: '1/2 pot', amount: 20 },
    { label: 'pot', amount: 40 },
    { label: '2x pot', amount: 80 },
    { label: 'all-in', amount: 100 },
  ];

  describe('non-aggressive actions', () => {
    it('should match fold by type', () => {
      const candidates = buildCandidates();
      const result = matchActionToCandidate('fold', undefined, candidates, 100, 0);
      expect(result?.label).toBe('fold');
    });

    it('should match check by type', () => {
      const candidates = buildCandidates();
      const result = matchActionToCandidate('check', undefined, candidates, 100, 0);
      expect(result?.label).toBe('check');
    });

    it('should match call by type', () => {
      const candidates = buildCandidates();
      const result = matchActionToCandidate('call', undefined, candidates, 100, 0);
      expect(result?.label).toBe('call');
    });
  });

  describe('all-in detection', () => {
    it('should match all-in when raise commits entire stack', () => {
      // User has 100 stack, already committed 10, raises to 100 more (total 110 > 100 + 10 = 110)
      // This should match 'all-in' candidate
      const candidates = buildCandidates();
      const result = matchActionToCandidate('raise', 100, candidates, 100, 10);
      expect(result?.label).toBe('all-in');
    });

    it('should match all-in when raise exactly commits remaining stack', () => {
      // User has 100 stack, already committed 20, raises to 100 more (total 120 = 100 + 20 = 120)
      const candidates = buildCandidates();
      const result = matchActionToCandidate('raise', 100, candidates, 100, 20);
      expect(result?.label).toBe('all-in');
    });

    it('should match user-reported case: raise 99 when stack is 100, committed 1', () => {
      // User raises 99 total (started with 100, used 1 for button = 99 left)
      // Total committed would be 1 + 99 = 100 = stack + 1, should match all-in
      const candidates = [
        { label: 'fold', amount: 0 },
        { label: 'call', amount: 1 },
        { label: 'pot', amount: 30 },
        { label: 'all-in', amount: 100 },
      ];
      const result = matchActionToCandidate('raise', 99, candidates, 100, 1);
      expect(result?.label).toBe('all-in');
    });
  });

  describe('exact amount matching', () => {
    it('should match exact raise amount to modeled size', () => {
      const candidates = buildCandidates();
      const result = matchActionToCandidate('raise', 40, candidates, 200, 0);
      expect(result?.label).toBe('pot');
    });

    it('should match exact bet amount to modeled size', () => {
      const candidates = buildCandidates();
      const result = matchActionToCandidate('bet', 80, candidates, 200, 0);
      expect(result?.label).toBe('2x pot');
    });
  });

  describe('nearest matching for custom amounts', () => {
    it('should match custom raise between two modeled sizes to nearest', () => {
      // User raises 50, which is between '1/2 pot' (40) and '2x pot' (80)
      // Nearest is '1/2 pot' at distance 10
      const candidates = buildCandidates();
      const result = matchActionToCandidate('raise', 50, candidates, 200, 0);
      expect(result?.label).toBe('pot'); // Actually pot is at 40, diff=10; 2x pot is at 80, diff=30
    });

    it('should match custom raise closer to larger size', () => {
      // User raises 75, which is between 'pot' (40) and '2x pot' (80)
      // Nearest is '2x pot' at distance 5
      const candidates = buildCandidates();
      const result = matchActionToCandidate('raise', 75, candidates, 200, 0);
      expect(result?.label).toBe('2x pot');
    });

    it('should not match to fold when finding nearest', () => {
      // User raises 5, but fold is at 0 and shouldn't be considered for nearest match
      const candidates = buildCandidates();
      const result = matchActionToCandidate('raise', 5, candidates, 200, 0);
      expect(result?.label).not.toBe('fold');
      expect(result?.label).toBe('1/3 pot'); // 1/3 pot is at 15, diff=10
    });
  });

  describe('sentinel -10 elimination', () => {
    it('should return undefined (not -10 sentinel) when no candidate can be matched', () => {
      // Empty candidates, no match possible
      const candidates: Array<{ label: string; amount?: number }> = [];
      const result = matchActionToCandidate('raise', 50, candidates, 200, 0);
      expect(result).toBeUndefined();
      // This signals to the caller to use evLost = 0, not -10
    });

    it('should handle candidates without amounts gracefully', () => {
      const candidates = [
        { label: 'fold' },
        { label: 'call' },
        { label: 'some-action-no-amount' },
      ];
      const result = matchActionToCandidate('raise', 50, candidates, 200, 0);
      expect(result).toBeUndefined();
    });
  });

  describe('case insensitivity', () => {
    it('should match non-aggressive actions case-insensitively', () => {
      const candidates = [{ label: 'FOLD' }, { label: 'CALL' }];
      const result = matchActionToCandidate('fold', undefined, candidates, 100, 0);
      expect(result?.label).toBe('FOLD');
    });
  });

  describe('edge cases', () => {
    it('should handle raise with undefined amount gracefully', () => {
      const candidates = buildCandidates();
      const result = matchActionToCandidate('raise', undefined, candidates, 100, 0);
      expect(result).toBeUndefined();
    });

    it('should prefer all-in over exact amount match when both apply', () => {
      const candidates = [
        { label: 'pot', amount: 100 },
        { label: 'all-in', amount: 100 },
      ];
      // When raise commits the stack, prefer all-in
      const result = matchActionToCandidate('raise', 100, candidates, 100, 0);
      expect(result?.label).toBe('all-in');
    });

    it('should handle single candidate', () => {
      const candidates = [{ label: 'all-in', amount: 100 }];
      const result = matchActionToCandidate('raise', 50, candidates, 100, 0);
      expect(result?.label).toBe('all-in');
    });
  });

  describe('regression: original bug', () => {
    it('should not fall back to -10 sentinel for any bet or raise', () => {
      // The original bug: "raise 99" was constructed as a label and compared against
      // labels like 'all-in', '2x pot', etc., never matching, falling back to -10.
      // Now it should always find a match.
      const candidates = buildCandidates();

      // Trying various raises should never return undefined (which the caller treats as 0 EV, not -10)
      expect(matchActionToCandidate('raise', 99, candidates, 100, 1)).toBeDefined();
      expect(matchActionToCandidate('bet', 25, candidates, 200, 0)).toBeDefined();
      expect(matchActionToCandidate('raise', 15, candidates, 200, 10)).toBeDefined();
    });
  });
});
