import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  LOAD_USER_SUCCESS: 'LOAD_USER_SUCCESS',
  LOAD_USER_FAILURE: 'LOAD_USER_FAILURE',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
      };
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOAD_USER_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOAD_USER_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case AUTH_ACTIONS.UPDATE_PROFILE:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      if (state.token) {
        try {
          const response = await authAPI.getProfile();
          dispatch({
            type: AUTH_ACTIONS.LOAD_USER_SUCCESS,
            payload: { user: response.user },
          });
        } catch (error) {
          console.error('Failed to load user:', error);
          localStorage.removeItem('token');
          dispatch({
            type: AUTH_ACTIONS.LOAD_USER_FAILURE,
          });
        }
      } else {
        dispatch({
          type: AUTH_ACTIONS.LOAD_USER_FAILURE,
        });
      }
    };

    loadUser();
  }, [state.token]);

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });
      const response = await authAPI.login(credentials);
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user: response.user, token: response.token },
      });
      
      toast.success('Login successful!');
      return response;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  // Signup function
  const signup = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });
      const response = await authAPI.signup(userData);
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user: response.user, token: response.token },
      });
      
      toast.success('Registration successful!');
      return response;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });
      toast.error(error.message || 'Registration failed');
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      toast.success('Logged out successfully');
    }
  };

  // Update profile function
  const updateProfile = async (profileData) => {
    try {
      const response = await authAPI.updateProfile(profileData);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE,
        payload: response.user,
      });
      
      toast.success('Profile updated successfully!');
      return response;
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
      throw error;
    }
  };

  // Change password function
  const changePassword = async (passwordData) => {
    try {
      const response = await authAPI.changePassword(passwordData);
      toast.success('Password changed successfully!');
      return response;
    } catch (error) {
      toast.error(error.message || 'Failed to change password');
      throw error;
    }
  };

  const value = {
    ...state,
    login,
    signup,
    logout,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
