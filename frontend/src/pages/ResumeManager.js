import React, { useState, useEffect, useRef, useCallback } from 'react';
import { resumeAPI, profileAPI } from '../utils/api';

const SCORE_COLOR = s => s >= 75 ? '#00c46a' : s >= 55 ? '#f59e0b' : '#ef4444';
const dedupeArr = arr => [...new Map((arr||[]).filter(Boolean).map(i => [typeof i==='object'?(i.title||i.name||JSON.stringify(i)):i, i])).values()];
const fmtMsg = t => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

const MARKET_ROLES_DEFAULT = [
  'Machine Learning Engineer','Software Engineer','Data Scientist','Full Stack Developer',
  'Cloud Engineer','AI Research Engineer','NLP Research Scientist','DevOps Engineer',
  'Cybersecurity Analyst','UX/UI Designer','Product Manager','MLOps Engineer',
  'LLM Engineer','Computer Vision Engineer','Deep Learning Engineer',
  'Site Reliability Engineer','Backend Engineer','Frontend Engineer',
  'Data Engineer','Security Engineer','Blockchain Engineer','Mobile Engineer',
  'Database Administrator','Platform Engineer','AI/ML Scientist','Research Scientist',
  'Quantitative Analyst','Robotics Engineer','Embedded Systems Engineer','Network Engineer',
  'Solution Architect','Technical Program Manager','Generative AI Engineer',
  'AI Safety Researcher','Prompt Engineer','Data Analyst','Analytics Engineer',
  'iOS Engineer','Android Engineer','Systems Engineer','Infrastructure Engineer',
];

// ── Resume Paper Component ──────────────────────────────────────────────────
function ResumePaper({ resume, profile, style: resumeStyle, sectionOrder }) {
  const r = resume || {};
  const p = profile || {};
  const rs = resumeStyle || {};
  const fontFamily = rs.fontFamily || "'Times New Roman', serif";
  const nameSize = rs.nameSize || 17;
  const headerSize = rs.headerSize || 10.5;
  const bodySize = rs.bodySize || 9.5;

  // PRIORITY ORDER:
  // 1. Resume's own extracted fields (resumeName, resumeEmail etc.) — from the uploaded PDF
  // 2. Resume's structured fields (r.skills, r.experience etc.)
  // 3. Profile fallback (p.name, p.skills etc.) — ONLY if resume has no data at all
  const name     = r.resumeName     || p.name     || '';
  const phone    = r.resumePhone    || p.phone    || '';
  const location = r.resumeLocation || p.location || '';
  const email    = r.resumeEmail    || p.email    || '';
  const li       = r.resumeLinkedIn || p.linkedIn || '';
  const gh       = r.resumeGithub   || p.github   || '';
  const portfolio = p.portfolio || '';
  const summary   = r.resumeSummary || r.summary || p.summary || '';

  // Body content: ONLY from the resume object — profile is NOT used as fallback for body
  // If the resume was parsed from a PDF, it has its own experience/education etc.
  // If the resume was manually created, r fields will be populated from profile at creation time.
  const skills     = (r.skills?.length > 0)      ? r.skills      : (p.skills || []);
  const experience = (r.experience?.length > 0)  ? r.experience  : [];
  const education  = (r.education?.length > 0)   ? r.education   : [];
  const projects   = (r.projects?.length > 0)    ? r.projects    : [];
  const certs      = dedupeArr((r.certifications?.length > 0) ? r.certifications : []);
  const pubs       = dedupeArr((r.publications?.length > 0)   ? r.publications   : []);

  const handleDownload = useCallback(() => {
    const content = document.getElementById('resume-paper-content');
    if (!content) { alert('Resume not loaded yet. Please wait.'); return; }
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow popups to download your resume.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Resume - ${name}</title>
<meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4;margin:${rs.margin||14}mm ${rs.sideMargin||18}mm}
body{font-family:${fontFamily};font-size:${bodySize}pt;line-height:1.45;color:#000;background:white;width:210mm}
h1{font-size:${nameSize}pt;font-weight:bold;text-align:center;margin-bottom:3pt}
.contact{font-size:${Math.max(bodySize-1,8)}pt;color:#333;text-align:center;margin-bottom:6pt}
.sec{font-size:${headerSize}pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:1.5px solid #222;margin:${rs.sectionSpacing||8}pt 0 4pt;padding-bottom:1pt}
.exp-row{display:flex;justify-content:space-between;align-items:flex-start}
.exp-co{font-weight:bold;font-size:${bodySize+0.5}pt}
.exp-date{font-style:italic;font-size:${bodySize-1}pt;color:#555}
.exp-role{font-style:italic;font-size:${bodySize}pt;margin-bottom:2pt}
ul{padding-left:13pt;margin:2pt 0}
li{margin-bottom:${rs.entrySpacing||1.5}pt;font-size:${bodySize}pt}
a{color:#333;text-decoration:none}
hr{border:none;border-top:1.5px solid #222;margin:${rs.sectionSpacing||8}pt 0 5pt}
</style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 800);
  }, [name, fontFamily, nameSize, headerSize, bodySize, rs]);

  const SecTitle = ({ children }) => (
    <div style={{ fontSize: `${headerSize}pt`, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #222', margin: `${rs.sectionSpacing || 8}pt 0 5pt`, paddingBottom: '1pt' }}>{children}</div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {r.atsScore > 0 && <span style={{ fontWeight: 700, fontSize: 13, color: SCORE_COLOR(r.atsScore) }}>ATS: {r.atsScore}/100</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownload}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'white', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151' }}>
            ⬇ Download Resume
          </button>
          <button onClick={handleDownload}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#00c46a', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
            🖨 Print / Save PDF
          </button>
        </div>
      </div>

      <div id="resume-paper-content" style={{ background: 'white', padding: `${rs.margin || 14}mm ${rs.sideMargin || 18}mm`, fontFamily, fontSize: `${bodySize}pt`, lineHeight: 1.45, boxShadow: '0 2px 20px rgba(0,0,0,0.15)', border: '1px solid #d1d5db', width:'794px', minWidth:'794px', boxSizing:'border-box', position:'relative', pageBreakAfter:'auto', breakAfter:'auto' }}>
        {/* Header */}
        <h1 style={{ fontSize: `${nameSize}pt`, fontWeight: 'bold', textAlign: 'center', marginBottom: '3pt' }}>{name || 'Your Name'}</h1>
        <div style={{ fontSize: `${Math.max(bodySize - 1, 8)}pt`, color: '#444', textAlign: 'center', marginBottom: '8pt' }}>
          {[location, phone, email, li && <a key="li" href={li} style={{ color: '#444' }}>LinkedIn</a>, gh && <a key="gh" href={gh} style={{ color: '#444' }}>GitHub</a>, portfolio && <a key="po" href={portfolio} style={{ color: '#444' }}>Portfolio</a>].filter(Boolean).reduce((a, x, i) => [...a, ...(i > 0 ? [' | '] : []), x], [])}
        </div>
        <hr style={{ borderTop: '1px solid #222', marginBottom: `${rs.sectionSpacing || 8}pt` }} />

        {/* Sections rendered in drag-to-reorder order */}
        {(sectionOrder || ['personal','education','skills','publications','experience','projects','certifications']).map(secId => {
          if (secId === 'summary' || secId === 'personal') {
            return summary ? <div key="summary"><SecTitle>Summary</SecTitle><p style={{ fontSize: `${bodySize}pt` }}>{summary}</p></div> : null;
          }
          if (secId === 'education') {
            return education.length > 0 ? (
              <div key="education">
                <SecTitle>Education & Certifications</SecTitle>
                {education.map((edu, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: `${rs.entrySpacing || 4}pt` }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: `${bodySize + 0.5}pt` }}>{edu.institution}</div>
                      <div style={{ fontStyle: 'italic', fontSize: `${bodySize}pt` }}>{edu.degree}{edu.gpa ? ` · GPA: ${edu.gpa}` : ''}</div>
                    </div>
                    <div style={{ fontSize: `${bodySize - 1}pt`, color: '#555', fontStyle: 'italic', textAlign: 'right' }}>
                      {edu.startDate && `${edu.startDate} – `}{edu.endDate}{edu.location ? <div>{edu.location}</div> : null}
                    </div>
                  </div>
                ))}
                {certs.length > 0 && <div style={{ fontSize: `${bodySize}pt`, marginTop: '3pt' }}>{certs.map((c,i) => <span key={i}>{typeof c==='object'?c.name||c:c}{i<certs.length-1?' | ':''}</span>)}</div>}
              </div>
            ) : null;
          }
          if (secId === 'skills') {
            return skills.length > 0 ? (
              <div key="skills"><SecTitle>Technical Skills</SecTitle><div style={{ fontSize: `${bodySize}pt` }}><strong>Skills: </strong>{skills.join(', ')}</div></div>
            ) : null;
          }
          if (secId === 'publications') {
            return pubs.length > 0 ? (
              <div key="publications">
                <SecTitle>Publications</SecTitle>
                {pubs.map((pub, i) => {
                  const title = typeof pub === 'object' ? pub.title || pub : pub;
                  const link = typeof pub === 'object' ? pub.link || '' : '';
                  return <div key={i} style={{ fontSize: `${bodySize}pt`, marginBottom: '3pt' }}>• {title}{link && <a href={link} style={{ marginLeft: 4, color: '#333', fontSize: `${bodySize-1}pt` }}>[Link]</a>}</div>;
                })}
              </div>
            ) : null;
          }
          if (secId === 'experience') {
            return experience.length > 0 ? (
              <div key="experience">
                <SecTitle>Professional Experience</SecTitle>
                {experience.map((exp, i) => (
                  <div key={i} style={{ marginBottom: `${rs.entrySpacing || 7}pt` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 'bold', fontSize: `${bodySize + 0.5}pt` }}>{exp.company}</div>
                      <div style={{ fontSize: `${bodySize - 1}pt`, color: '#555', fontStyle: 'italic' }}>
                        {exp.startDate && `${exp.startDate} – `}{exp.endDate || (exp.current ? 'Present' : '')}{exp.location ? ` | ${exp.location}` : ''}
                      </div>
                    </div>
                    <div style={{ fontStyle: 'italic', fontSize: `${bodySize}pt`, marginBottom: '2pt' }}>{exp.title}</div>
                    <ul style={{ paddingLeft: '14pt', margin: '2pt 0' }}>
                      {(exp.bullets || []).filter(Boolean).map((b, j) => <li key={j} style={{ fontSize: `${bodySize}pt`, marginBottom: `${rs.entrySpacing || 1.5}pt` }}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null;
          }
          if (secId === 'projects') {
            return projects.length > 0 ? (
              <div key="projects">
                <SecTitle>Open-Source Projects</SecTitle>
                {projects.map((proj, i) => (
                  <div key={i} style={{ marginBottom: `${rs.entrySpacing || 5}pt` }}>
                    <div style={{ fontWeight: 'bold', fontSize: `${bodySize + 0.5}pt` }}>{proj.name}{proj.link && <span style={{ fontWeight: 'normal', marginLeft: 6, fontSize: `${bodySize - 1}pt` }}>| <a href={proj.link} style={{ color: '#333' }}>Link</a></span>}</div>
                    <ul style={{ paddingLeft: '14pt', margin: '2pt 0' }}>
                      {(proj.bullets || []).filter(Boolean).map((b, j) => <li key={j} style={{ fontSize: `${bodySize}pt`, marginBottom: '1.5pt' }}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null;
          }
          if (secId === 'certifications') {
            return certs.length > 0 && education.length === 0 ? (
              <div key="certifications">
                <SecTitle>Certifications</SecTitle>
                <div style={{ fontSize: `${bodySize}pt` }}>{certs.map((c,i) => <span key={i}>{typeof c==='object'?c.name||c:c}{i<certs.length-1?' | ':''}</span>)}</div>
              </div>
            ) : null;
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ── Main ResumeManager ──────────────────────────────────────────────────────
// Auto-scales the resume preview to fit the available container width
function AutoScaleResume({ children }) {
  const outerRef = React.useRef(null);
  const paperRef = React.useRef(null);
  const [scale, setScale] = React.useState(0.7);
  const [paperH, setPaperH] = React.useState(1122);

  React.useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    const recompute = () => {
      const availW = outer.clientWidth || 700;
      const s = Math.min(0.94, Math.max(0.35, (availW - 40) / 794));
      setScale(s);
      // Measure real rendered height of paper content
      if (paperRef.current) {
        setPaperH(paperRef.current.scrollHeight || 1122);
      }
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(outer);
    if (paperRef.current) ro.observe(paperRef.current);
    return () => ro.disconnect();
  }, []);

  // Outer wrapper height = paperH * scale so the container fits exactly
  const scaledH = Math.round(paperH * scale) + 40;

  return (
    <div ref={outerRef} style={{ background:'#e8eaed', width:'100%', padding:'20px 0', minHeight: scaledH }}>
      <div style={{
        width: 794,
        transformOrigin: 'top center',
        transform: `scale(${scale})`,
        margin: '0 auto',
        marginBottom: (scale - 1) * paperH, // negative margin compensates for scaled whitespace
      }}>
        <div ref={paperRef}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ResumeManager() {
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [profile, setProfile] = useState(null);
  const [viewTab, setViewTab] = useState('list');
  const [rightTab, setRightTab] = useState('ai-rewrite'); // ai-rewrite | editor | style
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [reparsing, setReparsing] = useState(false);
  const uploadRef = useRef();

  // Style options
  const [resumeStyle, setResumeStyle] = useState({ fontFamily: "'Times New Roman', serif", nameSize: 17, headerSize: 11, bodySize: 9.5, sectionSpacing: 8, entrySpacing: 1.5, margin: 14, sideMargin: 18 });

  // JD Analysis
  const [jdText, setJdText] = useState('');
  const [jdCareer, setJdCareer] = useState('');
  const [jdResult, setJdResult] = useState(null);
  const [jdLoading, setJdLoading] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [rephraseExp, setRephraseExp] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState(null);
  const [marketRoles, setMarketRoles] = useState(MARKET_ROLES_DEFAULT);
  const [customRole, setCustomRole] = useState('');
  const [useCustomRole, setUseCustomRole] = useState(false);

  // AI chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef();

  // Editor state
  const [editingSection, setEditingSection] = useState(null);
  const [editInstr, setEditInstr] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  // Drag-to-reorder
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [sectionOrder, setSectionOrder] = useState(['personal','education','skills','publications','experience','projects','certifications']);

  useEffect(() => {
    Promise.all([resumeAPI.list(), profileAPI.get(), resumeAPI.fetchMarketRoles()])
      .then(([r, p, mr]) => {
        const resList = r.data || [];
        setResumes(resList);
        setProfile(p.data);
        if (resList.length > 0) {
          const pri = resList.find(x => x.isPrimary) || resList[0];
          setSelectedResume(pri);
        }
        if (mr.data && Array.isArray(mr.data)) setMarketRoles(mr.data);
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleUpload = async e => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true); setError('');
    const fd = new FormData();
    fd.append('resume', file);
    fd.append('resumeName', file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
    try {
      const r = await resumeAPI.upload(fd);
      const newList = [...resumes, r.data.resume];
      setResumes(newList);
      setSelectedResume(r.data.resume);
      setViewTab('editor');
      const p = await profileAPI.get();
      setProfile(p.data);
    } catch (e) { setError(e.response?.data?.error || 'Upload failed. Ensure file is PDF, DOCX, or TXT.'); }
    finally { setUploading(false); uploadRef.current.value = ''; }
  };

  const setPrimary = async id => {
    await resumeAPI.setPrimary(id);
    setResumes(prev => prev.map(r => ({ ...r, isPrimary: r._id === id })));
  };

    const reparseResume = async (id) => {
    if (!window.confirm('Re-parse will re-extract all data from the original uploaded file. Continue?')) return;
    try {
      const r = await resumeAPI.reparse(id);
      const updated = r.data.resume;
      setResumes(prev => prev.map(res => res._id === id ? updated : res));
      if (selectedResume?._id === id) setSelectedResume(updated);
      const p = r.data.parsed || {};
      alert(`✅ Re-parsed! Found: ${p.expFound || 0} experience, ${p.eduFound || 0} education, ${p.skillsFound || 0} skills.`);
    } catch (e) {
      alert(e.response?.data?.error || 'Re-parse failed. Please delete and re-upload the file.');
    }
  };

  const deleteResume = async id => {
    if (!window.confirm('Delete this resume?')) return;
    await resumeAPI.remove(id);
    const updated = resumes.filter(r => r._id !== id);
    setResumes(updated);
    if (selectedResume?._id === id) { setSelectedResume(updated[0] || null); setViewTab('list'); }
  };

  const analyzeJD = async () => {
    if (!jdText.trim() && !jdCareer) return;
    setJdLoading(true); setJdResult(null); setSelectedSkills([]); setTailorResult(null);
    try {
      const effectiveRole = useCustomRole && customRole.trim() ? customRole.trim() : jdCareer;
      const r = await resumeAPI.analyzeJD(selectedResume._id, { jdText, targetCareer: effectiveRole });
      setJdResult(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Analysis failed.'); }
    finally { setJdLoading(false); }
  };

  const doTailor = async () => {
    if (selectedSkills.length === 0 && !rephraseExp) return;
    setTailoring(true); setTailorResult(null);
    try {
      const r = await resumeAPI.tailor(selectedResume._id, {
        jdText: jdText || `Targeting ${jdCareer}`,
        selectedSkills, rephraseExperience: rephraseExp,
        targetCareer: (useCustomRole && customRole.trim() ? customRole.trim() : jdCareer) || selectedResume.targetCareer,
      });
      setTailorResult(r.data);
      const updated = { ...selectedResume, ...r.data.resume, atsScore: r.data.atsAfter };
      setResumes(prev => prev.map(res => res._id === selectedResume._id ? updated : res));
      setSelectedResume(updated);
    } catch (e) { setError(e.response?.data?.error || 'Tailoring failed.'); }
    finally { setTailoring(false); }
  };

  const handleEditSection = async section => {
    if (!editInstr.trim()) return;
    setEditLoading(true);
    try {
      const sectionData = section.id === 'experience' ? selectedResume.experience
        : section.id === 'skills' ? selectedResume.skills
        : section.id === 'projects' ? selectedResume.projects
        : section.id === 'publications' ? selectedResume.publications
        : selectedResume.summary || '';
      const r = await resumeAPI.editSection(selectedResume._id, {
        section: section.id,
        currentContent: JSON.stringify(sectionData),
        instruction: editInstr
      });
      setEditInstr('');
      setEditingSection(null);
      // Update resume in state immediately if backend saved it
      if (r.data.saved && r.data.resume) {
        setSelectedResume(r.data.resume);
        setResumes(prev => prev.map(res => res._id === selectedResume._id ? r.data.resume : res));
      } else {
        // Reload from server
        const fresh = await resumeAPI.list();
        const updated = (fresh.data||[]).find(res => res._id === selectedResume._id);
        if (updated) { setSelectedResume(updated); setResumes(fresh.data||[]); }
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: `✅ Updated **${section.label}** successfully!` }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Edit failed. Is Qwen2.5 running? Try: ollama serve' }]);
    }
    finally { setEditLoading(false); }
  };

  const sendChat = async () => {
    const msg = chatInput.trim(); if (!msg || chatLoading || !selectedResume) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const r = await resumeAPI.chat(selectedResume._id, { message: msg, history: chatMessages.slice(-4) });
      setChatMessages(prev => [...prev, { role: 'assistant', content: r.data.response }]);
      // If AI actually changed the resume, update state immediately so preview refreshes
      if (r.data.resumeChanged && r.data.resume) {
        setSelectedResume(r.data.resume);
        setResumes(prev => prev.map(res => res._id === selectedResume._id ? r.data.resume : res));
      }
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error. Is Qwen2.5 running? (ollama serve)' }]); }
    finally { setChatLoading(false); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>📄 Resume Manager</h1>
          <p>Multiple resumes · ATS scoring · JD tailoring · AI optimization</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={uploadRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={handleUpload} />
          <button className="btn btn-primary" onClick={() => uploadRef.current.click()} disabled={uploading}>
            {uploading ? '⏳ Uploading...' : '+ Add Resume'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Resume list */}
      {resumes.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            You have <strong>{resumes.length}</strong> resume{resumes.length !== 1 ? 's' : ''} saved
          </div>
          <table className="data-table">
            <thead><tr><th>Resume</th><th>Target Career</th><th>ATS Score</th><th>Last Modified</th><th>Actions</th></tr></thead>
            <tbody>
              {resumes.map(res => (
                <tr key={res._id} style={{ cursor: 'pointer', background: selectedResume?._id === res._id ? '#f0fdf4' : undefined }}
                  onClick={() => { setSelectedResume(res); setViewTab('editor'); }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{res.name}</span>
                      {res.isPrimary && <span className="badge badge-green" style={{ fontSize: 10 }}>⭐ PRIMARY</span>}
                    </div>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{res.targetCareer || '—'}</td>
                  <td>
                    {res.atsScore > 0
                      ? <span style={{ fontWeight: 700, color: SCORE_COLOR(res.atsScore) }}>{res.atsScore}/100</span>
                      : <span style={{ color: '#9ca3af', fontSize: 12 }}>Run JD Analysis</span>
                    }
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(res.lastModified || res.uploadDate).toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5, flexWrap:'wrap' }}>
                      {!res.isPrimary && <button className="btn btn-secondary btn-sm" onClick={() => setPrimary(res._id)}>Set Primary</button>}
                      <button onClick={() => reparseResume(res._id)}
                        style={{ padding:'4px 9px', background:'#1e40af', color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}
                        title="Re-extract all data from original uploaded PDF">
                        Re-parse
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteResume(res._id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resumes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 50, marginBottom: 16 }}>
          <div style={{ fontSize: 50 }}>📄</div>
          <h3 style={{ marginTop: 14 }}>No resumes yet</h3>
          <p style={{ color: 'var(--muted)', margin: '8px 0 18px' }}>Upload your first resume to get started</p>
          <button className="btn btn-primary btn-lg" onClick={() => uploadRef.current.click()}>+ Upload Resume</button>
        </div>
      )}

      {selectedResume && (
        <>
          <div className="tab-nav">
            <button className={`tab-btn${viewTab === 'editor' ? ' active' : ''}`} onClick={() => setViewTab('editor')}>📄 Resume Editor</button>
            <button className={`tab-btn${viewTab === 'jd' ? ' active' : ''}`} onClick={() => setViewTab('jd')}>🔍 JD Analysis & ATS</button>
          </div>

          {/* EDITOR */}
          {viewTab === 'editor' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, height: 'calc(100vh - 200px)', overflow:'hidden' }}>
              {/* Left: scrollable resume viewer */}
              <div style={{ overflowY: 'auto', overflowX: 'hidden', background: '#e8eaed' }}>
                <AutoScaleResume>
                  <ResumePaper resume={selectedResume} profile={profile} style={resumeStyle} sectionOrder={sectionOrder} />
                </AutoScaleResume>
              </div>

              {/* Right panel: fixed height, own scroll — AI Rewrite | Editor | Style */}
              <div style={{ display: 'flex', flexDirection: 'column', borderLeft:'1px solid #e5e7eb', background:'white', overflowY:'auto' }}>
                {/* Right tab nav - matches Jobright exactly */}
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12, flexShrink: 0 }}>
                  {[['ai-rewrite','AI Rewrite'],['editor','Editor'],['style','Style']].map(([k, l]) => (
                    <button key={k} onClick={() => setRightTab(k)} style={{ flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: rightTab === k ? 700 : 500, background: rightTab === k ? '#1a1a2e' : 'white', color: rightTab === k ? 'white' : 'var(--muted)', transition: 'all 0.15s', fontFamily: 'inherit' }}>{l}</button>
                  ))}
                </div>

                {/* AI REWRITE tab */}
                {rightTab === 'ai-rewrite' && (
                  <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>🤖 AI Resume Assistant</div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>Tell me what to change, or ask me to improve any section. I'll update your resume directly.</p>

                    {/* Quick actions */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                      {['Improve my summary','Strengthen latest bullets','Add quantified metrics','Make ATS-friendly'].map(q => (
                        <button key={q} onClick={() => setChatInput(q)} className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 7px' }}>{q}</button>
                      ))}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, minHeight: 0 }}>
                      {chatMessages.length === 0 && (
                        <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: '24px 12px', lineHeight: 1.8 }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
                          <div>Ask me anything about your resume:</div>
                          <div style={{ marginTop: 6, fontSize: 11.5 }}>
                            "Write a cover letter for AI Engineer"<br/>
                            "Add Python to my skills"<br/>
                            "Improve my experience bullets"<br/>
                            "Fix duplicate publications"
                          </div>
                        </div>
                      )}
                      {chatMessages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: m.role === 'user' ? '#00c46a' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginTop: 2 }}>
                            {m.role === 'user' ? '👤' : '🤖'}
                          </div>
                          <div style={{ maxWidth: '88%', padding: '9px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.7, background: m.role === 'user' ? '#00c46a' : 'white', color: m.role === 'user' ? 'white' : '#1a1a2e', border: m.role === 'assistant' ? '1px solid #e5e7eb' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                            dangerouslySetInnerHTML={{ __html: fmtMsg(m.content) }} />
                        </div>
                      ))}
                      {chatLoading && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🤖</div>
                          <div style={{ padding: '9px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                            <div style={{ display: 'flex', gap: 4 }}>{[0, 0.15, 0.3].map((d, i) => <div key={i} className="typing-dot" style={{ animationDelay: `${d}s` }} />)}</div>
                          </div>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-control" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Tell me how to tweak your resume..." style={{ fontSize: 12 }} />
                      <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={!chatInput.trim() || chatLoading} style={{ background: '#00c46a', borderColor: '#00c46a' }}>✨ Edit With AI</button>
                    </div>
                  </div>
                )}

                {/* EDITOR tab */}
                {rightTab === 'editor' && (
                  <div className="card" style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 8, padding: '8px 12px', marginBottom: 10, lineHeight: 1.6 }}>
                      <strong style={{ color: '#065f46' }}>📌 Drag ⋮⋮</strong> to reorder · <strong style={{ color: '#065f46' }}>↑↓</strong> arrows to move
                    </div>

                    {sectionOrder.map((secId, idx) => {
                      const LABELS = { personal:'PERSONAL INFO', education:'EDUCATION & CERTIFICATIONS', skills:'TECHNICAL SKILLS', publications:'PUBLICATIONS', experience:'PROFESSIONAL EXPERIENCE', projects:'OPEN-SOURCE PROJECTS', certifications:'CERTIFICATIONS' };
                      return (
                        <div key={secId} style={{ marginBottom: 4 }}>
                          <div draggable
                            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx); }}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); }}
                            onDrop={e => {
                              e.preventDefault();
                              if (dragIdx === null || dragIdx === idx) return;
                              const next = [...sectionOrder];
                              const [moved] = next.splice(dragIdx, 1);
                              next.splice(idx, 0, moved);
                              setSectionOrder(next);
                              setDragIdx(null); setDragOverIdx(null);
                            }}
                            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: editingSection?.id === secId ? '8px 8px 0 0' : 8, cursor: 'grab', userSelect: 'none', background: dragOverIdx === idx ? '#f0fdf4' : dragIdx === idx ? '#fafafa' : editingSection?.id === secId ? '#f0fdf4' : '#f9fafb', border: `1.5px solid ${editingSection?.id === secId ? '#00c46a' : dragOverIdx === idx ? '#00c46a' : '#e5e7eb'}`, borderBottom: editingSection?.id === secId ? '0' : undefined, transition: 'all 0.1s', opacity: dragIdx === idx ? 0.5 : 1 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ color: '#9ca3af', fontSize: 16, lineHeight: 1, cursor: 'grab' }}>⋮⋮</span>
                              <span style={{ fontWeight: 600, fontSize: 12.5, color: editingSection?.id === secId ? '#065f46' : '#374151' }}>{LABELS[secId] || secId.toUpperCase()}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {idx > 0 && <button onClick={e => { e.stopPropagation(); const o=[...sectionOrder]; [o[idx-1],o[idx]]=[o[idx],o[idx-1]]; setSectionOrder(o); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:14, padding:'0 3px' }}>↑</button>}
                              {idx < sectionOrder.length-1 && <button onClick={e => { e.stopPropagation(); const o=[...sectionOrder]; [o[idx],o[idx+1]]=[o[idx+1],o[idx]]; setSectionOrder(o); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:14, padding:'0 3px' }}>↓</button>}
                              {/* Pencil icon - opens inline editor for this section */}
                              <button onClick={e => { e.stopPropagation(); const sec = { id: secId, label: LABELS[secId]||secId }; setEditingSection(editingSection?.id === secId ? null : sec); setEditInstr(''); }}
                                style={{ background: editingSection?.id === secId ? '#00c46a' : 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 5px', borderRadius: 5, color: editingSection?.id === secId ? 'white' : '#9ca3af', lineHeight: 1 }}
                                title={`Edit ${LABELS[secId]}`}>
                                ✏️
                              </button>
                            </div>
                          </div>
                          {/* Inline editor that expands below the row when pencil clicked */}
                          {editingSection?.id === secId && (
                            <div style={{ border: '1.5px solid #00c46a', borderTop: 0, borderRadius: '0 0 8px 8px', padding: '10px', background: '#f0fdf4' }}>
                              <textarea value={editInstr} onChange={e => setEditInstr(e.target.value)}
                                placeholder={secId === 'skills' ? 'e.g., Add PyTorch, remove Ruby, add LangChain' : secId === 'experience' ? 'e.g., Make bullets more impactful, add metrics, use action verbs' : secId === 'personal' ? 'e.g., Rewrite summary to focus on AI/ML' : 'Describe what to change...'}
                                style={{ width:'100%', padding:'7px 9px', border:'1px solid #6ee7b7', borderRadius:6, fontSize:12, fontFamily:'inherit', resize:'vertical', minHeight:52, outline:'none', background:'white', marginBottom:7 }}
                                autoFocus/>
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => handleEditSection(editingSection)} disabled={editLoading || !editInstr.trim()}
                                  style={{ flex:1, padding:'7px', background:'#00c46a', color:'white', border:'none', borderRadius:7, fontWeight:700, fontSize:12, cursor:'pointer', opacity:(!editInstr.trim()||editLoading)?0.5:1 }}>
                                  {editLoading ? '⏳ Applying...' : '✨ Apply AI Edit'}
                                </button>
                                <button onClick={() => { setEditingSection(null); setEditInstr(''); }}
                                  style={{ padding:'7px 12px', background:'white', color:'#374151', border:'1px solid #e5e7eb', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={() => setSectionOrder(['personal','education','skills','publications','experience','projects','certifications'])}>↺ Reset Order</button>

                    {/* Pencil icons on each section row above open inline editors - no separate panel needed */}
                    <div style={{ borderTop:'1px solid var(--border)', marginTop:10, paddingTop:8 }}>
                      <div style={{ fontSize:11.5, color:'#9ca3af', textAlign:'center' }}>Click ✏️ on any section above to edit its content</div>
                    </div>
                  </div>
                )}

                {/* STYLE tab */}
                {rightTab === 'style' && (
                  <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
                    {/* Template selector */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Resume Template</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { id: 'standard', label: 'Standard', style: { fontFamily:"'Times New Roman', serif", nameSize:17, headerSize:11, bodySize:9.5, sectionSpacing:8, entrySpacing:1.5, margin:14, sideMargin:18 } },
                          { id: 'compact',  label: 'Compact',  style: { fontFamily:"'Arial', sans-serif",      nameSize:15, headerSize:9,  bodySize:8,   sectionSpacing:5, entrySpacing:1,   margin:8,  sideMargin:12 } },
                        ].map(t => {
                          const isActive = t.id === 'compact'
                            ? resumeStyle.bodySize <= 8.5
                            : resumeStyle.bodySize >= 9;
                          return (
                            <div key={t.id} onClick={() => setResumeStyle(prev => ({ ...prev, ...t.style }))}
                              style={{ border: `2px solid ${isActive ? '#00c46a' : '#e5e7eb'}`, borderRadius: 8, padding: 8, textAlign: 'center', cursor: 'pointer', background: isActive ? '#f0fdf4' : 'white' }}>
                              <div style={{ height: 72, background: '#f1f5f9', borderRadius: 4, marginBottom: 6, overflow:'hidden', position:'relative', border:'1px solid #e5e7eb' }}>
                                {t.id === 'compact' ? (
                                  <div style={{ padding:'4px 5px', transform:'scale(0.7)', transformOrigin:'top left', width:'143%' }}>
                                    <div style={{ height:4, background:'#374151', borderRadius:1, marginBottom:3, width:'60%', margin:'0 auto 2px' }}/>
                                    <div style={{ height:2, background:'#9ca3af', borderRadius:1, marginBottom:4, width:'80%', margin:'0 auto 3px' }}/>
                                    {[100,100,100,90,85,100,100,85].map((w,i)=><div key={i} style={{ height:1.5, background:i%3===0?'#374151':'#d1d5db', borderRadius:1, marginBottom:1.5, width:`${w}%` }}/>)}
                                  </div>
                                ) : (
                                  <div style={{ padding:'5px 6px' }}>
                                    <div style={{ height:5, background:'#374151', borderRadius:1, marginBottom:3, width:'55%', margin:'0 auto 3px' }}/>
                                    <div style={{ height:2, background:'#9ca3af', borderRadius:1, marginBottom:5, width:'75%', margin:'0 auto 4px' }}/>
                                    {[100,90,100,80,100].map((w,i)=><div key={i} style={{ height:2.5, background:i%3===0?'#374151':'#d1d5db', borderRadius:1, marginBottom:2.5, width:`${w}%` }}/>)}
                                    <div style={{ height:1.5, background:'#e5e7eb', margin:'4px 0 3px' }}/>
                                    {[100,95,88].map((w,i)=><div key={i} style={{ height:2, background:'#d1d5db', borderRadius:1, marginBottom:2, width:`${w}%` }}/>)}
                                  </div>
                                )}
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#065f46' : '#374151' }}>{t.label}</div>
                              <div style={{ fontSize: 10, color: isActive ? '#00c46a' : '#9ca3af', fontWeight: 600 }}>{isActive ? '✓ Active' : t.id === 'standard' ? '★ Default' : 'Shrinks content'}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }} onClick={() => setResumeStyle(prev => ({ ...prev, margin: 8, sideMargin: 12, bodySize: 8, sectionSpacing: 4, entrySpacing: 1, nameSize: 15, headerSize: 9 }))}>✨ Fit Resume to One Page</button>

                    {/* Font */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Font</div>
                      <div className="form-group">
                        <label className="form-label">Font Family</label>
                        <select className="form-control" value={resumeStyle.fontFamily} onChange={e => setResumeStyle(p => ({ ...p, fontFamily: e.target.value }))}>
                          <option value="'Times New Roman', serif">Times New Roman</option>
                          <option value="'Georgia', serif">Georgia</option>
                          <option value="'Arial', sans-serif">Arial</option>
                          <option value="'Helvetica', sans-serif">Helvetica</option>
                          <option value="'Calibri', sans-serif">Calibri</option>
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[['nameSize', 'Name', 14, 24], ['headerSize', 'Section Headers', 9, 14], ['bodySize', 'Body Text', 8, 12]].map(([key, label, min, max]) => (
                          <div key={key}>
                            <label className="form-label">{label}</label>
                            <select className="form-control" value={resumeStyle[key]} onChange={e => setResumeStyle(p => ({ ...p, [key]: Number(e.target.value) }))}>
                              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Spacing */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Spacing & Margin</div>
                      {[['sectionSpacing', 'Section Spacing', 4, 16], ['margin', 'Top & Bottom Margin', 8, 25], ['sideMargin', 'Side Margins', 10, 30]].map(([key, label, min, max]) => (
                        <div key={key} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                            <span>{label}</span>
                            <span style={{ color: '#9ca3af' }}>{resumeStyle[key]}</span>
                          </div>
                          <input type="range" min={min} max={max} step="1" value={resumeStyle[key]} onChange={e => setResumeStyle(p => ({ ...p, [key]: Number(e.target.value) }))} style={{ width: '100%' }} />
                        </div>
                      ))}
                    </div>

                    <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setResumeStyle({ fontFamily: "'Times New Roman', serif", nameSize: 17, headerSize: 11, bodySize: 9.5, sectionSpacing: 8, entrySpacing: 1.5, margin: 14, sideMargin: 18 })}>
                      ↺ Reset formatting
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JD ANALYSIS TAB */}
          {viewTab === 'jd' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div className="card" style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 14 }}>🔍 JD Analysis & ATS Scorer</h3>
                  <div className="form-group">
                    <label className="form-label">Target Career ({marketRoles.length} roles available)</label>
                    {!useCustomRole ? (
                      <select className="form-control" value={jdCareer} onChange={e => setJdCareer(e.target.value)}>
                        <option value="">-- Select from {marketRoles.length} roles --</option>
                        {marketRoles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <input className="form-control" value={customRole} onChange={e => setCustomRole(e.target.value)}
                        placeholder="e.g., AI Security Engineer, MLOps Lead, Edge AI Developer..." autoFocus/>
                    )}
                    <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
                      <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12.5, color:'#6b7280' }}>
                        <input type="checkbox" checked={useCustomRole} onChange={e => setUseCustomRole(e.target.checked)} style={{ accentColor:'#6366f1' }}/>
                        Enter a custom role not in the list
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job Description (or leave blank to use target career)</label>
                    <textarea className="form-control" rows={8} value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the full job description here...&#10;&#10;e.g., We are looking for a Machine Learning Engineer with expertise in Python, TensorFlow, PyTorch, LangChain, and strong background in NLP and deep learning..." />
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={analyzeJD} disabled={jdLoading || (!jdText.trim() && !jdCareer)}>
                    {jdLoading ? '⏳ Analyzing...' : '🔍 Analyze JD vs My Resume'}
                  </button>
                </div>

                {jdResult && (
                  <div className="card">
                    <div style={{ display: 'flex', gap: 16, marginBottom: 14, alignItems: 'center' }}>
                      <div style={{ width: 72, height: 72, borderRadius: '50%', border: `4px solid ${SCORE_COLOR(jdResult.matchPercentage)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: SCORE_COLOR(jdResult.matchPercentage), lineHeight: 1 }}>{jdResult.matchPercentage}%</span>
                        <span style={{ fontSize: 8, color: '#9ca3af' }}>MATCH</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>JD Match Analysis</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>ATS Score: <strong style={{ color: SCORE_COLOR(jdResult.atsScore) }}>{jdResult.atsScore}/100</strong></div>
                        {jdResult.hiringLikelihood && <span className={`badge ${jdResult.hiringLikelihood === 'Strong' ? 'badge-green' : jdResult.hiringLikelihood === 'Moderate' ? 'badge-yellow' : 'badge-red'}`} style={{ marginTop: 6 }}>🎯 {jdResult.hiringLikelihood} Fit</span>}
                      </div>
                    </div>
                    {jdResult.aiUsed && <span className="ai-badge" style={{ marginBottom: 10, display: 'inline-flex' }}>🤖 AI Enhanced</span>}
                    {jdResult.summary && <p style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.7, background: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 12 }}>{jdResult.summary}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#00c46a', marginBottom: 6 }}>✅ You Have</div>
                        {jdResult.presentSkills?.map((s, i) => <span key={i} className="tag tag-primary" style={{ fontSize: 11.5 }}>{s}</span>)}
                        {!jdResult.presentSkills?.length && <span style={{ fontSize: 12, color: '#9ca3af' }}>Add skills to profile</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#ef4444', marginBottom: 6 }}>❌ Missing</div>
                        {jdResult.missingSkills?.map((s, i) => <span key={i} className="tag tag-red" style={{ fontSize: 11.5 }}>{s}</span>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tailor panel */}
              <div>
                <div className="card" style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, marginBottom: 4 }}>🎯 Tailor My Resume</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>Select missing skills to add. AI updates your resume while keeping all your existing content.</p>

                  {jdResult ? (
                    <>
                      {jdResult.missingSkills?.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>Add Missing Skills ({selectedSkills.length}/{jdResult.missingSkills.length} selected)</div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedSkills(selectedSkills.length === jdResult.missingSkills.length ? [] : [...jdResult.missingSkills])}>
                              {selectedSkills.length === jdResult.missingSkills.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {jdResult.missingSkills.map((s, i) => (
                              <span key={i} onClick={() => setSelectedSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                                className="tag" style={{ cursor: 'pointer', border: `1.5px solid ${selectedSkills.includes(s) ? '#00c46a' : '#e5e7eb'}`, background: selectedSkills.includes(s) ? '#d1fae5' : '#f9fafb', color: selectedSkills.includes(s) ? '#065f46' : '#374151', fontWeight: selectedSkills.includes(s) ? 600 : 400, fontSize: 12.5 }}>
                                {selectedSkills.includes(s) ? '✓ ' : ''}{s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {jdResult.missingSkills?.length === 0 && <div className="alert alert-success">✅ No missing keywords — your resume is already well-matched!</div>}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <input type="checkbox" id="rephrase" checked={rephraseExp} onChange={e => setRephraseExp(e.target.checked)} />
                        <label htmlFor="rephrase" style={{ fontSize: 13, cursor: 'pointer' }}>Also rephrase experience bullets to match JD keywords (AI)</label>
                      </div>

                      <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', background: '#00c46a', borderColor: '#00c46a' }} onClick={doTailor}
                        disabled={tailoring || (selectedSkills.length === 0 && !rephraseExp)}>
                        {tailoring ? '⏳ AI Updating Resume...' : '🚀 Update Resume with AI'}
                      </button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                      <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
                      <p style={{ fontSize: 12.5 }}>Run JD Analysis first to see skill gaps and tailoring options.</p>
                    </div>
                  )}
                </div>

                {tailorResult && (
                  <div className="card">
                    <h3 style={{ fontSize: 14, marginBottom: 12 }}>✅ Tailoring Complete</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12, textAlign: 'center' }}>
                      {[['ATS Before', tailorResult.atsBefore, '#9ca3af'], ['ATS After', tailorResult.atsAfter, '#00c46a'], ['Improvement', `+${tailorResult.improvement}`, '#00c46a']].map(([l, v, c]) => (
                        <div key={l} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 6px' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Changes Made:</div>
                    {(tailorResult.changesMade || []).map((c, i) => <div key={i} style={{ fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>✅ {c}</div>)}
                    <button className="btn btn-primary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => setViewTab('editor')}>View Updated Resume →</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
