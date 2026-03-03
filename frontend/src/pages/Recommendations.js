import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const GROWTH_BADGE = { 'Very High': 'badge-success', 'High': 'badge-primary', 'Medium': 'badge-warning' };

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    axios.get('/api/career/recommendations')
      .then(res => setRecommendations(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const generate = async () => {
    setGenerating(true); setError('');
    try {
      const res = await axios.post('/api/career/recommend');
      setRecommendations(res.data.recommendations);
      setSelected(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to generate recommendations. Please complete your profile first.');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🎯 Career Recommendations</h1>
          <p>AI-powered career matches based on your profile</p>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={generating}>
          {generating ? '⏳ Analyzing...' : '🔄 Generate Recommendations'}
        </button>
      </div>

      {error && <div className="alert alert-error">⚠️ {error} <Link to="/profile" style={{ fontWeight: 600 }}> Complete your profile →</Link></div>}

      {recommendations.length === 0 && !error && (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎯</div>
          <h3>No recommendations yet</h3>
          <p style={{ color: '#64748b', marginBottom: 24 }}>Complete your career profile and click Generate Recommendations.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/profile" className="btn btn-secondary">Build Profile First</Link>
            <button className="btn btn-primary" onClick={generate} disabled={generating}>
              {generating ? 'Analyzing...' : 'Generate Now'}
            </button>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap: 24 }}>
          {/* List */}
          <div>
            {recommendations.map((rec, i) => (
              <div key={rec.id || i} className="card" style={{ marginBottom: 16, cursor: 'pointer', border: selected === i ? '2px solid #4f46e5' : '1px solid #e2e8f0', transition: 'all 0.2s' }}
                onClick={() => setSelected(selected === i ? null : i)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 12, background: `${COLORS[i]}18`, color: COLORS[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20 }}>
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{rec.career_title}</div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${rec.match_score}%`, background: COLORS[i] }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 22, color: COLORS[i] }}>{rec.match_score}%</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>match</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected !== null && recommendations[selected] && (
            <div className="card" style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
              {(() => {
                const rec = recommendations[selected];
                const gaps = Array.isArray(rec.skill_gaps) ? rec.skill_gaps : JSON.parse(rec.skill_gaps || '[]');
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <div>
                        <h2>{rec.career_title}</h2>
                        <span className={`badge badge-primary`} style={{ marginTop: 6 }}>Match: {rec.match_score}%</span>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕</button>
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>📊 Match Score</div>
                      <div className="progress-bar" style={{ height: 12, marginBottom: 8 }}>
                        <div className="progress-fill" style={{ width: `${rec.match_score}%`, background: COLORS[selected] }} />
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>{rec.match_score}% profile alignment</div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 Why This Career?</div>
                      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{rec.reasoning}</p>
                    </div>

                    {gaps.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, color: '#f59e0b' }}>📚 Skills to Develop</div>
                        <div>
                          {gaps.slice(0, 5).map((gap, i) => (
                            <span key={i} className="tag" style={{ background: '#fef3c7', color: '#92400e' }}>{gap}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ background: '#ede9fe', borderRadius: 8, padding: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>📅 Next Steps</div>
                      <ol style={{ paddingLeft: 20, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                        {gaps.slice(0, 3).map((gap, i) => (
                          <li key={i}>Learn <strong>{gap}</strong> via online courses or projects</li>
                        ))}
                        <li>Build a portfolio project in this domain</li>
                        <li>Update your resume with new skills</li>
                        <li>Apply for internships or entry-level roles</li>
                      </ol>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
