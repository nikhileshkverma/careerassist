import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const { login } = useAuth(); const navigate = useNavigate();
  const onSubmit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try { const u = await login(email, password); navigate(u.role === 'admin' ? '/admin' : '/dashboard'); }
    catch (err) { setError(err.response?.data?.error || 'Login failed.'); } finally { setLoading(false); }
  };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🎓</div>
        <div className="auth-title">CareerAssist</div>
        <div className="auth-sub">AI Career Guidance Platform</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required /></div>
          <div className="form-group"><label className="form-label">Password</label><input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
          <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center', marginTop:4 }} disabled={loading}>{loading?'Signing in...':'Sign In →'}</button>
        </form>
        <div style={{ textAlign:'center', marginTop:16, fontSize:13, color:'var(--muted)' }}>No account? <Link to="/register" style={{ color:'var(--primary-dark)', fontWeight:600 }}>Register</Link></div>
        <div style={{ marginTop:14, background:'#f9fafb', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:12, color:'var(--muted)' }}>
          <strong style={{ color:'var(--text)' }}>Demo:</strong> admin@careerassist.com / Admin@123
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'' });
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const { register } = useAuth(); const navigate = useNavigate();
  const onSubmit = async e => {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.password.length < 6) return setError('Password min 6 characters.');
    setLoading(true);
    try { await register(form.name, form.email, form.password); navigate('/login'); }
    catch (err) { setError(err.response?.data?.error || 'Registration failed.'); } finally { setLoading(false); }
  };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🎓</div>
        <div className="auth-title">Create Account</div>
        <div className="auth-sub">Join CareerAssist</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={onSubmit}>
          {[['name','Full Name','John Doe','text'],['email','Email','you@example.com','email'],['password','Password','Min 6 chars','password'],['confirm','Confirm Password','Repeat','password']].map(([n,l,p,t]) => (
            <div className="form-group" key={n}><label className="form-label">{l}</label><input className="form-control" name={n} type={t} value={form[n]} onChange={e=>setForm({...form,[e.target.name]:e.target.value})} placeholder={p} required /></div>
          ))}
          <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center' }} disabled={loading}>{loading?'Creating...':'Create Account →'}</button>
        </form>
        <div style={{ textAlign:'center', marginTop:16, fontSize:13, color:'var(--muted)' }}>Have an account? <Link to="/login" style={{ color:'var(--primary-dark)', fontWeight:600 }}>Sign in</Link></div>
      </div>
    </div>
  );
}
