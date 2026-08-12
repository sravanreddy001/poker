/**
 * Computes the net chip result for a hand given the hero's stack at start and end.
 * Positive means the hero won chips; negative means the hero lost chips.
 * Zero is only valid when stacks are identical (e.g., folded immediately).
 *
 * @param startStack - Hero's stack at the moment the hand began (after top-up rule applied)
 * @param endStack - Hero's stack after the hand completed
 * @returns Net chip gain/loss
 */
export function handResult(startStack: number, endStack: number): number {
  return endStack - startStack;
}
