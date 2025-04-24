import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import ServerList from './components/servers/ServerList';
import ServerDetail from './components/servers/ServerDetail';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import AdminDashboard from './components/admin/AdminDashboard';
import ServerForm from './components/admin/ServerForm';
import { useAuth } from './context/AuthContext';
import './App.css';

// Protected route component
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated || (user && user.role !== 'admin')) {
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
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminDashboard />
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
          </Routes>
        </main>
        <footer className="footer mt-5 py-3 bg-light">
          <div className="container text-center">
            <span className="text-muted">Game Server Manager &copy; {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;