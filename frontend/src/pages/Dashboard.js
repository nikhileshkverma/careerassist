import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { careerAPI, jobsAPI, resumeAPI } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const C = ['#00c46a','#6366f1','#f59e0b','#06b6d4','#ef4444','#8b5cf6'];
const sc = s => s >= 75 ? '#00c46a' : s >= 55 ? '#f59e0b' : '#ef4444';

export default function Dashboard() {
  const { user } = useAuth();
  const [recs, setRecs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([careerAPI.getRecommendations(), jobsAPI.recommended(), resumeAPI.list()])
      .then(([r, j, res]) => { setRecs(r.data.slice(0, 6)); setJobs(j.data.jobs?.slice(0, 4) || []); setResumes(res.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  const top = recs[0];
  const primary = resumes.find(r => r.isPrimary) || resumes[0];
  const chartData = recs.map(r => ({ name: r.careerTitle.split(' ').slice(0,2).join(' '), match: r.matchPercentage, conf: r.confidenceScore }));

  return (
    <div>
      <div className="page-header">
        <h1>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p>Your AI-powered career intelligence dashboard</p>
      </div>

      {(!user?.skills || user.skills.length === 0) && (
        <div className="alert alert-info" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>🚀 <strong>Get started:</strong> Upload your resume or fill your profile to unlock AI recommendations, job matching, and resume tailoring.</span>
          <Link to="/profile" className="btn btn-accent btn-sm">Set Up Profile →</Link>
        </div>
      )}

      <div className="stats-row">
        {[
          { icon:'🎯', val:recs.length, label:'Career Matches', color:C[0] },
          { icon:'⭐', val:top?`${top.matchPercentage}%`:'—', label:'Top Match Score', color:C[0] },
          { icon:'💼', val:jobs.length, label:'Jobs Found', color:C[1] },
          { icon:'📄', val:resumes.length, label:'Resumes', color:C[2] },
          { icon:'🛠️', val:user?.skills?.length||0, label:'Skills Listed', color:C[3] },
        ].map((s,i) => (
          <div key={i} className="stat-card">
            <div style={{ fontSize:24, marginBottom:7 }}>{s.icon}</div>
            <div className="stat-num" style={{ color:s.color }}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16, marginBottom:16 }}>
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700 }}>📊 Career Match Scores</h3>
            <Link to="/career" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={chartData} margin={{ bottom:18 }}>
                <XAxis dataKey="name" tick={{ fontSize:10 }} />
                <YAxis domain={[0,100]} tick={{ fontSize:10 }} />
                <Tooltip formatter={(v,n) => [`${v}%`, n==='match'?'Match':'Confidence']} />
                <Bar dataKey="match" radius={[4,4,0,0]}>{chartData.map((_,i)=><Cell key={i} fill={C[i%C.length]} />)}</Bar>
                <Bar dataKey="conf" radius={[4,4,0,0]} fill="#e5e7eb" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:190, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#9ca3af' }}>
              <div style={{ fontSize:36 }}>📊</div>
              <p style={{ marginTop:10 }}>No matches yet</p>
              <Link to="/career" className="btn btn-primary btn-sm" style={{ marginTop:10 }}>Generate Matches</Link>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700 }}>🏆 Top Matches</h3>
          </div>
          {recs.length > 0 ? recs.slice(0,5).map((r,i) => (
            <div key={i} style={{ marginBottom:9 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:3 }}>
                <span style={{ fontWeight:600 }}>{r.icon} {r.careerTitle}</span>
                <span style={{ fontWeight:700, color:sc(r.matchPercentage) }}>{r.matchPercentage}%</span>
              </div>
              <div className="progress-track"><div className="progress-bar" style={{ width:`${r.matchPercentage}%`, background:C[i] }} /></div>
            </div>
          )) : <div style={{ textAlign:'center', padding:24, color:'#9ca3af' }}>Complete your profile to see matches</div>}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Top Jobs */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700 }}>💼 Recommended Jobs</h3>
            <Link to="/jobs" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          {jobs.length > 0 ? jobs.map((job,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid #f3f4f6' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{job.title}</div>
                <div style={{ fontSize:11.5, color:'var(--muted)' }}>{job.company} · {job.location}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700, fontSize:13, color:sc(job.matchScore) }}>{job.matchScore}%</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{job.matchLabel}</div>
              </div>
            </div>
          )) : <div style={{ textAlign:'center', padding:24, color:'#9ca3af' }}>Build your profile to get job matches</div>}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>⚡ Quick Actions</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { to:'/career', icon:'🎯', label:'Generate Career Matches', desc:'AI-powered career recommendations' },
              { to:'/resume', icon:'📄', label:'Resume Manager', desc:'Multi-resume + ATS + JD tailoring' },
              { to:'/jobs', icon:'💼', label:'Browse Job Matches', desc:'Jobs matched to your profile' },
              { to:'/career', icon:'🤖', label:'Career Counselor AI', desc:'Ask any career question' },
            ].map(item => (
              <Link key={item.to} to={item.to} className="btn btn-secondary" style={{ justifyContent:'flex-start', gap:10, padding:'9px 12px' }}>
                <span style={{ fontSize:18 }}>{item.icon}</span>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontWeight:600, fontSize:12.5 }}>{item.label}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', fontWeight:400 }}>{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
