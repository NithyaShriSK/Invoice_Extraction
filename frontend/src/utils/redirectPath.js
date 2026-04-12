/**
 * Build a path string from a React Router `location` stored in navigation state
 * (e.g. `state={{ from: location }}` from ProtectedRoute).
 * Returns null if `from` is not usable (avoids redirect loops to /login).
 */
export function pathFromRedirectLocation(from) {
  if (!from || typeof from !== 'object' || typeof from.pathname !== 'string') {
    return null;
  }
  const path = `${from.pathname}${from.search || ''}${from.hash || ''}`;
  if (!path || path === '/login' || path.startsWith('/login?')) {
    return null;
  }
  return path;
}
