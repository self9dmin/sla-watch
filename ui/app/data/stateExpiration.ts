const DAY_MS = 24 * 60 * 60 * 1000;
const STATE_TTL_DAYS = 90;
const STATE_TTL_SAFETY_MS = 5 * 60 * 1000;

export const createStateExpiration = (now = Date.now()): string =>
  new Date(now + STATE_TTL_DAYS * DAY_MS - STATE_TTL_SAFETY_MS).toISOString();
