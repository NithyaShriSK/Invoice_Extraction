import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Lock,
  Building,
  Phone,
  Settings,
  Eye,
  EyeOff,
  Save
} from 'lucide-react';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    profile: {
      firstName: user?.profile?.firstName || '',
      lastName: user?.profile?.lastName || '',
      phone: user?.profile?.phone || '',
      company: user?.profile?.company || '',
    },
    preferences: {
      emailNotifications: user?.preferences?.emailNotifications !== false,
      theme: user?.preferences?.theme || 'light',
      language: user?.preferences?.language || 'en',
    }
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setProfileData({
        ...profileData,
        [parent]: {
          ...profileData[parent],
          [child]: value,
        },
      });
    } else {
      setProfileData({
        ...profileData,
        [field]: value,
      });
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData({
      ...passwordData,
      [field]: value,
    });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      await updateProfile(profileData);
      toast.success('Profile updated successfully!');
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsUpdating(true);

    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      
      // Reset form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      toast.success('Password changed successfully!');
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
          >
            <User className="h-4 w-4 inline mr-2" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`${
              activeTab === 'security'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
          >
            <Lock className="h-4 w-4 inline mr-2" />
            Security
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`${
              activeTab === 'preferences'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
          >
            <Settings className="h-4 w-4 inline mr-2" />
            Preferences
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Personal Information</h3>
            <p className="card-description">
              Update your personal information and contact details
            </p>
          </div>
          <div className="card-content">
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={user?.username || ''}
                    disabled
                    className="input bg-gray-50"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Username cannot be changed
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="input bg-gray-50"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Contact support to change email
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileData.profile.firstName}
                    onChange={(e) => handleProfileChange('profile.firstName', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileData.profile.lastName}
                    onChange={(e) => handleProfileChange('profile.lastName', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profileData.profile.phone}
                    onChange={(e) => handleProfileChange('profile.phone', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={profileData.profile.company}
                    onChange={(e) => handleProfileChange('profile.company', e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="btn btn-primary"
                >
                  {isUpdating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Change Password</h3>
            <p className="card-description">
              Update your password to keep your account secure
            </p>
          </div>
          <div className="card-content">
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                    className="input pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                    className="input pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 6 characters long
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                    className="input pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="btn btn-primary"
                >
                  {isUpdating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Notification Preferences</h3>
              <p className="card-description">
                Manage how you receive notifications
              </p>
            </div>
            <div className="card-content">
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="emailNotifications" className="text-sm font-medium text-gray-900">
                      Email Notifications
                    </label>
                    <p className="text-sm text-gray-500">
                      Receive email notifications when invoices are processed
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={profileData.preferences.emailNotifications}
                    onChange={(e) => handleProfileChange('preferences.emailNotifications', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="btn btn-primary"
                  >
                    {isUpdating ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Preferences
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Account Information</h3>
              <p className="card-description">
                Your account details and status
              </p>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Account Type</p>
                    <p className="text-sm text-gray-500">Your role in the system</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                    {user?.role || 'user'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Account Status</p>
                    <p className="text-sm text-gray-500">Current status of your account</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Member Since</p>
                    <p className="text-sm text-gray-500">When you joined the platform</p>
                  </div>
                  <span className="text-sm text-gray-900">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
