import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AUTH_TOKEN_KEY } from '../constants/authStorage';
import { useRedirectIfJwtExpired } from '../hooks/useRedirectIfJwtExpired';

/**
 * Requires a JWT in localStorage and a loaded authenticated session.
 * Redirects to /login when missing, preserving the attempted location for post-login redirect.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  useRedirectIfJwtExpired();

  const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div
          className="h-12 w-12 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
          aria-label="Checking session"
        />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;
