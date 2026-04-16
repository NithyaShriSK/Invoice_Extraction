import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-primary text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">
          📄 Invoice OCR
        </Link>
        
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm">{user.email}</span>
            {user.is_admin && (
              <Link to="/admin" className="px-3 py-1 bg-accent rounded hover:bg-opacity-80">
                Admin
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-600 rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export const Loading = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

export const ErrorAlert = ({ message, onClose }) => (
  <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded shadow-lg">
    <div className="flex justify-between items-center">
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 font-bold">✕</button>
    </div>
  </div>
);

export const SuccessAlert = ({ message, onClose }) => (
  <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded shadow-lg">
    <div className="flex justify-between items-center">
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 font-bold">✕</button>
    </div>
  </div>
);

export const Button = ({ children, className = '', ...props }) => (
  <button
    className={`px-4 py-2 bg-primary text-white rounded hover:bg-secondary transition ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
    {children}
  </div>
);
