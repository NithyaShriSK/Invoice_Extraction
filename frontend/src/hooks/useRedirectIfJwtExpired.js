import { useLayoutEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AUTH_TOKEN_KEY } from '../constants/authStorage';
import { isJwtExpired } from '../utils/jwt';

/**
 * Clears session and redirects to login when the stored JWT is past `exp`
 * (client-side check; server may still reject earlier/later).
 */
export function useRedirectIfJwtExpired() {
  const { isLoading, invalidateSession } = useAuth();

  useLayoutEffect(() => {
    if (isLoading) return;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token && isJwtExpired(token)) {
      invalidateSession({ reason: 'expired' });
    }
  }, [isLoading, invalidateSession]);
}
