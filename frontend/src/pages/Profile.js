import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Profile() {
  const [form, setForm] = useState({ education: '', skills: '', experience: '', interests: '', career_goals: '' });
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState([]);
  const [interests, setInterests] = useState([]);
  const [interestInput, setInterestInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/profile').then(res => {
      if (res.data) {
        setForm({ education: res.data.education || '', experience: res.data.experience || '', career_goals: res.data.career_goals || '', skills: '', interests: '' });
        setSkills(res.data.skills || []);
        setInterests(res.data.interests || []);
      }
    }).finally(() => setLoading(false));
  }, []);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) { setSkills([...skills, s]); setSkillInput(''); }
  };
  const removeSkill = (s) => setSkills(skills.filter(x => x !== s));
  const addInterest = () => {
    const s = interestInput.trim();
    if (s && !interests.includes(s)) { setInterests([...interests, s]); setInterestInput(''); }
  };
  const removeInterest = (s) => setInterests(interests.filter(x => x !== s));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setMessage(''); setError('');
    try {
      await axios.post('/api/profile', { ...form, skills, interests });
      setMessage('✅ Profile saved successfully!');
    } catch { setError('Failed to save profile.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <h1>👤 My Career Profile</h1>
        <p>Build your profile to receive personalized career recommendations</p>
      </div>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Education */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🎓 Education</h3>
            <div className="form-group">
              <label className="form-label">Educational Background</label>
              <textarea className="form-control" rows={4} value={form.education}
                onChange={e => setForm({...form, education: e.target.value})}
                placeholder="e.g., B.S. Computer Science, University of Texas, 2024. Minor in Mathematics." />
            </div>
          </div>

          {/* Career Goals */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🎯 Career Goals</h3>
            <div className="form-group">
              <label className="form-label">What are your career objectives?</label>
              <textarea className="form-control" rows={4} value={form.career_goals}
                onChange={e => setForm({...form, career_goals: e.target.value})}
                placeholder="e.g., I want to become a Data Scientist or Machine Learning Engineer, working on AI applications that solve real-world problems." />
            </div>
          </div>

          {/* Skills */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>💡 Technical Skills</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="form-control" value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="e.g., Python, React, SQL..." />
              <button type="button" className="btn btn-primary" onClick={addSkill}>Add</button>
            </div>
            <div style={{ minHeight: 60 }}>
              {skills.map(s => (
                <span key={s} className="tag" style={{ cursor: 'pointer', background: '#ede9fe', color: '#4f46e5' }}
                  onClick={() => removeSkill(s)}>
                  {s} ✕
                </span>
              ))}
              {skills.length === 0 && <span style={{ color: '#94a3b8', fontSize: 13 }}>No skills added yet. Type and press Enter or click Add.</span>}
            </div>
          </div>

          {/* Interests */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>❤️ Interests & Passions</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="form-control" value={interestInput}
                onChange={e => setInterestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                placeholder="e.g., Machine Learning, Web Dev..." />
              <button type="button" className="btn btn-primary" onClick={addInterest}>Add</button>
            </div>
            <div style={{ minHeight: 60 }}>
              {interests.map(s => (
                <span key={s} className="tag" style={{ cursor: 'pointer', background: '#d1fae5', color: '#065f46' }}
                  onClick={() => removeInterest(s)}>
                  {s} ✕
                </span>
              ))}
              {interests.length === 0 && <span style={{ color: '#94a3b8', fontSize: 13 }}>Add your interests to improve recommendations.</span>}
            </div>
          </div>

          {/* Experience */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: 16 }}>💼 Work Experience & Projects</h3>
            <div className="form-group">
              <label className="form-label">Describe your experience, internships, or projects</label>
              <textarea className="form-control" rows={6} value={form.experience}
                onChange={e => setForm({...form, experience: e.target.value})}
                placeholder="e.g., Software Engineering Intern at XYZ Corp (Summer 2024) – Built REST APIs using Node.js. Academic project: Developed a machine learning model for sentiment analysis using Python and TensorFlow with 92% accuracy." />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
