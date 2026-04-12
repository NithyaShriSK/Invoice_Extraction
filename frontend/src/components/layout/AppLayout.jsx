import React, { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { X } from 'lucide-react';

const titles = {
  '/dashboard': 'Dashboard',
  '/upload': 'Upload invoice',
  '/invoices': 'Invoices',
  '/profile': 'Profile',
  '/admin': 'Admin',
};

function titleFromPath(pathname) {
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith('/invoice/')) return 'Invoice details';
  if (pathname.startsWith('/invoices')) return 'Invoices';
  if (pathname.startsWith('/profile')) return 'Profile';
  return 'InvoiceAI';
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const title = useMemo(() => titleFromPath(pathname), [pathname]);

  return (
    <div className="min-h-screen bg-gray-100">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative ml-0 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-end border-b border-gray-100 px-3">
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:flex-col">
          <Sidebar />
        </aside>

        <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
          <Navbar title={title} onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
