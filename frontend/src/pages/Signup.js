import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthAlert } from '../components/auth/AuthAlert';
import { validateSignupFields } from '../utils/validateAuthForms';
import { getApiErrorMessage } from '../utils/parseApiError';
import { Eye, EyeOff, FileText, Lock, Mail, User } from 'lucide-react';

const Signup = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    profile: {
      firstName: '',
      lastName: '',
      phone: '',
      company: '',
    },
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const { signup, isAuthenticated, isLoading, isSubmitting } = useAuth();
  const navigate = useNavigate();

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
    return <Navigate to="/dashboard" replace />;
  }

  const clearFieldError = (name) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setApiError('');

    if (name.startsWith('profile.')) {
      const child = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        profile: { ...prev.profile, [child]: value },
      }));
      clearFieldError(name);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      clearFieldError(name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const validation = validateSignupFields(formData);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }

    const { confirmPassword, ...signupData } = formData;
    const payload = {
      ...signupData,
      username: signupData.username.trim(),
      email: signupData.email.trim(),
      profile: {
        ...signupData.profile,
        firstName: signupData.profile.firstName.trim() || undefined,
        lastName: signupData.profile.lastName.trim() || undefined,
        phone: signupData.profile.phone.trim() || undefined,
        company: signupData.profile.company.trim() || undefined,
      },
    };

    try {
      const res = await signup(payload);
      if (res?.token) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  };

  const busy = isSubmitting;

  const inputError = (name) =>
    fieldErrors[name] ? 'border-red-300 focus:ring-red-500' : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-indigo-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-md">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
              <FileText className="h-7 w-7 text-indigo-600" aria-hidden />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
              Create account
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Sign up to manage and extract invoice data with AI
            </p>
          </div>

          <AuthAlert type="error">{apiError}</AuthAlert>
          {apiError ? <div className="h-4" /> : null}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`input rounded-xl pl-10 ${inputError('username')}`}
                  placeholder="johndoe"
                  disabled={busy}
                />
              </div>
              {fieldErrors.username ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
              ) : null}
            </div>

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
                  className={`input rounded-xl pl-10 ${inputError('email')}`}
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
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`input rounded-xl pl-10 pr-10 ${inputError('password')}`}
                  placeholder="At least 6 characters"
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

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`input rounded-xl pl-10 pr-10 ${inputError('confirmPassword')}`}
                  placeholder="Repeat password"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {fieldErrors.confirmPassword ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
                  First name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="firstName"
                  name="profile.firstName"
                  type="text"
                  value={formData.profile.firstName}
                  onChange={handleChange}
                  className="input rounded-xl"
                  disabled={busy}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
                  Last name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="lastName"
                  name="profile.lastName"
                  type="text"
                  value={formData.profile.lastName}
                  onChange={handleChange}
                  className="input rounded-xl"
                  disabled={busy}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
