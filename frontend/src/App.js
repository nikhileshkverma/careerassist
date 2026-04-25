import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';
import { Login, Register } from './pages/Auth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import CareerCounselor from './pages/CareerCounselor';
import ResumeManager from './pages/ResumeManager';
import Jobs from './pages/Jobs';
import FeedbackPage from './pages/FeedbackPage';
import Events from './pages/Events';
import AdminPanel from './pages/AdminPanel';

function Guard({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="career" element={<CareerCounselor />} />
            <Route path="resume" element={<ResumeManager />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="events" element={<Events />} />
            <Route path="feedback" element={<FeedbackPage />} />
          </Route>
          <Route path="/admin/*" element={<Guard admin><Layout /></Guard>}>
            <Route index element={<AdminPanel />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
