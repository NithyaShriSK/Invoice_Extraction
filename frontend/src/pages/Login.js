import React, { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthAlert } from '../components/auth/AuthAlert';
import { validateLoginFields } from '../utils/validateAuthForms';
import { getApiErrorMessage } from '../utils/parseApiError';
import { pathFromRedirectLocation } from '../utils/redirectPath';
import { Eye, EyeOff, FileText, Lock, Mail } from 'lucide-react';

const DEFAULT_AFTER_LOGIN = '/dashboard';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const { login, isAuthenticated, isLoading, isSubmitting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /** Persists intended route across auth-driven re-renders; `location.state` may be missing on later renders. */
  const postLoginPathRef = useRef(DEFAULT_AFTER_LOGIN);
  const prevLoginLocationKeyRef = useRef(undefined);

  const incomingRedirect = pathFromRedirectLocation(location.state?.from);
  const isNewHistoryEntry =
    prevLoginLocationKeyRef.current !== undefined &&
    prevLoginLocationKeyRef.current !== location.key;

  if (incomingRedirect) {
    postLoginPathRef.current = incomingRedirect;
  } else if (isNewHistoryEntry) {
    postLoginPathRef.current = DEFAULT_AFTER_LOGIN;
  }

  prevLoginLocationKeyRef.current = location.key;

  const getPostLoginPath = () => postLoginPathRef.current || DEFAULT_AFTER_LOGIN;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getPostLoginPath()} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const trimmed = {
      email: formData.email.trim(),
      password: formData.password,
    };
    const validation = validateLoginFields(trimmed);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }

    try {
      const res = await login(trimmed);
      if (res?.token) {
        navigate(getPostLoginPath(), { replace: true, state: {} });
      }
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  };

  const busy = isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-indigo-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-md">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
              <FileText className="h-7 w-7 text-indigo-600" aria-hidden />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Welcome back — use your email and password to continue
            </p>
          </div>

          <AuthAlert type="error">{apiError}</AuthAlert>
          {apiError ? <div className="h-4" /> : null}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input rounded-xl pl-10 ${fieldErrors.email ? 'border-red-300 focus:ring-red-500' : ''}`}
                  placeholder="you@company.com"
                  disabled={busy}
                />
              </div>
              {fieldErrors.email ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`input rounded-xl pl-10 pr-10 ${fieldErrors.password ? 'border-red-300 focus:ring-red-500' : ''}`}
                  placeholder="••••••••"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {fieldErrors.password ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
