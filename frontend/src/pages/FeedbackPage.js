import React, { useState, useEffect } from 'react';
import { feedbackAPI, successAPI } from '../utils/api';

const TYPES = {
  bug: { label: '🐛 Bug Report', color: '#ef4444', bg: '#fee2e2' },
  feature: { label: '💡 Feature Request', color: '#6366f1', bg: '#ede9fe' },
  improvement: { label: '🔧 Improvement', color: '#f59e0b', bg: '#fef3c7' },
  general: { label: '💬 General Feedback', color: '#10b981', bg: '#d1fae5' },
};
const STATUS = {
  pending: { label: '⏳ Pending', cls: 'badge-gray' },
  reviewed: { label: '👀 Reviewed', cls: 'badge-blue' },
  accepted: { label: '✅ Accepted', cls: 'badge-green' },
  rejected: { label: '❌ Rejected', cls: 'badge-red' },
  planned: { label: '🗓️ Planned', cls: 'badge-purple' },
};

export function FeedbackPage() {
  const [form, setForm] = useState({ type: 'feature', description: '', rating: 0 });
  const [successForm, setSuccessForm] = useState({ company: '', role: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successSubmitting, setSuccessSubmitting] = useState(false);
  const [msg, setMsg] = useState({});
  const [successMsg, setSuccessMsg] = useState({});
  const [myFeedback, setMyFeedback] = useState([]);
  const [tab, setTab] = useState('submit');

  useEffect(() => {
    feedbackAPI.myFeedback().then(r => setMyFeedback(r.data)).catch(() => {});
  }, []);

  const onSubmit = async e => {
    e.preventDefault();
    if (!form.description.trim()) return setMsg({ type: 'error', text: 'Description required.' });
    setSubmitting(true); setMsg({});
    try {
      await feedbackAPI.submit(form);
      setMsg({ type: 'success', text: '✅ Thank you for your feedback!' });
      setMyFeedback(prev => [{ _id: Date.now(), ...form, status: 'pending', createdAt: new Date() }, ...prev]);
      setForm({ type: 'feature', description: '', rating: 0 });
    } catch (e) { setMsg({ type: 'error', text: e.response?.data?.error || 'Failed.' }); }
    finally { setSubmitting(false); }
  };

  const onSuccessSubmit = async e => {
    e.preventDefault();
    if (!successForm.company || !successForm.role) return setSuccessMsg({ type: 'error', text: 'Company and role required.' });
    setSuccessSubmitting(true); setSuccessMsg({});
    try {
      await successAPI.report(successForm);
      setSuccessMsg({ type: 'success', text: '🎉 Congratulations! Your success story has been shared with our team!' });
      setSuccessForm({ company: '', role: '', message: '' });
    } catch (e) { setSuccessMsg({ type: 'error', text: e.response?.data?.error || 'Failed.' }); }
    finally { setSuccessSubmitting(false); }
  };

  return (
    <div>
      <div className="page-header"><h1>💬 Feedback</h1><p>Help us improve CareerAssist — or share your success!</p></div>

      <div className="tab-nav">
        <button className={`tab-btn${tab === 'submit' ? ' active' : ''}`} onClick={() => setTab('submit')}>📝 Submit Feedback</button>
        <button className={`tab-btn${tab === 'success' ? ' active' : ''}`} onClick={() => setTab('success')}>🏆 I Got a Job!</button>
        <button className={`tab-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>📋 My Submissions ({myFeedback.length})</button>
      </div>

      {tab === 'submit' && (
        <div style={{ maxWidth: 640 }}>
          {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            {Object.entries(TYPES).map(([type, cfg]) => (
              <div key={type} onClick={() => setForm({ ...form, type })}
                style={{ padding: 12, borderRadius: 8, cursor: 'pointer', border: `2px solid ${form.type === type ? cfg.color : 'var(--border)'}`, background: form.type === type ? cfg.bg : 'white', transition: 'all 0.15s' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: form.type === type ? cfg.color : 'var(--text)' }}>{cfg.label}</div>
              </div>
            ))}
          </div>
          <form onSubmit={onSubmit}>
            <div className="card">
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-control" rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe your feedback in detail..." required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Rating (optional)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, rating: form.rating === s ? 0 : s })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: s <= form.rating ? '#f59e0b' : '#e5e7eb', transition: 'color 0.15s' }}>★</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>{submitting ? '⏳ Submitting...' : '📤 Submit Feedback'}</button>
            </div>
          </form>
        </div>
      )}

      {tab === 'success' && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
            <div style={{ fontSize: 60 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 12, marginBottom: 6 }}>Congratulations on Landing a Job!</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>Share your success story with the CareerAssist team. Your story helps us understand our platform's impact and inspires others!</p>
          </div>

          {successMsg.text && <div className={`alert alert-${successMsg.type}`}>{successMsg.text}</div>}

          <form onSubmit={onSuccessSubmit} className="card">
            <div className="form-group">
              <label className="form-label">Company You Joined *</label>
              <input className="form-control" value={successForm.company} onChange={e => setSuccessForm({ ...successForm, company: e.target.value })} placeholder="e.g., Google, Amazon, Microsoft..." required />
            </div>
            <div className="form-group">
              <label className="form-label">Job Role / Title *</label>
              <input className="form-control" value={successForm.role} onChange={e => setSuccessForm({ ...successForm, role: e.target.value })} placeholder="e.g., Machine Learning Engineer" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Your Story (optional)</label>
              <textarea className="form-control" rows={4} value={successForm.message} onChange={e => setSuccessForm({ ...successForm, message: e.target.value })} placeholder="How did CareerAssist help you? Any advice for other job seekers?..." />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-success btn-lg" disabled={successSubmitting}>
                {successSubmitting ? '⏳ Sharing...' : '🏆 Share My Success Story'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'history' && (
        <div>
          {myFeedback.length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <div style={{ fontSize: 50 }}>💬</div>
              <p style={{ marginTop: 14 }}>No submissions yet</p>
            </div>
            : myFeedback.map(item => {
              const tc = TYPES[item.type] || TYPES.general;
              const sc = STATUS[item.status] || STATUS.pending;
              return (
                <div key={item._id} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: tc.bg, color: tc.color }}>{tc.label}</span>
                      <span className={`badge ${sc.cls}`}>{sc.label}</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.6 }}>{item.description}</p>
                  {item.adminResponse && (
                    <div style={{ marginTop: 10, padding: 10, background: '#ede9fe', borderRadius: 8, fontSize: 12.5 }}>
                      <strong style={{ color: '#6366f1' }}>Admin Response: </strong>{item.adminResponse}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default FeedbackPage;
