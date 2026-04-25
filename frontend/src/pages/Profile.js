import React, { useState, useEffect, useRef } from 'react';
import { profileAPI } from '../utils/api';

// ─────────────────────────────────────────────────────────────────────────────
// Neutral color palette — distinct from the green primary theme
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  personal:    { bg:'#eff6ff', border:'#bfdbfe', text:'#1e40af', dot:'#3b82f6' },  // blue
  education:   { bg:'#faf5ff', border:'#e9d5ff', text:'#6b21a8', dot:'#8b5cf6' },  // purple
  experience:  { bg:'#fff7ed', border:'#fed7aa', text:'#9a3412', dot:'#f97316' },  // orange
  projects:    { bg:'#f0fdf4', border:'#bbf7d0', text:'#166534', dot:'#22c55e' },  // green
  skills:      { bg:'#f0f9ff', border:'#bae6fd', text:'#0c4a6e', dot:'#0ea5e9' },  // sky
  certs:       { bg:'#fdf4ff', border:'#f0abfc', text:'#701a75', dot:'#d946ef' },  // fuchsia
  pubs:        { bg:'#fff1f2', border:'#fecdd3', text:'#9f1239', dot:'#f43f5e' },  // rose
};

const SKILLS_SUGG = ['Python','JavaScript','React','SQL','Machine Learning','Node.js','AWS','Docker','Git','TypeScript','TensorFlow','PyTorch','Kubernetes','MongoDB','FastAPI','Linux','Bash','CI/CD','LangChain','RAG','C++','Java','Go','Rust','Redis','PostgreSQL','Prometheus','Grafana','Terraform','Ansible','HuggingFace'];
const INT_SUGG    = ['AI/ML','Web Development','Data Science','Cybersecurity','Cloud Computing','DevOps','NLP','Computer Vision','Research','Product Management','Networking','Edge Computing','Robotics','Blockchain','Finance Tech'];

function fmtDate(d) {
  if (!d) return '';
  if (/present|current|now/i.test(d)) return 'Present';
  if (/^\d{4}-\d{2}/.test(d)) {
    const [y, m] = d.split('-');
    return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m,10)-1]} ${y}`;
  }
  return d;
}

// Section card wrapper with consistent styling
function Section({ title, color, children, onEdit, isEditing, badge }) {
  return (
    <div style={{ background:'white', borderRadius:12, border:`1px solid #e5e7eb`, marginBottom:16, overflow:'hidden' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid #f1f5f9', background:'#fafafa' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:4, height:20, borderRadius:2, background:color.dot }}/>
          <span style={{ fontWeight:700, fontSize:14.5, color:'#111' }}>{title}</span>
          {badge !== undefined && (
            <span style={{ fontSize:12, background:color.bg, color:color.text, padding:'2px 9px', borderRadius:99, fontWeight:600, border:`1px solid ${color.border}` }}>{badge}</span>
          )}
        </div>
        {onEdit && (
          <button onClick={onEdit} style={{ background:isEditing?color.bg:'transparent', border:`1px solid ${isEditing?color.border:'#e5e7eb'}`, borderRadius:7, padding:'5px 12px', cursor:'pointer', fontSize:12.5, fontWeight:600, color:isEditing?color.text:'#6b7280', transition:'all 0.1s' }}>
            {isEditing ? '✓ Done' : '✏️ Edit'}
          </button>
        )}
      </div>
      <div style={{ padding:'16px 20px' }}>
        {children}
      </div>
    </div>
  );
}

function Tag({ label, color, onRemove }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12.5, padding:'4px 11px', borderRadius:8, background:color.bg, color:color.text, border:`1px solid ${color.border}`, fontWeight:500, margin:'2px' }}>
      {label}
      {onRemove && <button onClick={onRemove} style={{ background:'none', border:'none', cursor:'pointer', color:color.text, fontSize:14, lineHeight:1, padding:0, marginLeft:2, opacity:0.7 }}>×</button>}
    </span>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState({
    name:'',phone:'',location:'',linkedIn:'',github:'',portfolio:'',
    summary:'',skills:[],interests:[],certifications:[],publications:[],
    careerGoals:'',education:[],experience:[],projects:[],
  });
  const [editing, setEditing] = useState({});  // which sections are in edit mode
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [parsing, setParsing] = useState(false);
  const [msg, setMsg]         = useState({});
  const [skillIn, setSkillIn] = useState('');
  const [certIn, setCertIn]   = useState('');
  const [pubIn, setPubIn]     = useState('');
  const fileRef = useRef();

  useEffect(() => {
    profileAPI.get().then(r => {
      if (r.data) setProfile(prev => ({
        ...prev, ...r.data,
        skills:         r.data.skills         || [],
        interests:      r.data.interests       || [],
        certifications: r.data.certifications  || [],
        publications:   r.data.publications    || [],
        education:      r.data.education       || [],
        experience:     r.data.experience      || [],
        projects:       r.data.projects        || [],
      }));
    }).catch(()=>{}).finally(() => setLoading(false));
  }, []);

  const upd    = (k, v) => setProfile(p => ({ ...p, [k]: v }));
  const togEdit = k => setEditing(p => ({ ...p, [k]: !p[k] }));

  const addSkill = () => { const s = skillIn.trim(); if (s && !profile.skills.includes(s)) { upd('skills', [...profile.skills, s]); setSkillIn(''); } };
  const addCert  = () => { const s = certIn.trim(); if (s) { upd('certifications', [...profile.certifications, s]); setCertIn(''); } };
  const addPub   = () => { const s = pubIn.trim(); if (s) { upd('publications', [...profile.publications, s]); setPubIn(''); } };

  const handleSave = async () => {
    setSaving(true); setMsg({});
    try {
      const r = await profileAPI.save(profile);
      localStorage.setItem('ca_profile_updated', Date.now().toString());
      setMsg({ type:'success', text: r.data?.recommendationsRefreshed ? '✅ Profile saved! Job matches updated.' : '✅ Profile saved!' });
      setEditing({});
    } catch (e) {
      setMsg({ type:'error', text: e.response?.data?.error || 'Save failed.' });
    } finally { setSaving(false); }
  };

  const handleParse = async e => {
    const file = e.target.files[0]; if (!file) return;
    setParsing(true); setMsg({ type:'info', text:'⏳ Parsing resume...' });
    try {
      const fd = new FormData(); fd.append('resume', file);
      const r = await profileAPI.parseResume(fd);
      const p = r.data.parsed || {};
      setProfile(prev => ({
        ...prev,
        name:     p.name     || prev.name,
        phone:    p.phone    || prev.phone,
        linkedIn: p.linkedIn || prev.linkedIn,
        github:   p.github   || prev.github,
        location: p.location || prev.location,
        summary:  p.summary  || prev.summary,
        skills:   p.skills?.length > 0 ? [...new Set([...prev.skills, ...p.skills])].slice(0, 100) : prev.skills,
        education:   p.education?.length   > 0 ? p.education   : prev.education,
        experience:  p.experience?.length  > 0 ? p.experience  : prev.experience,
        projects:    p.projects?.length    > 0 ? p.projects    : prev.projects,
        certifications: p.certifications?.length > 0
          ? [...new Set([...prev.certifications, ...p.certifications.map(c => c.name||c)])]
          : prev.certifications,
        publications: p.publications?.length > 0
          ? [...new Set([...prev.publications, ...p.publications.map(p => p.title||p)])]
          : prev.publications,
      }));
      const conf = r.data.confidence || 0;
      setMsg({ type: conf >= 60 ? 'success' : 'warning', text: `${r.data.message} (${conf}% confidence)` });
    } catch {
      setMsg({ type:'error', text:'Parse failed. Use a text-based PDF.' });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const completionPct = Math.min(100, Math.round(
    ([profile.name,profile.phone,profile.location,profile.summary].filter(Boolean).length/4*25) +
    (Math.min(profile.skills.length,10)/10*30) +
    (Math.min((profile.experience||[]).length,2)/2*25) +
    (Math.min((profile.education||[]).length,1)*20)
  ));

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, margin:0, color:'#111' }}>👤 Profile</h1>
          <p style={{ fontSize:12.5, color:'#6b7280', marginTop:2 }}>Your profile data is kept private and secure.</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display:'none' }} onChange={handleParse}/>
          <button onClick={() => fileRef.current.click()} disabled={parsing}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'white', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151' }}>
            {parsing ? '⏳ Parsing...' : '📄 Auto-fill from Resume'}
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#111827', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {saving ? '⏳' : '💾'} Save
          </button>
        </div>
      </div>

      {/* Completion */}
      <div style={{ background:'white', borderRadius:10, border:'1px solid #e5e7eb', padding:'12px 16px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
          <span style={{ fontWeight:600, color:'#374151' }}>Profile Completion</span>
          <span style={{ fontWeight:800, color: completionPct>=80?'#166534':completionPct>=50?'#92400e':'#991b1b' }}>{completionPct}%</span>
        </div>
        <div style={{ height:6, background:'#f1f5f9', borderRadius:99 }}>
          <div style={{ height:'100%', borderRadius:99, transition:'width 0.4s', width:`${completionPct}%`, background: completionPct>=80?'#22c55e':completionPct>=50?'#f59e0b':'#ef4444' }}/>
        </div>
      </div>

      {msg.text && (
        <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13, background:msg.type==='success'?'#f0fdf4':msg.type==='warning'?'#fefce8':msg.type==='info'?'#eff6ff':'#fef2f2', color:msg.type==='success'?'#166534':msg.type==='warning'?'#854d0e':msg.type==='info'?'#1e40af':'#991b1b', border:`1px solid ${msg.type==='success'?'#bbf7d0':msg.type==='warning'?'#fde68a':msg.type==='info'?'#bfdbfe':'#fca5a5'}` }}>
          {msg.text}
        </div>
      )}

      {/* ── PERSONAL ── */}
      <Section title="Personal Information" color={C.personal} onEdit={() => togEdit('personal')} isEditing={editing.personal}>
        {!editing.personal ? (
          <div>
            <div style={{ fontSize:24, fontWeight:800, color:'#111', marginBottom:8 }}>{profile.name || <span style={{ color:'#9ca3af', fontStyle:'italic', fontWeight:400, fontSize:18 }}>Your Name</span>}</div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:13.5, color:'#374151', marginBottom:8 }}>
              {profile.location && <span>📍 {profile.location}</span>}
              {profile.phone    && <span>📞 {profile.phone}</span>}
              {profile.email    && <span>✉️ {profile.email}</span>}
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:profile.summary?12:0 }}>
              {profile.linkedIn  && <a href={`https://${profile.linkedIn.replace(/^https?:\/\//,'')}`} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'#0077b5', fontWeight:600, textDecoration:'none' }}>🔗 LinkedIn</a>}
              {profile.github    && <a href={`https://${profile.github.replace(/^https?:\/\//,'')}`} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'#374151', fontWeight:600, textDecoration:'none' }}>🐙 GitHub</a>}
              {profile.portfolio && <a href={profile.portfolio} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'#6366f1', fontWeight:600, textDecoration:'none' }}>🌐 Portfolio</a>}
            </div>
            {profile.summary && <p style={{ fontSize:13.5, color:'#374151', lineHeight:1.75, borderTop:'1px solid #f1f5f9', paddingTop:12, marginTop:4 }}>{profile.summary}</p>}
          </div>
        ) : (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              {[['name','Full Name','e.g., Nikhilesh Verma'],['phone','Phone','e.g., 361-695-8848'],['location','Location','e.g., Texas, US'],['linkedIn','LinkedIn','linkedin.com/in/yourname'],['github','GitHub','github.com/yourname'],['portfolio','Portfolio','https://your-site.com']].map(([k,l,ph]) => (
                <div key={k}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:4 }}>{l}</label>
                  <input value={profile[k]||''} onChange={e=>upd(k,e.target.value)} placeholder={ph}
                    style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Professional Summary</label>
              <textarea value={profile.summary||''} onChange={e=>upd('summary',e.target.value)} rows={3} placeholder="e.g., Graduate Research Assistant at TAMU focusing on AI Security and Edge Computing..."
                style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none' }}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:4 }}>Career Goals</label>
              <textarea value={profile.careerGoals||''} onChange={e=>upd('careerGoals',e.target.value)} rows={2} placeholder="e.g., ML/AI Security Engineer focusing on edge AI and LLM deployment..."
                style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none' }}/>
            </div>
          </div>
        )}
      </Section>

      {/* ── EDUCATION ── */}
      <Section title="Education" color={C.education} badge={(profile.education||[]).length} onEdit={() => togEdit('education')} isEditing={editing.education}>
        {(profile.education||[]).length === 0 && !editing.education && (
          <div style={{ textAlign:'center', padding:'20px 0', color:'#9ca3af' }}>
            <div style={{ fontSize:32 }}>🎓</div>
            <div style={{ fontSize:13, marginTop:8 }}>No education added. <button onClick={() => fileRef.current.click()} style={{ background:'none', border:'none', color:C.education.text, cursor:'pointer', fontWeight:600 }}>Upload resume to auto-fill</button></div>
          </div>
        )}
        {(profile.education||[]).map((edu, i) => (
          <div key={i} style={{ marginBottom: i < (profile.education||[]).length-1 ? 18 : 0, paddingBottom: i < (profile.education||[]).length-1 ? 18 : 0, borderBottom: i < (profile.education||[]).length-1 ? '1px solid #f1f5f9' : 'none' }}>
            {!editing.education ? (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#111' }}>{edu.institution}</div>
                  <div style={{ fontSize:13.5, color:'#374151', marginTop:2 }}>{edu.degree}{edu.gpa ? ` · GPA: ${edu.gpa}` : ''}</div>
                  {edu.location && <div style={{ fontSize:12.5, color:'#9ca3af', marginTop:1 }}>{edu.location}</div>}
                </div>
                <div style={{ fontSize:12.5, color:'#6b7280', textAlign:'right', flexShrink:0 }}>
                  {fmtDate(edu.startDate)}{edu.endDate ? ` – ${fmtDate(edu.endDate)}` : ''}
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:12, background:'#fafafa', borderRadius:8 }}>
                {[['degree','Degree','e.g., Master in Computer Science'],['institution','Institution','e.g., Texas A&M University'],['location','Location','e.g., Corpus Christi, TX'],['startDate','Start','e.g., Aug 2024'],['endDate','End','e.g., May 2026 or Present'],['gpa','GPA','e.g., 3.9']].map(([k,l,ph]) => (
                  <div key={k}>
                    <label style={{ fontSize:11.5, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>{l}</label>
                    <input value={edu[k]||''} onChange={ev => { const ed=[...profile.education]; ed[i]={...ed[i],[k]:ev.target.value}; upd('education',ed); }} placeholder={ph}
                      style={{ width:'100%', padding:'6px 9px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:12.5, fontFamily:'inherit', outline:'none' }}/>
                  </div>
                ))}
                <button onClick={() => upd('education', profile.education.filter((_,j)=>j!==i))}
                  style={{ gridColumn:'span 2', marginTop:4, padding:'6px', background:'#fef2f2', color:'#991b1b', border:'1px solid #fca5a5', borderRadius:6, cursor:'pointer', fontSize:12.5, fontWeight:600 }}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
        {editing.education && (
          <button onClick={() => upd('education', [...(profile.education||[]), { degree:'',institution:'',location:'',startDate:'',endDate:'',gpa:'' }])}
            style={{ width:'100%', marginTop:12, padding:'9px', background:'#faf5ff', color:C.education.text, border:`1.5px dashed ${C.education.border}`, borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            + Add Education
          </button>
        )}
      </Section>

      {/* ── WORK EXPERIENCE ── */}
      <Section title="Work Experience" color={C.experience} badge={(profile.experience||[]).length} onEdit={() => togEdit('experience')} isEditing={editing.experience}>
        {(profile.experience||[]).length === 0 && !editing.experience && (
          <div style={{ textAlign:'center', padding:'20px 0', color:'#9ca3af' }}>
            <div style={{ fontSize:32 }}>💼</div>
            <div style={{ fontSize:13, marginTop:8 }}>No experience added. <button onClick={() => fileRef.current.click()} style={{ background:'none', border:'none', color:C.experience.text, cursor:'pointer', fontWeight:600 }}>Upload resume to auto-fill</button></div>
          </div>
        )}
        {(profile.experience||[]).map((exp, i) => (
          <div key={i} style={{ marginBottom: i < (profile.experience||[]).length-1 ? 20 : 0, paddingBottom: i < (profile.experience||[]).length-1 ? 20 : 0, borderBottom: i < (profile.experience||[]).length-1 ? '1px solid #f1f5f9' : 'none' }}>
            {!editing.experience ? (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:'#111' }}>{exp.title}</div>
                    <div style={{ fontSize:13.5, color:'#374151' }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                  </div>
                  <div style={{ fontSize:12.5, color:'#6b7280', flexShrink:0, textAlign:'right' }}>
                    {fmtDate(exp.startDate)}{exp.endDate || exp.current ? ` – ${exp.current ? 'Present' : fmtDate(exp.endDate)}` : ''}
                  </div>
                </div>
                {(exp.bullets||[]).filter(Boolean).length > 0 && (
                  <div style={{ marginTop:8 }}>
                    {(exp.bullets||[]).filter(Boolean).map((b,j) => (
                      <div key={j} style={{ fontSize:13.5, color:'#374151', padding:'2px 0 2px 16px', position:'relative', lineHeight:1.65 }}>
                        <span style={{ position:'absolute', left:4, color:'#9ca3af' }}>•</span>{b}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding:12, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  {[['title','Job Title','e.g., Graduate Research Assistant'],['company','Company','e.g., Texas A&M'],['location','Location','e.g., Corpus Christi, TX'],['startDate','Start','e.g., Jan 2025']].map(([k,l,ph]) => (
                    <div key={k}>
                      <label style={{ fontSize:11.5, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>{l}</label>
                      <input value={exp[k]||''} onChange={ev=>{const ex=[...profile.experience];ex[i]={...ex[i],[k]:ev.target.value};upd('experience',ex);}} placeholder={ph}
                        style={{ width:'100%', padding:'6px 9px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:12.5, fontFamily:'inherit', outline:'none' }}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:11.5, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>End Date</label>
                    <input value={exp.endDate||''} disabled={exp.current} onChange={ev=>{const ex=[...profile.experience];ex[i]={...ex[i],endDate:ev.target.value};upd('experience',ex);}} placeholder="Present or Aug 2024"
                      style={{ width:'100%', padding:'6px 9px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:12.5, fontFamily:'inherit', outline:'none', opacity:exp.current?0.5:1 }}/>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7, paddingTop:20 }}>
                    <input type="checkbox" id={`cur-${i}`} checked={exp.current||false} onChange={ev=>{const ex=[...profile.experience];ex[i]={...ex[i],current:ev.target.checked,endDate:ev.target.checked?'Present':''};upd('experience',ex);}} style={{ accentColor:'#f97316' }}/>
                    <label htmlFor={`cur-${i}`} style={{ fontSize:12.5, cursor:'pointer' }}>Currently here</label>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:11.5, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Bullet Points (one per line)</label>
                  <textarea rows={4} value={(exp.bullets||[]).join('\n')} onChange={ev=>{const ex=[...profile.experience];ex[i]={...ex[i],bullets:ev.target.value.split('\n')};upd('experience',ex);}} placeholder="• Built scalable APIs&#10;• Led team of 4 engineers"
                    style={{ width:'100%', padding:'7px 9px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:12.5, fontFamily:'inherit', resize:'vertical', outline:'none' }}/>
                </div>
                <button onClick={() => upd('experience', profile.experience.filter((_,j)=>j!==i))}
                  style={{ marginTop:7, padding:'5px 12px', background:'#fef2f2', color:'#991b1b', border:'1px solid #fca5a5', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>Remove</button>
              </div>
            )}
          </div>
        ))}
        {editing.experience && (
          <button onClick={() => upd('experience', [...(profile.experience||[]), { title:'',company:'',location:'',startDate:'',endDate:'',current:false,bullets:[] }])}
            style={{ width:'100%', marginTop:12, padding:'9px', background:'#fff7ed', color:C.experience.text, border:`1.5px dashed ${C.experience.border}`, borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            + Add Experience
          </button>
        )}
      </Section>

      {/* ── PROJECTS ── */}
      {(profile.projects||[]).length > 0 && (
        <Section title="Open-Source Projects" color={C.projects} badge={(profile.projects||[]).length} onEdit={() => togEdit('projects')} isEditing={editing.projects}>
          {(profile.projects||[]).map((proj, i) => (
            <div key={i} style={{ marginBottom: i < (profile.projects||[]).length-1 ? 14 : 0, paddingBottom: i < (profile.projects||[]).length-1 ? 14 : 0, borderBottom: i < (profile.projects||[]).length-1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#111', marginBottom:4 }}>
                {proj.name}
                {proj.link && <a href={proj.link.startsWith('http') ? proj.link : `https://${proj.link}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:C.projects.text, marginLeft:8, fontWeight:600, textDecoration:'none' }}>🔗 Link</a>}
              </div>
              {(proj.bullets||[]).filter(Boolean).map((b,j) => (
                <div key={j} style={{ fontSize:13.5, color:'#374151', padding:'2px 0 2px 16px', position:'relative' }}>
                  <span style={{ position:'absolute', left:4, color:'#9ca3af' }}>•</span>{b}
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* ── SKILLS ── */}
      <Section title="Technical Skills" color={C.skills} badge={profile.skills.length} onEdit={() => togEdit('skills')} isEditing={editing.skills}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:editing.skills ? 12 : 0 }}>
          {profile.skills.map(s => (
            <Tag key={s} label={s} color={C.skills} onRemove={editing.skills ? () => upd('skills', profile.skills.filter(x=>x!==s)) : null}/>
          ))}
          {profile.skills.length === 0 && <span style={{ fontSize:13, color:'#9ca3af' }}>No skills added yet.</span>}
        </div>
        {editing.skills && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <input value={skillIn} onChange={e=>setSkillIn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addSkill())} placeholder="Type skill and press Enter..."
                style={{ flex:1, padding:'8px 11px', border:'1.5px solid #bae6fd', borderRadius:7, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
              <button onClick={addSkill} style={{ padding:'8px 14px', background:C.skills.bg, color:C.skills.text, border:`1.5px solid ${C.skills.border}`, borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>Add</button>
            </div>
            <div style={{ fontSize:11.5, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>Quick add:</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {SKILLS_SUGG.filter(s=>!profile.skills.includes(s)).map(s => (
                <span key={s} onClick={() => upd('skills',[...profile.skills,s])}
                  style={{ fontSize:12, padding:'3px 10px', borderRadius:7, cursor:'pointer', background:'#f1f5f9', color:'#374151', border:'1px solid #e5e7eb' }}>
                  + {s}
                </span>
              ))}
            </div>
          </>
        )}

        {/* Interests */}
        <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14, marginTop:14 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:'#374151', marginBottom:8 }}>Areas of Interest</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {(profile.interests||[]).map(s => (
              <Tag key={s} label={s} color={{ bg:'#f5f3ff', border:'#ddd6fe', text:'#5b21b6' }} onRemove={editing.skills ? () => upd('interests',(profile.interests||[]).filter(x=>x!==s)) : null}/>
            ))}
            {editing.skills && INT_SUGG.filter(s=>!(profile.interests||[]).includes(s)).map(s => (
              <span key={s} onClick={() => upd('interests',[...(profile.interests||[]),s])}
                style={{ fontSize:12, padding:'3px 10px', borderRadius:7, cursor:'pointer', background:'#f5f3ff', color:'#6d28d9', border:'1px solid #ddd6fe' }}>
                + {s}
              </span>
            ))}
          </div>
        </div>

        {/* Career goals */}
        <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14, marginTop:14 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:'#374151', marginBottom:6 }}>Career Goals</div>
          {editing.skills
            ? <textarea value={profile.careerGoals||''} onChange={e=>upd('careerGoals',e.target.value)} rows={2} placeholder="e.g., ML/AI Security Engineer focusing on edge AI and LLM deployment..."
                style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #bae6fd', borderRadius:7, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none' }}/>
            : <p style={{ fontSize:13.5, color:profile.careerGoals?'#374151':'#9ca3af', lineHeight:1.75 }}>{profile.careerGoals || 'Add career goals to improve recommendations.'}</p>
          }
        </div>
      </Section>

      {/* ── CERTIFICATIONS ── */}
      {(profile.certifications?.length > 0 || editing.certs) && (
        <Section title="Certifications" color={C.certs} badge={profile.certifications?.length} onEdit={() => togEdit('certs')} isEditing={editing.certs}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {(profile.certifications||[]).map((c, i) => {
              const name = typeof c === 'object' ? c.name||c : c;
              return <Tag key={i} label={name} color={C.certs} onRemove={editing.certs ? () => upd('certifications', profile.certifications.filter((_,j)=>j!==i)) : null}/>;
            })}
          </div>
          {editing.certs && (
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <input value={certIn} onChange={e=>setCertIn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addCert())} placeholder="Add certification name + Enter"
                style={{ flex:1, padding:'7px 10px', border:`1.5px solid ${C.certs.border}`, borderRadius:7, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
              <button onClick={addCert} style={{ padding:'7px 13px', background:C.certs.bg, color:C.certs.text, border:`1.5px solid ${C.certs.border}`, borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>Add</button>
            </div>
          )}
        </Section>
      )}

      {/* ── PUBLICATIONS ── */}
      {(profile.publications?.length > 0 || editing.pubs) && (
        <Section title="Publications" color={C.pubs} badge={profile.publications?.length} onEdit={() => togEdit('pubs')} isEditing={editing.pubs}>
          {(profile.publications||[]).map((p, i) => {
            const title = typeof p === 'object' ? p.title||p : p;
            const link  = typeof p === 'object' ? p.link||'' : '';
            return (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'7px 0', borderBottom: i < (profile.publications||[]).length-1 ? '1px solid #f1f5f9' : 'none' }}>
                <span style={{ fontSize:13.5, color:'#374151', lineHeight:1.6 }}>• {title}{link && <a href={link} target="_blank" rel="noreferrer" style={{ marginLeft:6, fontSize:12.5, color:C.pubs.text, fontWeight:600 }}>🔗 Link</a>}</span>
                {editing.pubs && <button onClick={() => upd('publications', profile.publications.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16, flexShrink:0, padding:0 }}>×</button>}
              </div>
            );
          })}
          {editing.pubs && (
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <input value={pubIn} onChange={e=>setPubIn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addPub())} placeholder="Publication title + Enter"
                style={{ flex:1, padding:'7px 10px', border:`1.5px solid ${C.pubs.border}`, borderRadius:7, fontSize:13, fontFamily:'inherit', outline:'none' }}/>
              <button onClick={addPub} style={{ padding:'7px 13px', background:C.pubs.bg, color:C.pubs.text, border:`1.5px solid ${C.pubs.border}`, borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>Add</button>
            </div>
          )}
        </Section>
      )}

      {/* Save button */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8, marginBottom:32, paddingTop:8, borderTop:'1px solid #f1f5f9' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding:'11px 28px', background:'#111827', color:'white', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1 }}>
          {saving ? '⏳ Saving...' : '💾 Save All Changes'}
        </button>
      </div>
    </div>
  );
}
