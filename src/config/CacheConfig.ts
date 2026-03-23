export const CacheControl = {
  oneDay:
    'max-age=86400, must-revalidate, stale-while-revalidate=1800, stale-if-error=1800, public',
  oneHour:
    'max-age=3600, must-revalidate, stale-while-revalidate=1800, stale-if-error=1800, public',
  off: 'no-cache, no-store, must-revalidate',
};
