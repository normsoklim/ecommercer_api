const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Converts a duration string such as `15m`, `30d` or `3600` (seconds) into
 * milliseconds. Used to keep the stored session lifetime in sync with the
 * lifetime of the issued JWT.
 */
export function parseDurationToMs(
  value: string | undefined,
  fallback: string,
): number {
  const raw = (value ?? fallback).trim();
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/i.exec(raw);

  if (!match) {
    return parseDurationToMs(fallback, '15m');
  }

  const amount = Number.parseFloat(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();

  return Math.round(amount * (UNIT_TO_MS[unit] ?? UNIT_TO_MS.s));
}
