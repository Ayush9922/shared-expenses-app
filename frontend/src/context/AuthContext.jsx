import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Configure backend API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
axios.defaults.baseURL = API_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Set Authorization header for all Axios requests
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      
      // Decrypt/Extract user info from token (we will just fetch it or decode it)
      // For simplicity, we also store the user details in local storage
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error("Error parsing stored user", e);
        }
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
    setLoading(false);
  }, [token]);

  // Axios Interceptor to catch 401/403 errors and auto-logout
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          // Token expired or invalid, trigger logout
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      const { user: userData, token: userToken } = response.data;
      
      localStorage.setItem('user', JSON.stringify(userData));
      setToken(userToken);
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error("Login request error:", error);
      let errMsg = 'Login failed. Please check your credentials.';
      if (error.message === 'Network Error') {
        errMsg = `Network Error: Cannot connect to backend server. Verify that VITE_API_URL is configured on Vercel. Calling: ${axios.defaults.baseURL}`;
      } else if (error.response?.data?.error) {
        errMsg = error.response.data.error;
      }
      return {
        success: false,
        error: errMsg
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await axios.post('/auth/register', { name, email, password });
      const { user: userData, token: userToken } = response.data;

      localStorage.setItem('user', JSON.stringify(userData));
      setToken(userToken);
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error("Register request error:", error);
      let errMsg = 'Registration failed.';
      if (error.message === 'Network Error') {
        errMsg = `Network Error: Cannot connect to backend. Verify VITE_API_URL. Calling: ${axios.defaults.baseURL}`;
      } else if (error.response?.data?.error) {
        errMsg = error.response.data.error;
      }
      return {
        success: false,
        error: errMsg
      };
    }
  };


  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
