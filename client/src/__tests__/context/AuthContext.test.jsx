import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import axios from 'axios';

// Mock axios
jest.mock('axios');

// Helper component to test the context
const TestComponent = () => {
  const { user, isAuthenticated, loading, login, logout } = useAuth();
  
  const handleLogin = async () => {
    try {
      await login({ username: 'testuser', password: 'password' });
    } catch (error) {
      // Error handled by context
    }
  };
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user-name">{user ? user.username : 'no-user'}</div>
      <button onClick={handleLogin}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
  });

  describe('Initial state', () => {
    it('should start in loading state and then load', async () => {
      axios.get.mockResolvedValue({ data: { user: null } });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });
    });

    it('should initialize as not authenticated when no token', async () => {
      axios.get.mockResolvedValue({ data: { user: null } });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });
      
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user-name')).toHaveTextContent('no-user');
    });

    it('should restore auth state from localStorage', async () => {
      localStorage.setItem('token', 'test-token');
      axios.get.mockResolvedValue({
        data: {
          user: { id: '1', username: 'testuser', role: 'user' }
        }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });
      
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-name')).toHaveTextContent('testuser');
      expect(axios.defaults.headers.common['Authorization']).toBe('Bearer test-token');
    });

    it('should clear invalid token from localStorage', async () => {
      localStorage.setItem('token', 'invalid-token');
      axios.get.mockRejectedValue(new Error('Unauthorized'));
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });
      
      expect(localStorage.getItem('token')).toBeNull();
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });
  });

  describe('login', () => {
    it('should authenticate user on successful login', async () => {
      axios.get.mockResolvedValue({ data: { user: null } });
      axios.post.mockResolvedValue({
        data: {
          token: 'new-token',
          user: { id: '1', username: 'testuser', role: 'user' }
        }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });
      
      await act(async () => {
        screen.getByText('Login').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });
      
      expect(screen.getByTestId('user-name')).toHaveTextContent('testuser');
      expect(localStorage.getItem('token')).toBe('new-token');
      expect(axios.defaults.headers.common['Authorization']).toBe('Bearer new-token');
    });

    it('should handle login failure', async () => {
      axios.get.mockResolvedValue({ data: { user: null } });
      axios.post.mockRejectedValue({
        response: { data: { message: 'Invalid credentials' } }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });
      
      // Login button click handles error internally
      await act(async () => {
        screen.getByText('Login').click();
      });
      
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalled();
      });
      
      // Should still be not authenticated
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });
  });

  describe('logout', () => {
    it('should clear auth state and localStorage', async () => {
      localStorage.setItem('token', 'test-token');
      axios.get.mockResolvedValue({
        data: {
          user: { id: '1', username: 'testuser', role: 'user' }
        }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });
      
      await act(async () => {
        screen.getByText('Logout').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      });
      
      expect(screen.getByTestId('user-name')).toHaveTextContent('no-user');
      expect(localStorage.getItem('token')).toBeNull();
      expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
    });

    it('should logout even if API call fails', async () => {
      localStorage.setItem('token', 'test-token');
      axios.get.mockResolvedValueOnce({
        data: {
          user: { id: '1', username: 'testuser', role: 'user' }
        }
      }).mockRejectedValueOnce(new Error('Network error'));
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      });
      
      await act(async () => {
        screen.getByText('Logout').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      });
      
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
});
