import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    axios.get('/api/resume/history').then(res => setHistory(res.data)).catch(() => {});
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(''); setFeedback(null);
    const fd = new FormData();
    fd.append('resume', file);
    try {
      const res = await axios.post('/api/resume/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFeedback(res.data.feedback);
      setHistory(prev => [{ id: Date.now(), filename: res.data.filename, score: res.data.feedback.overall_score, created_at: new Date().toISOString() }, ...prev]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed.');
    } finally { setUploading(false); }
  };

  const scoreColor = (s) => s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';
  const statusColor = (s) => ({ 'Good': '#10b981', 'Excellent': '#4f46e5', 'Fair': '#f59e0b', 'Needs Improvement': '#ef4444', 'Missing': '#ef4444' }[s] || '#94a3b8');

  return (
    <div>
      <div className="page-header">
        <h1>📄 Resume Feedback</h1>
        <p>Upload your resume for AI-assisted analysis and improvement suggestions</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Upload */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>📤 Upload Resume</h3>
          <div style={{ border: '2px dashed #c7d2fe', borderRadius: 10, padding: 32, textAlign: 'center', background: '#fafbff', marginBottom: 16 }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📎</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Drag & Drop or Browse</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>PDF, DOC, DOCX, TXT (max 5MB)</div>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
            <button className="btn btn-secondary" onClick={() => fileRef.current.click()}>Browse Files</button>
          </div>
          {file && (
            <div style={{ background: '#ede9fe', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14 }}>📄 <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</div>
              <button className="btn btn-danger btn-sm" onClick={() => { setFile(null); fileRef.current.value = ''; }}>✕</button>
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? '⏳ Analyzing...' : '🔍 Analyze Resume'}
          </button>
          <div className="alert alert-info" style={{ marginTop: 16, marginBottom: 0 }}>
            💡 <strong>Tip:</strong> Fill in your Career Profile first for more personalized resume feedback!
          </div>
        </div>

        {/* History */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>📋 Review History</h3>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <div style={{ fontSize: 40 }}>📂</div>
              <p style={{ marginTop: 12 }}>No resumes uploaded yet</p>
            </div>
          ) : history.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 28 }}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{h.filename}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(h.created_at).toLocaleString()}</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: scoreColor(h.score) }}>{h.score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Panel */}
      {feedback && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3>📊 Analysis Results</h3>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Overall Score</div>
              <div className="score-circle" style={{ borderColor: scoreColor(feedback.overall_score), color: scoreColor(feedback.overall_score), margin: 'auto' }}>
                {feedback.overall_score}
              </div>
            </div>
          </div>

          {feedback.career_alignment && (
            <div className="alert alert-info" style={{ marginBottom: 20 }}>🎯 {feedback.career_alignment}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {feedback.sections.map((s, i) => (
              <div key={i} style={{ padding: 16, borderRadius: 8, background: '#f8fafc', borderLeft: `4px solid ${statusColor(s.status)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(s.status) }}>{s.status}</span>
                </div>
                <p style={{ fontSize: 13, color: '#64748b' }}>{s.note}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h4 style={{ color: '#10b981', marginBottom: 12 }}>✅ Strengths</h4>
              {feedback.strengths.map((s, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14, color: '#374151' }}>✓ {s}</div>
              ))}
            </div>
            <div>
              <h4 style={{ color: '#f59e0b', marginBottom: 12 }}>🔧 Improvements</h4>
              {feedback.improvements.map((s, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14, color: '#374151' }}>→ {s}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
