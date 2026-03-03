import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/admin/stats'),
      axios.get('/api/admin/users'),
      axios.get('/api/admin/activity'),
    ]).then(([s, u, a]) => {
      setStats(s.data); setUsers(u.data); setActivity(a.data);
    }).finally(() => setLoading(false));
  }, []);

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user permanently?')) return;
    await axios.delete(`/api/admin/users/${id}`);
    setUsers(users.filter(u => u.id !== id));
    setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
  };

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  const ACTION_LABELS = { LOGIN: '🔑 Login', REGISTER: '👤 Register', PROFILE_UPDATE: '✏️ Profile Update', CAREER_RECOMMEND: '🎯 Career Recommend', RESUME_UPLOAD: '📄 Resume Upload' };

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Admin Control Panel</h1>
        <p>Platform governance, user management, and analytics</p>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card"><div style={{ fontSize: 28 }}>👥</div><div className="stat-value" style={{ color: '#4f46e5' }}>{stats.totalUsers}</div><div className="stat-label">Total Users</div></div>
          <div className="stat-card"><div style={{ fontSize: 28 }}>📋</div><div className="stat-value" style={{ color: '#06b6d4' }}>{stats.totalProfiles}</div><div className="stat-label">Profiles Created</div></div>
          <div className="stat-card"><div style={{ fontSize: 28 }}>🎯</div><div className="stat-value" style={{ color: '#10b981' }}>{stats.totalRecommendations}</div><div className="stat-label">Recommendations</div></div>
          <div className="stat-card"><div style={{ fontSize: 28 }}>📄</div><div className="stat-value" style={{ color: '#f59e0b' }}>{stats.totalResumes}</div><div className="stat-label">Resume Reviews</div></div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
        {['overview', 'users', 'activity'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              borderBottom: tab === t ? '2px solid #4f46e5' : '2px solid transparent',
              color: tab === t ? '#4f46e5' : '#64748b' }}>
            {t === 'overview' ? '📊 Overview' : t === 'users' ? '👥 Users' : '📋 Activity Log'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>📈 Recent Activity</h3>
          {activity.slice(0, 10).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>
              <span>{ACTION_LABELS[a.action] || a.action}</span>
              <span style={{ color: '#94a3b8' }}>by</span>
              <span style={{ fontWeight: 600 }}>{a.name || 'Unknown'}</span>
              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }}>{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>👥 Registered Users</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.email}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-success'}`}>{u.role}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {u.role !== 'admin' && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'activity' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>📋 Full Activity Log</h3>
          {activity.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ width: 150 }}>{ACTION_LABELS[a.action] || a.action}</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>{a.name || 'Unknown'}</span>
              <span style={{ color: '#94a3b8' }}>{a.email}</span>
              <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
