import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const icons = {
  dashboard: '🏠', profile: '👤', recommendations: '🎯',
  resume: '📄', admin: '⚙️', logout: '🚪'
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div>
      <nav className="navbar">
        <a href="/dashboard" className="navbar-brand">
          <span>🎓</span> CareerAssist
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="nav-user">👤 {user?.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            {icons.logout} Logout
          </button>
        </div>
      </nav>
      <div className="main-layout">
        <aside className="sidebar">
          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '0 14px' }}>
            Navigation
          </div>
          <NavLink to="/dashboard" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            {icons.dashboard} Dashboard
          </NavLink>
          <NavLink to="/profile" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            {icons.profile} My Profile
          </NavLink>
          <NavLink to="/recommendations" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            {icons.recommendations} Career Matches
          </NavLink>
          <NavLink to="/resume" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
            {icons.resume} Resume Feedback
          </NavLink>
          {user?.role === 'admin' && (
            <>
              <div style={{ margin: '16px 0 8px', borderTop: '1px solid #e2e8f0', paddingTop: 16, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '16px 14px 8px' }}>
                Admin
              </div>
              <NavLink to="/admin" className={({isActive}) => `sidebar-item ${isActive ? 'active' : ''}`}>
                {icons.admin} Admin Panel
              </NavLink>
            </>
          )}
        </aside>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
