import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, setUnauthorizedHandler } from '../services/api';
import toast from 'react-hot-toast';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../constants/authStorage';

const initialState = {
  user: null,
  token: localStorage.getItem(AUTH_TOKEN_KEY),
  isAuthenticated: false,
  isLoading: true,
  isSubmitting: false,
};

const AUTH_ACTIONS = {
  AUTH_SUBMIT_START: 'AUTH_SUBMIT_START',
  AUTH_SUBMIT_END: 'AUTH_SUBMIT_END',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  LOAD_USER_SUCCESS: 'LOAD_USER_SUCCESS',
  LOAD_USER_FAILURE: 'LOAD_USER_FAILURE',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
};

const clearedSessionState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isSubmitting: false,
  isLoading: false,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.AUTH_SUBMIT_START:
      return { ...state, isSubmitting: true };
    case AUTH_ACTIONS.AUTH_SUBMIT_END:
      return { ...state, isSubmitting: false };
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isSubmitting: false,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGOUT:
    case AUTH_ACTIONS.SESSION_EXPIRED:
      return { ...state, ...clearedSessionState };
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
        ...clearedSessionState,
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

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(authReducer, initialState);

  const invalidateSession = useCallback(
    ({ reason = 'unauthorized' } = {}) => {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      dispatch({ type: AUTH_ACTIONS.SESSION_EXPIRED });
      if (reason === 'expired') {
        toast.error('Your session has expired. Please sign in again.');
      } else if (reason === 'unauthorized') {
        toast.error('Your session is no longer valid. Please sign in again.');
      }
      navigate('/login', { replace: true, state: { sessionExpired: true } });
    },
    [navigate]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      invalidateSession({ reason: 'unauthorized' });
    });
    return () => setUnauthorizedHandler(() => {});
  }, [invalidateSession]);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        dispatch({ type: AUTH_ACTIONS.LOAD_USER_FAILURE });
        return;
      }
      try {
        const response = await authAPI.getProfile();
        dispatch({
          type: AUTH_ACTIONS.LOAD_USER_SUCCESS,
          payload: { user: response.user },
        });
      } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        dispatch({ type: AUTH_ACTIONS.LOAD_USER_FAILURE });
      }
    };

    loadUser();
  }, []);

  const persistSession = (token, user) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  };

  const login = async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.AUTH_SUBMIT_START });
    try {
      const response = await authAPI.login(credentials);
      const token = response.token;
      const user = response.user;
      if (!token || !user) {
        throw new Error('Invalid response from server');
      }
      persistSession(token, user);
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, token },
      });
      toast.success('Signed in successfully');
      return response;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.AUTH_SUBMIT_END });
      throw error;
    }
  };

  const signup = async (userData) => {
    dispatch({ type: AUTH_ACTIONS.AUTH_SUBMIT_START });
    try {
      const response = await authAPI.signup(userData);
      const token = response.token;
      const user = response.user;
      if (!token || !user) {
        throw new Error('Invalid response from server');
      }
      persistSession(token, user);
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, token },
      });
      toast.success('Account created successfully');
      return response;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.AUTH_SUBMIT_END });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      toast.success('Signed out');
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authAPI.updateProfile(profileData);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.user));
      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE,
        payload: response.user,
      });
      toast.success('Profile updated successfully');
      return response;
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
      throw error;
    }
  };

  const changePassword = async (passwordData) => {
    try {
      await authAPI.changePassword(passwordData);
      toast.success('Password changed successfully');
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
    invalidateSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
