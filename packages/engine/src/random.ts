/** Returns a float in [0, 1). The server passes a crypto-backed source; tests pass a seeded one. */
export type Random = () => number;

/** Deterministic PRNG (mulberry32) for tests and replays. Not for production shuffles. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random: Random, maxExclusive: number): number {
  return Math.floor(random() * maxExclusive);
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
