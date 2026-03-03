import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [resumeHistory, setResumeHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/profile'),
      axios.get('/api/career/recommendations'),
      axios.get('/api/resume/history'),
    ]).then(([p, r, res]) => {
      setProfile(p.data);
      setRecommendations(r.data.slice(0, 5));
      setResumeHistory(res.data.slice(0, 3));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  const chartData = recommendations.map(r => ({ name: r.career_title.split(' ').slice(0, 2).join(' '), score: r.match_score }));
  const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div>
      <div className="page-header">
        <h1>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p>Here's your career guidance overview</p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
          <div className="stat-value" style={{ color: '#4f46e5' }}>{profile ? '✓' : '—'}</div>
          <div className="stat-label">Profile Status</div>
          {!profile && <Link to="/profile" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Complete Profile</Link>}
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{recommendations.length}</div>
          <div className="stat-label">Career Matches</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{resumeHistory.length}</div>
          <div className="stat-label">Resume Reviews</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>
            {recommendations[0]?.match_score || '—'}%
          </div>
          <div className="stat-label">Top Career Match</div>
        </div>
      </div>

      {/* Quick Actions */}
      {!profile && (
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #ede9fe, #e0f2fe)', border: '1px solid #c7d2fe' }}>
          <h3 style={{ marginBottom: 8 }}>🚀 Get Started</h3>
          <p style={{ color: '#64748b', marginBottom: 16 }}>Complete your career profile to receive personalized recommendations.</p>
          <Link to="/profile" className="btn btn-primary">Build My Profile →</Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Career Match Chart */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>🎯 Career Match Scores</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Match Score']} />
                <Bar dataKey="score" radius={[4,4,0,0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <p>No recommendations yet.</p>
              <Link to="/recommendations" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Get Recommendations</Link>
            </div>
          )}
        </div>

        {/* Top Recommendations */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>🏆 Top Career Matches</h3>
          {recommendations.length > 0 ? recommendations.map((rec, i) => (
            <div key={rec.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 0', borderBottom: i < recommendations.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${COLORS[i]}22`, color: COLORS[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                #{i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{rec.career_title}</div>
                <div className="progress-bar" style={{ marginTop: 6 }}>
                  <div className="progress-fill" style={{ width: `${rec.match_score}%`, background: COLORS[i] }} />
                </div>
              </div>
              <div style={{ fontWeight: 700, color: COLORS[i], fontSize: 14 }}>{rec.match_score}%</div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <p>Complete your profile first.</p>
            </div>
          )}
          {recommendations.length > 0 && <Link to="/recommendations" className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>View All →</Link>}
        </div>

        {/* Profile Summary */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>👤 Profile Summary</h3>
          {profile ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Education</div>
                <div style={{ fontSize: 14 }}>{profile.education || 'Not set'}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Skills</div>
                <div>{(profile.skills || []).slice(0, 6).map((s, i) => <span key={i} className="tag">{s}</span>)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Career Goals</div>
                <div style={{ fontSize: 14, color: '#64748b' }}>{(profile.career_goals || 'Not specified').substring(0, 120)}</div>
              </div>
              <Link to="/profile" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>Edit Profile</Link>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
              <p>No profile yet.</p>
              <Link to="/profile" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Create Profile</Link>
            </div>
          )}
        </div>

        {/* Recent Resume Reviews */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>📄 Recent Resume Reviews</h3>
          {resumeHistory.length > 0 ? resumeHistory.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 0', borderBottom: i < resumeHistory.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ fontSize: 24 }}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.filename}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ fontWeight: 700, color: r.score >= 70 ? '#10b981' : r.score >= 50 ? '#f59e0b' : '#ef4444' }}>
                {r.score}/100
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
              <p>No resume uploaded yet.</p>
              <Link to="/resume" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Upload Resume</Link>
            </div>
          )}
          {resumeHistory.length > 0 && <Link to="/resume" className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>Upload New Resume →</Link>}
        </div>
      </div>
    </div>
  );
}
