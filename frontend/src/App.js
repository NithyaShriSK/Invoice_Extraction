import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import InvoiceDetail from './pages/InvoiceDetail';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        element={(
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        )}
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/invoice/:id" element={<InvoiceDetail />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route
        path="/admin"
        element={(
          <AdminRoute>
            <Layout />
          </AdminRoute>
        )}
      >
        <Route path="dashboard" element={<AdminDashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
