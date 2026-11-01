/** A number as Kade reads it: rounded to 2 decimals, no trailing zeros. */
export const fmt = (n: number): string => String(Math.round(n * 100) / 100)
