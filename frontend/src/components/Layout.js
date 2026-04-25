import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { feedbackAPI, careerAPI, notifAPI } from '../utils/api';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);
  const [aiReady, setAiReady] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') feedbackAPI.adminStats().then(r => setPending(r.data.pending || 0)).catch(() => {});
    careerAPI.aiStatus().then(r => setAiReady(r.data.ready || false)).catch(() => {});
    // Poll for notifications every 30s
    const loadNotifs = () => {
      notifAPI.unreadCount().then(r => setNotifCount(r.data.count || 0)).catch(() => {});
    };
    loadNotifs();
    const timer = setInterval(loadNotifs, 30000);
    return () => clearInterval(timer);
  }, [user]);

  const openNotifs = async () => {
    if (!showNotifs) {
      const r = await notifAPI.getAll().catch(() => ({ data: [] }));
      setNotifs(r.data || []);
      await notifAPI.readAll().catch(() => {});
      setNotifCount(0);
    }
    setShowNotifs(v => !v);
  };

  const nav = [
    { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { to: '/jobs', icon: '💼', label: 'Jobs' },
    { to: '/events', icon: '🎪', label: 'Events' },
    { to: '/resume', icon: '📄', label: 'Resume' },
    { to: '/profile', icon: '👤', label: 'Profile' },
    { to: '/career', icon: '🎯', label: 'Career Counselor' },
    { to: '/feedback', icon: '💬', label: 'Feedback' },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🎓</div>
          <div>
            <div className="sidebar-logo-text">CareerAssist</div>
          </div>
          <span className="sidebar-logo-badge">v5</span>
        </div>

        <nav className="sidebar-nav">
          {nav.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.to === '/resume' && user?.resumes?.length > 0 && (
                <span className="item-dot" />
              )}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="sidebar-section" style={{ marginTop: 16 }}>Admin</div>
              <NavLink to="/admin" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                <span style={{ fontSize: 16 }}>⚙️</span>
                <span>Admin Panel</span>
                {pending > 0 && <span className="item-badge">{pending}</span>}
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {/* AI Status */}
          <div style={{ padding: '8px 10px', marginBottom: 8, borderRadius: 8, background: aiReady ? '#d1fae5' : '#f3f4f6', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            {aiReady ? <><span className="ai-ready-dot" /><span style={{ color: '#065f46', fontWeight: 600 }}>Qwen2.5-14B Active</span></> : <><span style={{ color: '#6b7280' }}>🤖 AI: Rule-based</span></>}
          </div>
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#f9fafb' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }} style={{ padding: '4px 8px', fontSize: 11 }}>Out</button>
          </div>

        </div>
      </aside>

      <div className="main-area">
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
