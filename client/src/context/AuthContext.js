import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state from local storage
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Verify token by fetching current user
          const res = await axios.get('/api/auth/current');
          
          if (res.data.user) {
            setUser(res.data.user);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Auth initialization error:', err);
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Register new user
  const register = async (userData) => {
    try {
      setError(null);
      const res = await axios.post('/api/auth/register', userData);
      
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        setUser(res.data.user);
        setIsAuthenticated(true);
      }

      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    }
  };

  // Login user
  const login = async (userData) => {
    try {
      setError(null);
      const res = await axios.post('/api/auth/login', userData);
      
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        setUser(res.data.user);
        setIsAuthenticated(true);
      }

      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    }
  };

  // Logout user
  const logout = async () => {
    try {
      await axios.get('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        error,
        register,
        login,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};