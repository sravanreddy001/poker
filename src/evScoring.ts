/**
 * Pure helper to match a user action to a candidate EV option.
 * Used to determine which modeled action best represents the user's choice.
 */
export function matchActionToCandidate(
  actionType: 'fold' | 'check' | 'call' | 'bet' | 'raise',
  actionAmount: number | undefined,
  candidates: Array<{ label: string; amount?: number; ev?: number }>,
  heroStack: number,
  heroCommitted: number,
): { label: string; amount?: number; ev?: number } | undefined {
  if (actionType === 'fold' || actionType === 'check' || actionType === 'call') {
    // For non-aggressive actions, match by type
    return candidates.find((c) => c.label.toLowerCase() === actionType.toLowerCase());
  }

  if (actionType === 'bet' || actionType === 'raise') {
    if (actionAmount === undefined) return undefined;

    const targetAmount = actionAmount;
    const totalCommitted = heroCommitted + targetAmount;

    // Check if this raise commits the entire stack (all-in)
    if (totalCommitted >= heroStack + heroCommitted) {
      // Try to match the 'all-in' candidate first
      const allInCandidate = candidates.find((c) => c.label.toLowerCase() === 'all-in');
      if (allInCandidate) return allInCandidate;
    }

    // Try exact amount match
    let exact = candidates.find((c) => c.amount !== undefined && c.amount === targetAmount);
    if (exact) return exact;

    // Find the nearest candidate by absolute amount difference
    // Skip fold, check, and call since they are not aggressive actions
    let nearest: { label: string; amount?: number; ev?: number } | undefined;
    let minDiff = Infinity;
    for (const candidate of candidates) {
      const candidateLabel = candidate.label.toLowerCase();
      const isAggressiveSize =
        candidate.amount !== undefined &&
        candidateLabel !== 'fold' &&
        candidateLabel !== 'check' &&
        candidateLabel !== 'call';

      if (isAggressiveSize && candidate.amount !== undefined) {
        const diff = Math.abs(candidate.amount - targetAmount);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = candidate;
        }
      }
    }
    return nearest;
  }

  return undefined;
}
