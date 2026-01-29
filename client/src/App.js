import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import ServerList from './components/servers/ServerList';
import ServerDetail from './components/servers/ServerDetail';
import ModsBrowser from './components/servers/ModsBrowser';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Profile from './components/auth/Profile';
import ServerForm from './components/admin/ServerForm';
import UserManagement from './components/admin/UserManagement';
import FileBrowser from './components/admin/FileBrowser';
import ComposeList from './components/admin/ComposeList';
import ComposeEditor from './components/admin/ComposeEditor';
import { useAuth } from './context/AuthContext';
import './App.css';


// Protected route component
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '40vh' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated || (user && user.role !== 'admin')) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Protected route for authenticated users
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const App = () => {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="container mt-4">
          <Routes>
            {/* Redirect root to servers page */}
            <Route path="/" element={<Navigate to="/servers" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/servers" element={<ServerList />} />
            <Route path="/servers/:id" element={<ServerDetail />} />
            <Route path="/servers/:id/mods" element={<ModsBrowser />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/servers/new" 
              element={
                <AdminRoute>
                  <ServerForm />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/servers/edit/:id" 
              element={
                <AdminRoute>
                  <ServerForm />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/servers/:id/files" 
              element={
                <AdminRoute>
                  <FileBrowser />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/compose" 
              element={
                <AdminRoute>
                  <ComposeList />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/compose/new" 
              element={
                <AdminRoute>
                  <ComposeEditor />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/compose/:id" 
              element={
                <AdminRoute>
                  <ComposeEditor />
                </AdminRoute>
              } 
            />
          </Routes>
        </main>
        <footer className="footer mt-5 py-3">
          <div className="container text-center">
            <span className="text-muted" style={{ color: 'var(--text-muted)' }}>
              <a 
                href="https://github.com/michaelsstuff/gsm" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
              >
                Game Server Manager
              </a>
              {' · '}
              Licensed under the{' '}
              <a 
                href="https://github.com/michaelsstuff/gsm/blob/master/LICENSE" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
              >
                Apache License 2.0
              </a>
            </span>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;