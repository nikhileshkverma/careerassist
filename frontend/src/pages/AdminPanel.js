import React, { useState, useEffect } from 'react';
import { adminAPI, feedbackAPI } from '../utils/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AL = { LOGIN:'🔑 Login', REGISTER:'👤 Register', PROFILE_UPDATE:'✏️ Profile Update', CAREER_RECOMMEND:'🎯 Career Match', RESUME_UPLOAD:'📄 Resume Upload', JD_ANALYZE:'🔍 JD Analyze', RESUME_TAILOR:'⚡ AI Tailor', JOBS_VIEW:'💼 Jobs View', JOB_APPLY:'✅ Job Apply', JOB_SUCCESS:'🏆 Got Job!', RESUME_PARSE:'📋 Resume Parse' };
const SS = { pending:'badge-gray', reviewed:'badge-blue', accepted:'badge-green', rejected:'badge-red', planned:'badge-purple' };
const C = ['#00c46a','#6366f1','#f59e0b','#06b6d4','#ef4444','#8b5cf6'];

function HealthGauge({ score }) {
  const color = score >= 75 ? '#00c46a' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
        <svg viewBox="0 0 100 100" width="100" height="100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${score * 2.51} 251`} strokeLinecap="round"
            transform="rotate(-90 50 50)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{score}</div>
          <div style={{ fontSize: 9, color: '#9ca3af' }}>/ 100</div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6, color }}>
        {score >= 75 ? '🟢 Excellent' : score >= 50 ? '🟡 Good' : '🔴 Needs Work'}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tab, setTab] = useState('analytics');
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    Promise.all([adminAPI.stats(), adminAPI.users(), feedbackAPI.adminAll(), adminAPI.getRoles()])
      .then(([s, u, f, r]) => { setData(s.data); setUsers(u.data); setFeedback(f.data); setRoles(r.data); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const updateFeedback = async (id, status) => {
    await feedbackAPI.adminUpdate(id, { status, adminResponse: responseText });
    setFeedback(f => f.map(x => x._id === id ? { ...x, status, adminResponse: responseText } : x));
    setResponding(null); setResponseText('');
  };
  const deleteUser = async id => { if (!window.confirm('Delete user?')) return; await adminAPI.deleteUser(id); setUsers(u => u.filter(x => x._id !== id)); };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  const ov = data?.overview || {};
  const pending = ov.pendingFeedback || 0;
  const dailyData = data?.charts?.dailySignups?.map(d => ({ date: d._id, users: d.count })) || [];
  const jobApplyData = data?.charts?.jobApplyBreakdown?.map(j => ({ name: j._id || 'Unknown', count: j.count })) || [];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>⚙️ Admin Dashboard</h1><p>Platform analytics, users, feedback, and performance</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: ov.aiReady ? '#d1fae5' : '#f3f4f6', fontSize: 12.5, fontWeight: 600, color: ov.aiReady ? '#065f46' : '#6b7280' }}>
          {ov.aiReady ? '🟢 Qwen2.5-14B Active' : '⚪ AI Offline'}
        </div>
      </div>

      <div className="tab-nav">
        <button className={`tab-btn${tab === 'analytics' ? ' active' : ''}`} onClick={() => setTab('analytics')}>📊 Analytics</button>
        <button className={`tab-btn${tab === 'feedback' ? ' active' : ''}`} onClick={() => setTab('feedback')}>
          💬 Feedback Inbox {pending > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 5px', marginLeft: 4 }}>{pending}</span>}
        </button>
        <button className={`tab-btn${tab === 'success' ? ' active' : ''}`} onClick={() => setTab('success')}>🏆 Success Stories</button>
        <button className={`tab-btn${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>👥 Users</button>
        <button className={`tab-btn${tab === 'activity' ? ' active' : ''}`} onClick={() => setTab('activity')}>📋 Activity</button>
      </div>

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <div>
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {[
              { icon: '👥', val: ov.totalUsers || 0, label: 'Total Users', color: '#6366f1', sub: `+${ov.newUsersWeek || 0} this week` },
              { icon: '📋', val: ov.activeProfiles || 0, label: 'Active Profiles', color: '#00c46a', sub: `${ov.totalUsers ? Math.round((ov.activeProfiles / ov.totalUsers) * 100) : 0}% rate` },
              { icon: '✅', val: ov.totalApplied || 0, label: 'Jobs Applied', color: '#f59e0b', sub: 'via platform' },
              { icon: '📄', val: ov.totalResumeActions || 0, label: 'Resume Actions', color: '#06b6d4', sub: 'uploads + edits' },
              { icon: '💼', val: ov.jobsViewed || 0, label: 'Jobs Viewed', color: '#8b5cf6' },
              { icon: '🏆', val: ov.successStories || 0, label: 'Got Jobs!', color: '#00c46a', sub: 'reported' },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div style={{ fontSize: 24, marginBottom: 7 }}>{s.icon}</div>
                <div className="stat-num" style={{ color: s.color }}>{s.val}</div>
                <div className="stat-label">{s.label}</div>
                {s.sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📈 Daily New Users</div>
              {dailyData.length > 0
                ? <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={dailyData}><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="users" stroke="#00c46a" strokeWidth={2} dot={{ r: 3, fill: '#00c46a' }} /></LineChart>
                </ResponsiveContainer>
                : <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No data yet</div>
              }
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🏥 Platform Health</div>
              <HealthGauge score={ov.platformHealthScore || 0} />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Based on users, applications & AI status</div>
            </div>
          </div>

          {jobApplyData.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>✅ Jobs Applied By Company</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={jobApplyData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>{jobApplyData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>💡 Key Metrics</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { label: 'Profile Completion Rate', value: `${ov.totalUsers ? Math.round((ov.activeProfiles / ov.totalUsers) * 100) : 0}%`, icon: '👤' },
                { label: 'Job Application Rate', value: `${ov.totalUsers ? ((ov.totalApplied / Math.max(ov.totalUsers, 1)) * 100).toFixed(1) : 0}%`, icon: '✅' },
                { label: 'Reported Success Rate', value: `${((ov.successStories / Math.max(ov.totalApplied, 1)) * 100).toFixed(1)}%`, icon: '🏆' },
                { label: 'Avg Actions/User', value: `${ov.totalUsers ? Math.round((ov.jobsViewed + ov.totalApplied) / Math.max(ov.totalUsers, 1)) : 0}`, icon: '⚡' },
              ].map((m, i) => (
                <div key={i} style={{ padding: 14, background: '#f9fafb', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 24 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{m.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK */}
      {tab === 'feedback' && (
        <div>
          {feedback.filter(f => f.type !== 'success_story').length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><div style={{ fontSize: 50 }}>💬</div><p style={{ marginTop: 14 }}>No feedback yet</p></div>
            : feedback.filter(f => f.type !== 'success_story').map(item => (
              <div key={item._id} className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${item.status === 'pending' ? '#ef4444' : '#e5e7eb'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{item.userId?.name || 'Unknown'}</div>
                    <div style={{ fontSize: 11.5, color: '#9ca3af' }}>{item.userId?.email} · {item.type} · {new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={`badge ${SS[item.status] || 'badge-gray'}`}>{item.status}</span>
                </div>
                <p style={{ fontSize: 13, marginBottom: 10 }}>{item.description}</p>
                {item.adminResponse && <div style={{ padding: 10, background: '#ede9fe', borderRadius: 8, marginBottom: 10, fontSize: 12.5 }}><strong style={{ color: '#6366f1' }}>Response: </strong>{item.adminResponse}</div>}
                {responding === item._id
                  ? <div>
                    <textarea className="form-control" rows={2} value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Write response..." style={{ marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['reviewed', 'accepted', 'rejected', 'planned'].map(s => (
                        <button key={s} onClick={() => updateFeedback(item._id, s)} className={`btn btn-sm ${s === 'accepted' ? 'btn-success' : s === 'rejected' ? 'btn-danger' : 'btn-secondary'}`}>Mark {s}</button>
                      ))}
                      <button onClick={() => setResponding(null)} className="btn btn-ghost btn-sm">Cancel</button>
                    </div>
                  </div>
                  : <button className="btn btn-accent btn-sm" onClick={() => { setResponding(item._id); setResponseText(item.adminResponse || ''); }}>💬 Respond</button>
                }
              </div>
            ))}
        </div>
      )}

      {/* SUCCESS STORIES */}
      {tab === 'success' && (
        <div>
          <div className="alert alert-success" style={{ marginBottom: 14 }}>🏆 <strong>{ov.successStories || 0} users</strong> reported getting jobs through CareerAssist!</div>
          {(data?.successStoriesData || []).length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <div style={{ fontSize: 50 }}>🏆</div>
              <p style={{ marginTop: 14 }}>No success stories yet. Users can report via Feedback → "I Got a Job!"</p>
            </div>
            : (data?.successStoriesData || []).map((s, i) => (
              <div key={i} className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${s.isPublished ? '#00c46a' : '#e5e7eb'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{s.userId?.name?.[0] || '?'}</div>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{s.userId?.name || 'Anonymous'}</span>
                        {s.isPublished && <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>🌐 Published</span>}
                      </div>
                      <p style={{ fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 1.6 }}>{s.description}</p>
                      <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 4 }}>{new Date(s.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <button
                    className={`btn btn-sm ${s.isPublished ? 'btn-secondary' : 'btn-primary'}`}
                    style={s.isPublished ? {} : { background:'#00c46a', borderColor:'#00c46a' }}
                    onClick={async () => {
                      const next = !s.isPublished;
                      await feedbackAPI.adminPublish(s._id, next);
                      // Refresh stories data
                      const fresh = await adminAPI.stats();
                      setData(fresh.data);
                    }}
                  >
                    {s.isPublished ? '📥 Unpublish' : '🌐 Publish to All Users'}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 14 }}>👥 Users ({users.length})</h3>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Skills</th><th>Resumes</th><th>Logins</th><th>Jobs Applied</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{u.email}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-green'}`}>{u.role}</span></td>
                  <td>{u.skills?.length || 0}</td>
                  <td>{u.resumes?.length || 0}</td>
                  <td>{u.stats?.logins || 0}</td>
                  <td style={{ fontWeight: u.stats?.jobApps > 0 ? 700 : 400, color: u.stats?.jobApps > 0 ? '#00c46a' : 'inherit' }}>{u.stats?.jobApps || 0}</td>
                  <td style={{ color: '#9ca3af', fontSize: 11 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>{u.role !== 'admin' && <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u._id)}>Del</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ACTIVITY */}
      {tab === 'activity' && (
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 14 }}>📋 Activity Log</h3>
          <table className="data-table">
            <thead><tr><th>Action</th><th>User</th><th>Email</th><th>Time</th></tr></thead>
            <tbody>
              {(data?.recentActivity || []).map((a, i) => (
                <tr key={i}>
                  <td>{AL[a.action] || a.action}</td>
                  <td style={{ fontWeight: 500 }}>{a.userId?.name || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{a.userId?.email || '—'}</td>
                  <td style={{ color: '#9ca3af', fontSize: 11 }}>{new Date(a.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
