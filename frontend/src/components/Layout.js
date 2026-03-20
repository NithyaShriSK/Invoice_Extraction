import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home,
  FileText,
  History,
  Settings,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
  Shield,
  Camera,
  Upload,
  TrendingUp
} from 'lucide-react';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const userNavigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      current: isActive('/dashboard'),
    },
    {
      name: 'Upload Invoice',
      href: '/dashboard',
      icon: Upload,
      current: isActive('/dashboard'),
      section: 'upload'
    },
    {
      name: 'History',
      href: '/history',
      icon: History,
      current: isActive('/history'),
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: Settings,
      current: isActive('/profile'),
    },
  ];

  const adminNavigation = [
    {
      name: 'Admin Dashboard',
      href: '/admin/dashboard',
      icon: Shield,
      current: isActive('/admin/dashboard'),
    },
    {
      name: 'Users',
      href: '/admin/dashboard',
      icon: Users,
      current: false,
      section: 'users'
    },
    {
      name: 'Analytics',
      href: '/admin/dashboard',
      icon: BarChart3,
      current: false,
      section: 'analytics'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent
            user={user}
            userNavigation={userNavigation}
            adminNavigation={adminNavigation}
            onLogout={handleLogout}
            isMobile={true}
          />
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <SidebarContent
          user={user}
          userNavigation={userNavigation}
          adminNavigation={adminNavigation}
          onLogout={handleLogout}
        />
      </div>

      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top header */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white border-b border-gray-200">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-900">
                Invoice Management System
              </h1>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  Welcome, {user?.profile?.firstName || user?.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({ user, userNavigation, adminNavigation, onLogout, isMobile = false }) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4 mb-8">
          <FileText className="h-8 w-8 text-blue-600" />
          <span className="ml-2 text-xl font-bold text-gray-900">
            InvoiceAI
          </span>
        </div>
        
        <nav className="mt-5 flex-1 px-2 space-y-1">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              User Menu
            </p>
            {userNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  item.current
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md border-l-4 transition-colors duration-150`}
              >
                <item.icon
                  className={`${
                    item.current ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  } mr-3 h-5 w-5`}
                />
                {item.name}
              </Link>
            ))}
          </div>

          {user?.role === 'admin' && (
            <div>
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Admin Menu
              </p>
              {adminNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    item.current
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md border-l-4 transition-colors duration-150`}
                >
                  <item.icon
                    className={`${
                      item.current ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    } mr-3 h-5 w-5`}
                  />
                  {item.name}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </div>
      
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {(user?.profile?.firstName || user?.username || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700">
              {user?.profile?.firstName || user?.username}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role || 'user'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
