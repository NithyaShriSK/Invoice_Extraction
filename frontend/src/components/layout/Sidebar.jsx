import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Upload,
  FileStack,
  Shield,
  FileText,
} from 'lucide-react';
import { cn } from '../../utils/cn';

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/upload', label: 'Upload', icon: Upload, end: false },
  { to: '/invoices', label: 'My Invoices', icon: FileStack, end: false },
];

const adminNav = [{ to: '/admin', label: 'Admin', icon: Shield, end: false }];

export function Sidebar({ onNavigate = () => {} }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex h-full flex-col border-r border-gray-200/80 bg-white">
      <div className="flex h-16 shrink-0 items-center gap-2 px-5 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">InvoiceAI</p>
          <p className="text-xs text-gray-500">Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Workspace
          </p>
          <div className="space-y-0.5">
            {mainNav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        isActive ? 'text-indigo-600' : 'text-gray-400'
                      )}
                      aria-hidden
                    />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Administration
            </p>
            <div className="space-y-0.5">
              {adminNav.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'h-5 w-5 shrink-0',
                          isActive ? 'text-indigo-600' : 'text-gray-400'
                        )}
                        aria-hidden
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
