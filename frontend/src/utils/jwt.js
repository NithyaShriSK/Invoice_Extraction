/**
 * Returns true if a JWT has a valid `exp` claim in the past.
 * Malformed tokens or missing `exp` → false (server validates).
 */
export function isJwtExpired(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (payload.exp == null) return false;
    return Number(payload.exp) * 1000 <= Date.now();
  } catch {
    return false;
  }
}
