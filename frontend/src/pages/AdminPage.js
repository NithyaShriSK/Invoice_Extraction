import React, { useState } from 'react';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { ManageUsers } from '../components/admin/ManageUsers';
import { Button, Card } from '../components/common/Common';

export const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex gap-2 mb-6 border-b">
        <Button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-t ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'bg-gray-200'}`}
        >
          📊 Dashboard
        </Button>
        <Button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-t ${activeTab === 'users' ? 'bg-primary text-white' : 'bg-gray-200'}`}
        >
          👥 Users
        </Button>
      </div>
      
      <div >
        {activeTab === 'dashboard' && <AdminDashboard />}
        {activeTab === 'users' && <ManageUsers />}
      </div>
    </div>
  );
};
