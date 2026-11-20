/** Clamp to [0, max] and round to the nearest 0.5. Pure: safe to import anywhere. */
export const clampScore = (n: number, max: number) => Math.min(max, Math.max(0, Math.round(n * 2) / 2));
