import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI, resumeAPI } from '../utils/api';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtAge = h => h < 1 ? 'Just now' : h < 24 ? `${Math.round(h)}h ago` : `${Math.floor(h/24)}d ago`;
const SC = s => s >= 80 ? '#00c46a' : s >= 65 ? '#3b82f6' : s >= 45 ? '#f59e0b' : '#94a3b8';
const LABEL = { 'Strong Match':'Strong Match','Good Match':'Good Match','Fair Match':'Fair Match','Low Match':'Low Match' };

const SOURCE_STYLE = {
  Greenhouse: { bg:'#dcfce7', color:'#166534' },
  Lever:      { bg:'#dbeafe', color:'#1e40af' },
  LinkedIn:   { bg:'#e0f2fe', color:'#0369a1' },
  Indeed:     { bg:'#ede9fe', color:'#5b21b6' },
  Seed:       { bg:'#f1f5f9', color:'#475569' },
};

// Company domains for logo lookup
const DOMAINS = {
  'Google':'google.com','Microsoft':'microsoft.com','Amazon':'amazon.com','Meta':'meta.com',
  'Apple':'apple.com','Netflix':'netflix.com','OpenAI':'openai.com','Anthropic':'anthropic.com',
  'Stripe':'stripe.com','Airbnb':'airbnb.com','Shopify':'shopify.com','Databricks':'databricks.com',
  'Figma':'figma.com','Notion':'notion.so','Discord':'discord.com','Cloudflare':'cloudflare.com',
  'MongoDB':'mongodb.com','Elastic':'elastic.co','Confluent':'confluent.io','HashiCorp':'hashicorp.com',
  'Vercel':'vercel.com','Netlify':'netlify.com','Twilio':'twilio.com','Salesforce':'salesforce.com',
  'Adobe':'adobe.com','NVIDIA':'nvidia.com','LinkedIn':'linkedin.com','Snowflake':'snowflake.com',
  'Palantir':'palantir.com','Cohere':'cohere.com','Hugging Face':'huggingface.co',
  'Scale AI':'scale.com','Canva':'canva.com','Reddit':'reddit.com','Airtable':'airtable.com',
  'Brex':'brex.com','Rippling':'rippling.com','Plaid':'plaid.com','Gusto':'gusto.com',
  'Grafana Labs':'grafana.com','Weaviate':'weaviate.io','Retool':'retool.com',
};

function CompanyLogo({ logo, company, size=44 }) {
  const letter = (company||'?')[0].toUpperCase();
  const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#6366f1','#ef4444'];
  const bg = colors[letter.charCodeAt(0) % colors.length];
  const domain = logo ? null : (DOMAINS[company] || (company?.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'') + '.com'));
  const [src, setSrc] = useState(logo || (domain ? `https://logo.clearbit.com/${domain}` : null));
  const [fails, setFails] = useState(0);

  useEffect(() => {
    const d = logo ? null : (DOMAINS[company] || (company?.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'') + '.com'));
    setSrc(logo || (d ? `https://logo.clearbit.com/${d}` : null));
    setFails(0);
  }, [company, logo]);

  const onErr = () => {
    if (fails === 0 && domain) { setSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`); setFails(1); }
    else setFails(2);
  };

  if (!src || fails >= 2) return (
    <div style={{ width:size, height:size, borderRadius:size*0.2, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'white', fontWeight:800, fontSize:size*0.42 }}>{letter}</div>
  );
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.2, background:'white', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:4, flexShrink:0 }}>
      <img src={src} alt={company} onError={onErr} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter constants
// ─────────────────────────────────────────────────────────────────────────────
const JOB_FUNCTIONS = [
  'Machine Learning Engineer','AI Engineer','LLM Engineer','ML/AI Researcher',
  'ML Infrastructure','MLOps','Deep Learning','Computer Vision','NLP Engineer',
  'Data Engineer','Data Scientist','Data Analyst',
  'Software Engineer','Full Stack Engineer','Backend Engineer','Frontend Engineer',
  'DevOps Engineer','Cloud Engineer','Platform Engineer','SRE',
  'Security Engineer','Network Engineer','Systems Engineer','Solutions Architect',
];
const DATE_OPTIONS = [
  { label:'Past 24 hours', hours:24 },
  { label:'Past 3 days',   hours:72 },
  { label:'Past week',     hours:168 },
  { label:'Past month',    hours:720 },
];

function applyLocalFilters(jobs, f) {
  if (!f || !Object.keys(f).length) return jobs;
  return jobs.filter(j => {
    const tl = (j.title||'').toLowerCase();
    const dl = (j.description||'').toLowerCase();
    if (f.jobFunction) {
      const fn = f.jobFunction.toLowerCase().split(' ')[0];
      if (!tl.includes(fn) && !(j.category||'').toLowerCase().includes(fn)) return false;
    }
    if (f.jobTypes?.length && !f.jobTypes.some(t => (j.jobType||'').includes(t))) return false;
    if (f.workModels?.length) {
      if (!f.workModels.some(m => {
        if (m === 'Remote (US)') return /remote/i.test(j.locationType||'');
        return (j.locationType||'').toLowerCase() === m.toLowerCase();
      })) return false;
    }
    if (f.maxHours && (j.postedHoursAgo||0) > f.maxHours) return false;
    if (f.h1bOnly && j.h1bSponsor === false) return false; // only exclude jobs explicitly marked no-h1b
    if (f.excludeClearance && /clearance|secret|classified/i.test(dl)) return false;
    if (f.excludeUsCitizenOnly && /us citizen only|must be us citizen/i.test(dl)) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Drawer (Jobright-style inline filter bar + side drawer)
// ─────────────────────────────────────────────────────────────────────────────
function FilterDrawer({ filters, setFilters, onClose }) {
  const [local, setLocal] = useState(filters);
  const upd = (k, v) => setLocal(p => ({ ...p, [k]: v }));
  const toggleArr = (k, v) => setLocal(p => {
    const a = p[k]||[];
    return { ...p, [k]: a.includes(v) ? a.filter(x=>x!==v) : [...a,v] };
  });

  const Chip = ({ label, active, onClick }) => (
    <span onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12.5, padding:'5px 12px', borderRadius:8, cursor:'pointer', userSelect:'none', border:`1.5px solid ${active?'#00c46a':'#e5e7eb'}`, background:active?'#f0fdf4':'#fff', color:active?'#065f46':'#374151', fontWeight:active?600:400, transition:'all 0.1s' }}>
      {active && <span style={{ fontSize:10 }}>✓</span>} {label}
    </span>
  );
  const Sec = ({ title, children }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ position:'fixed', top:0, right:0, height:'100vh', width:360, background:'#fff', borderLeft:'1px solid #e5e7eb', zIndex:1000, overflowY:'auto', boxShadow:'-8px 0 32px rgba(0,0,0,0.12)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
        <div style={{ fontWeight:800, fontSize:16 }}>All Filters</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => { setLocal({}); setFilters({}); }} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:13, fontWeight:600 }}>Clear All</button>
          <button onClick={() => { setFilters(local); onClose(); }} style={{ background:'#00c46a', color:'white', border:'none', borderRadius:8, padding:'7px 16px', fontWeight:700, fontSize:13, cursor:'pointer' }}>Apply</button>
          <button onClick={onClose} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:18, lineHeight:1, color:'#374151' }}>✕</button>
        </div>
      </div>

      <div style={{ padding:'20px 20px 40px' }}>

        <Sec title="Job Function">
          <select style={{ width:'100%', padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, background:'#fff' }} value={local.jobFunction||''} onChange={e => upd('jobFunction', e.target.value)}>
            <option value="">All Job Functions</option>
            {JOB_FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Sec>

        <Sec title="Job Type">
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {['Full-time','Contract','Part-time','Internship'].map(t => <Chip key={t} label={t} active={(local.jobTypes||[]).includes(t)} onClick={() => toggleArr('jobTypes', t)}/>)}
          </div>
        </Sec>

        <Sec title="Work Model">
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {['Remote (US)','Hybrid','Onsite'].map(t => <Chip key={t} label={t} active={(local.workModels||[]).includes(t)} onClick={() => toggleArr('workModels', t)}/>)}
          </div>
        </Sec>

        <Sec title="Location">
          <div style={{ padding:'8px 12px', background:'#f0fdf4', borderRadius:8, fontSize:13, color:'#065f46', fontWeight:600 }}>🇺🇸 United States Only</div>
        </Sec>

        <Sec title="Experience Level">
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {['Intern/New Grad','Entry Level','Mid Level','Senior Level','Lead/Staff','Director'].map(t => <Chip key={t} label={t} active={(local.expLevels||[]).includes(t)} onClick={() => toggleArr('expLevels', t)}/>)}
          </div>
        </Sec>

        <Sec title="Date Posted">
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {DATE_OPTIONS.map(t => <Chip key={t.label} label={t.label} active={local.maxHours===t.hours} onClick={() => upd('maxHours', local.maxHours===t.hours ? null : t.hours)}/>)}
          </div>
        </Sec>

        <Sec title="Minimum Annual Salary">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <input type="range" min={0} max={250} step={10} value={(local.minSalary||0)/1000} onChange={e => upd('minSalary', Number(e.target.value)*1000)} style={{ flex:1 }}/>
            <span style={{ fontSize:13, fontWeight:700, color:'#374151', minWidth:60 }}>{local.minSalary ? `$${local.minSalary/1000}K/yr` : 'Any'}</span>
          </div>
        </Sec>

        <Sec title="Work Authorization">
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13, fontWeight:500 }}>
            <input type="checkbox" checked={!!local.h1bOnly} onChange={e => upd('h1bOnly', e.target.checked)} style={{ width:16, height:16, accentColor:'#00c46a' }}/>
            H1B Sponsorship Likely
          </label>
        </Sec>

        <Sec title="Exclude Jobs With">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={!!local.excludeClearance} onChange={e => upd('excludeClearance', e.target.checked)} style={{ width:16, height:16, accentColor:'#ef4444' }}/>
              Security Clearance Required
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={!!local.excludeUsCitizenOnly} onChange={e => upd('excludeUsCitizenOnly', e.target.checked)} style={{ width:16, height:16, accentColor:'#ef4444' }}/>
              US Citizen Only
            </label>
          </div>
        </Sec>

        <Sec title="Company Stage">
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {['Early Stage','Growth Stage','Late Stage','Public Company'].map(t => <Chip key={t} label={t} active={(local.companyStages||[]).includes(t)} onClick={() => toggleArr('companyStages', t)}/>)}
          </div>
        </Sec>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Detail Panel — Jobright-style with Overview / Company tabs
// ─────────────────────────────────────────────────────────────────────────────
function JobDetail({ job, isSaved, isApplied, onSave, onApply, onDismiss }) {
  const [detailTab, setDetailTab] = useState('overview');

  if (!job) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'#94a3b8' }}>
      <div style={{ fontSize:52 }}>💼</div>
      <div style={{ fontSize:15, fontWeight:600 }}>Select a job to view details</div>
    </div>
  );

  const ss = SOURCE_STYLE[job.source] || SOURCE_STYLE.Seed;
  const directUrl = job.applyUrl || job.sourceUrl;
  const careerUrl = job.careerPageUrl;

  // Determine skills that user has vs doesn't have
  const matchingSkills = job.matchingSkills || [];
  const missingSkills  = job.missingSkills  || [];
  const allJobSkills   = job.tags || [];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#fff' }}>
      {/* Top action bar */}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={onDismiss} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:16, color:'#94a3b8', display:'flex', alignItems:'center', justifyContent:'center' }} title="Not interested">🚫</button>
          <button onClick={onSave} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:isSaved?'#f59e0b':'#94a3b8' }} title={isSaved?'Unsave':'Save'}>
            {isSaved ? '★' : '☆'}
          </button>
          {job.applicants > 0 && <span style={{ fontSize:12.5, color:'#6b7280', background:'#f1f5f9', padding:'4px 10px', borderRadius:20 }}>{job.applicants} applicants</span>}
          {job.earlyApplicant && <span style={{ fontSize:12, background:'#d1fae5', color:'#065f46', padding:'4px 10px', borderRadius:20, fontWeight:600 }}>Be an early applicant</span>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {/* ORIGINAL JOB POST BUTTON — primary action */}
          {directUrl && (
            <a href={directUrl} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'white', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:9, fontWeight:600, fontSize:13.5, textDecoration:'none', cursor:'pointer' }}>
              📄 Original Job Post
            </a>
          )}
          <button onClick={onApply}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 20px', background:'#00c46a', color:'white', border:'none', borderRadius:9, fontWeight:700, fontSize:13.5, cursor:'pointer' }}>
            Apply with AI ↗
          </button>
        </div>
      </div>

      {/* Overview / Company tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid #f1f5f9', flexShrink:0, padding:'0 20px' }}>
        {['overview','company'].map(t => (
          <button key={t} onClick={() => setDetailTab(t)}
            style={{ padding:'10px 16px', background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:detailTab===t?700:500, color:detailTab===t?'#111':'#6b7280', borderBottom:detailTab===t?'2px solid #00c46a':'2px solid transparent', marginBottom:-2, textTransform:'capitalize' }}>
            {t === 'overview' ? 'Overview' : 'Company'}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ overflowY:'auto', flex:1, padding:'20px 20px 40px' }}>

        {detailTab === 'overview' && (
          <>
            {/* Job header */}
            <div style={{ display:'flex', gap:14, marginBottom:18 }}>
              <CompanyLogo logo={job.companyLogo} company={job.company} size={52}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, color:'#94a3b8', marginBottom:4 }}>
                  <span style={{ fontWeight:600, color:'#374151' }}>{job.company}</span> · {fmtAge(job.postedHoursAgo)}
                  <span style={{ marginLeft:8, padding:'2px 8px', borderRadius:99, background:ss.bg, color:ss.color, fontSize:11, fontWeight:600 }}>{job.source}</span>
                </div>
                <h2 style={{ fontSize:21, fontWeight:800, margin:'0 0 8px', lineHeight:1.2, color:'#111' }}>{job.title}</h2>
                <div style={{ display:'flex', flexWrap:'wrap', gap:14, fontSize:13, color:'#6b7280' }}>
                  <span>📍 {job.location}</span>
                  <span>🕐 {job.jobType}</span>
                  {job.salary && <span style={{ color:'#065f46', fontWeight:700 }}>💰 {job.salary}</span>}
                  <span>🏠 {job.locationType}</span>
                </div>
              </div>
            </div>

            {/* Match score — Jobright style */}
            {job.matchScore > 0 && !job.noProfile && (
              <div style={{ display:'flex', gap:0, marginBottom:18, border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
                {/* Overall */}
                <div style={{ padding:'16px 20px', background:'#f8fafc', borderRight:'1px solid #e5e7eb', textAlign:'center', minWidth:100 }}>
                  <div style={{ position:'relative', width:70, height:70, margin:'0 auto 6px' }}>
                    <svg width="70" height="70" viewBox="0 0 70 70">
                      <circle cx="35" cy="35" r="30" fill="none" stroke="#e5e7eb" strokeWidth="6"/>
                      <circle cx="35" cy="35" r="30" fill="none" stroke={SC(job.matchScore)} strokeWidth="6"
                        strokeDasharray={`${2*Math.PI*30*job.matchScore/100} ${2*Math.PI*30}`}
                        strokeLinecap="round" transform="rotate(-90 35 35)"/>
                    </svg>
                    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ fontSize:15, fontWeight:800, color:SC(job.matchScore), lineHeight:1 }}>{job.matchScore}%</div>
                    </div>
                  </div>
                  <div style={{ fontSize:11.5, fontWeight:700, color:SC(job.matchScore), textTransform:'uppercase', letterSpacing:.5 }}>{job.matchLabel || 'Match'}</div>
                </div>
                {/* Sub-scores */}
                <div style={{ display:'flex', flex:1 }}>
                  {[['Exp. Level',job.expScore],['Skill',job.skillScore],['Industry Exp.',job.industryScore]].map(([l,v],i) => (
                    <div key={l} style={{ flex:1, padding:'16px 12px', textAlign:'center', borderRight:i<2?'1px solid #f1f5f9':'none' }}>
                      <div style={{ position:'relative', width:54, height:54, margin:'0 auto 6px' }}>
                        <svg width="54" height="54" viewBox="0 0 54 54">
                          <circle cx="27" cy="27" r="22" fill="none" stroke="#e5e7eb" strokeWidth="4"/>
                          <circle cx="27" cy="27" r="22" fill="none" stroke={SC(v||0)} strokeWidth="4"
                            strokeDasharray={`${2*Math.PI*22*(v||0)/100} ${2*Math.PI*22}`}
                            strokeLinecap="round" transform="rotate(-90 27 27)"/>
                        </svg>
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:SC(v||0) }}>{v||0}%</div>
                      </div>
                      <div style={{ fontSize:11.5, color:'#6b7280' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* H1B + flags */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {job.h1bSponsor && (
                <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, background:'#f0fdf4', color:'#065f46', padding:'6px 12px', borderRadius:20, fontWeight:600, border:'1px solid #bbf7d0' }}>
                  ✅ H1B Sponsor Likely
                </span>
              )}
              {job.earlyApplicant && (
                <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, background:'#eff6ff', color:'#1e40af', padding:'6px 12px', borderRadius:20, fontWeight:600, border:'1px solid #bfdbfe' }}>
                  ⚡ New Posting
                </span>
              )}
            </div>

            {/* Qualification — skills matching */}
            {allJobSkills.length > 0 && (
              <div style={{ marginBottom:20, padding:'16px', background:'#f8fafc', borderRadius:12, border:'1px solid #e5e7eb' }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:4, color:'#111' }}>Qualification</div>
                <div style={{ fontSize:12.5, color:'#6b7280', marginBottom:12 }}>
                  Skills matching this job's requirements.
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {allJobSkills.map((skill, i) => {
                    const has  = matchingSkills.some(s => s.toLowerCase() === skill.toLowerCase());
                    const miss = missingSkills.some(s => s.toLowerCase() === skill.toLowerCase());
                    return (
                      <span key={i} style={{
                        fontSize:13, padding:'5px 12px', borderRadius:8,
                        background: has ? '#dcfce7' : miss ? '#fff' : '#f1f5f9',
                        color: has ? '#065f46' : miss ? '#374151' : '#475569',
                        border: `1.5px solid ${has ? '#86efac' : miss ? '#e5e7eb' : '#e5e7eb'}`,
                        fontWeight: has ? 600 : 400,
                        display:'flex', alignItems:'center', gap:4,
                      }}>
                        {has && <span style={{ fontSize:12 }}>👍</span>}
                        {skill}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* About / Description */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:10, color:'#111', display:'flex', alignItems:'center', gap:8 }}>
                <span>📋</span> Responsibilities & Requirements
              </div>
              {/<[a-z][\s\S]*>/i.test(job.description||'') ? (
                <div style={{ fontSize:13.5, lineHeight:1.8, color:'#374151' }}
                  dangerouslySetInnerHTML={{ __html: (job.description||'').slice(0, 8000) }}/>
              ) : (
                <div style={{ fontSize:13.5, lineHeight:1.8, color:'#374151', whiteSpace:'pre-line' }}>
                  {(job.description||'').slice(0, 5000)}
                </div>
              )}
            </div>

            {/* Bottom apply */}
            <div style={{ display:'flex', gap:10, marginTop:24, paddingTop:16, borderTop:'1px solid #f1f5f9' }}>
              {directUrl && (
                <a href={directUrl} target="_blank" rel="noreferrer"
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'13px', background:'#fff', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}>
                  📄 Original Job Post ↗
                </a>
              )}
              {careerUrl && careerUrl !== directUrl && (
                <a href={careerUrl} target="_blank" rel="noreferrer"
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'13px', background:'#f8fafc', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:10, fontWeight:600, fontSize:14, textDecoration:'none' }}>
                  🏢 {job.company} Careers
                </a>
              )}
              <button onClick={onApply}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'13px', background:'#00c46a', color:'white', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                ✨ Apply with AI ↗
              </button>
            </div>
          </>
        )}

        {detailTab === 'company' && (
          <div>
            <div style={{ display:'flex', gap:14, marginBottom:20, padding:'16px', background:'#f8fafc', borderRadius:12 }}>
              <CompanyLogo logo={job.companyLogo} company={job.company} size={56}/>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'#111', marginBottom:4 }}>{job.company}</div>
                <div style={{ fontSize:13, color:'#6b7280' }}>
                  {job.category} · {job.locationType}
                </div>
                {directUrl && (
                  <a href={directUrl} target="_blank" rel="noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:8, fontSize:12.5, color:'#1e40af', textDecoration:'none', fontWeight:600 }}>
                    🌐 View Job Posting ↗
                  </a>
                )}
              </div>
            </div>

            {/* H1B info */}
            {job.h1bSponsor && (
              <div style={{ padding:16, background:'#f0fdf4', borderRadius:12, marginBottom:16, border:'1px solid #bbf7d0' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#065f46', marginBottom:6 }}>H1B Sponsorship</div>
                <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>
                  {job.company} has a track record of sponsoring H1B visas for similar roles. The "H1B Sponsor Likely" label is based on company history.
                </div>
              </div>
            )}

            {/* Job details */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              {[
                ['📍 Location', job.location],
                ['🕐 Job Type', job.jobType],
                ['🏠 Work Model', job.locationType],
                ['📂 Category', job.category],
                ['⏰ Posted', fmtAge(job.postedHoursAgo)],
                ['👥 Applicants', job.applicants > 0 ? `${job.applicants} applicants` : 'Not disclosed'],
              ].filter(([,v])=>v).map(([label, val]) => (
                <div key={label} style={{ padding:'12px 14px', background:'#f8fafc', borderRadius:8 }}>
                  <div style={{ fontSize:11.5, color:'#6b7280', marginBottom:4 }}>{label.split(' ').slice(1).join(' ')}</div>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#111' }}>{val}</div>
                </div>
              ))}
            </div>

            {job.salary && (
              <div style={{ padding:'14px 16px', background:'#f0fdf4', borderRadius:10, border:'1px solid #bbf7d0', marginBottom:16 }}>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:2 }}>Compensation</div>
                <div style={{ fontSize:18, fontWeight:800, color:'#065f46' }}>{job.salary}</div>
              </div>
            )}

            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              {directUrl && (
                <a href={directUrl} target="_blank" rel="noreferrer"
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'13px', background:'#fff', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}>
                  📄 Original Job Post ↗
                </a>
              )}
              <button onClick={onApply}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'13px', background:'#00c46a', color:'white', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Apply with AI ↗
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Jobs Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs]               = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [page, setPage]               = useState(1);
  const [meta, setMeta]               = useState({});
  const [tab, setTab]                 = useState('recommended');
  const [savedIds, setSavedIds]       = useState(new Set());
  const [appliedList, setAppliedList] = useState([]);
  const [resumes, setResumes]         = useState([]);

  const [search, setSearch]           = useState('');
  const [filters, setFilters]         = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const searchTimer                   = useRef(null);
  const [liveSearching, setLiveSearching] = useState(false);
  const [liveResults, setLiveResults]     = useState(null);

  const [applyModal, setApplyModal]   = useState(null);
  const [selectedApplyResume, setSelectedApplyResume] = useState(null);
  const [applyStep, setApplyStep]     = useState(1);
  const [skillPicks, setSkillPicks]   = useState([]);
  const [fixing, setFixing]           = useState(false);
  const [fixResult, setFixResult]     = useState(null);
  const [pendingConfirmJob, setPendingConfirmJob] = useState(null);
  const [didApplyModal, setDidApplyModal]         = useState(null);

  const activeFilterCount = Object.values(filters).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length;

  const loadJobs = useCallback(async (p = 1, append = false) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    setLiveResults(null);
    try {
      const params = { page: p, limit: 50 };
      if (search) params.search = search;
      const [j, saved, applied, r] = await Promise.all([
        jobsAPI.recommended(params), jobsAPI.saved(), jobsAPI.applied(),
        p === 1 ? resumeAPI.list() : Promise.resolve({ data: resumes }),
      ]);
      const incoming = j.data.jobs || [];
      const pag = j.data.pagination || {};
      setJobs(prev => append ? [...prev, ...incoming] : incoming);
      setHasMore(pag.hasMore || false);
      setPage(p);
      setMeta(j.data.meta || {});
      setSavedIds(new Set((saved.data||[]).map(s => s.jobId||s)));
      setAppliedList(applied.data||[]);
      if (p === 1) setResumes(r.data||[]);
      if (!selectedJob && incoming.length > 0 && p === 1) setSelectedJob(incoming[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [search]);

  const doLiveSearch = useCallback(async q => {
    if (!q || q.length < 2) { setLiveResults(null); return; }
    setLiveSearching(true);
    try {
      const r = await jobsAPI.liveSearch(q, null);
      if ((r.data.jobs||[]).length > 0) {
        setLiveResults({ jobs: r.data.jobs, query: q, total: r.data.total });
        if (r.data.jobs[0]) setSelectedJob(r.data.jobs[0]);
      }
    } catch { setLiveResults(null); }
    finally { setLiveSearching(false); }
  }, []);

  useEffect(() => {
    loadJobs(1);
    const lastUpdate = localStorage.getItem('ca_profile_updated');
    const lastLoad   = localStorage.getItem('ca_jobs_last_load');
    if (lastUpdate && (!lastLoad || parseInt(lastUpdate) > parseInt(lastLoad))) setTimeout(() => loadJobs(1), 800);
    localStorage.setItem('ca_jobs_last_load', Date.now().toString());
  }, []);

  const onSearchChange = v => {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (v.length >= 2) {
        loadJobs(1);
        setTimeout(() => {
          const local = jobs.filter(j => (j.company||'').toLowerCase().includes(v.toLowerCase()) || (j.title||'').toLowerCase().includes(v.toLowerCase()));
          if (local.length < 3) doLiveSearch(v);
        }, 500);
      } else if (!v) loadJobs(1);
    }, 400);
  };

  useEffect(() => {
    const h = () => { if (pendingConfirmJob) { setDidApplyModal(pendingConfirmJob); setPendingConfirmJob(null); } };
    window.addEventListener('focus', h);
    return () => window.removeEventListener('focus', h);
  }, [pendingConfirmJob]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await jobsAPI.refresh(); await loadJobs(1); } catch { await loadJobs(1); }
    finally { setRefreshing(false); }
  };

  const toggleSave = async (job, e) => {
    e?.stopPropagation();
    const id = job.id||job.jobId;
    if (savedIds.has(id)) {
      await jobsAPI.unsaveJob(id).catch(()=>{});
      setSavedIds(prev => { const s=new Set(prev); s.delete(id); return s; });
    } else {
      await jobsAPI.saveJob(id, { title:job.title, company:job.company }).catch(()=>{});
      setSavedIds(prev => new Set([...prev,id]));
    }
  };

  const handleDismiss = async (job, e) => {
    e?.stopPropagation();
    const id = job.id||job.jobId;
    await jobsAPI.dismiss(id).catch(()=>{});
    setJobs(prev => {
      const updated = prev.filter(j => (j.id||j.jobId) !== id);
      if (selectedJob && (selectedJob.id||selectedJob.jobId) === id) {
        const idx = prev.findIndex(j => (j.id||j.jobId) === id);
        setSelectedJob(updated[idx] || updated[idx-1] || updated[0] || null);
      }
      if (updated.length < 8 && hasMore) setTimeout(() => loadJobs(page+1, true), 100);
      return updated;
    });
  };

  const openApply = job => {
    setApplyModal(job);
    setApplyStep(1);
    setSkillPicks([]);
    setFixResult(null);
    setTailoredResume(null);
    setTailoredProfile(null);
    setSelectedApplyResume(resumes.find(r => r.isPrimary) || resumes[0] || null);
  };

  const [tailoredResume, setTailoredResume] = useState(null);   // temp resume with added keywords
  const [tailoredProfile, setTailoredProfile] = useState(null); // profile for download

  const handleOptimize = async () => {
    if (!applyModal) return;
    setFixing(true);
    try {
      const primary = selectedApplyResume || resumes.find(r=>r.isPrimary) || resumes[0];
      if (primary) {
        const r = await resumeAPI.tailorTemp(primary._id, {
          jdText:`${applyModal.title} at ${applyModal.company}. Required: ${(applyModal.tags||[]).join(', ')}`,
          selectedSkills: skillPicks,
          targetCareer: applyModal.title,
        });
        const addedCount = (r.data?.addedKeywords||[]).length;
        const before = primary.atsScore || 65;
        // Each added keyword adds ~3–5 points to ATS score
        const after  = Math.min(98, before + addedCount * 4);
        setFixResult({
          atsBefore: before,
          atsAfter:  addedCount > 0 ? after : before,
          changes:   r.data?.changesMade || [],
          addedKeywords: r.data?.addedKeywords || [],
        });
        // Store for download — this is the modified resume data
        if (r.data?.tempResume)  setTailoredResume(r.data.tempResume);
        if (r.data?.profile)     setTailoredProfile(r.data.profile);
      }
      setApplyStep(3);
    } catch { setApplyStep(3); }
    finally { setFixing(false); }
  };

  // Download the updated resume as a print-ready HTML page
  const downloadTailoredResume = () => {
    const res = tailoredResume;
    const prof = tailoredProfile;
    if (!res && !prof) { alert('No updated resume available. Please go through the optimize step first.'); return; }

    const skills  = res?.skills  || prof?.skills  || [];
    const exp     = res?.experience || prof?.experience || [];
    const edu     = res?.education  || prof?.education  || [];
    const pubs    = res?.publications || prof?.publications || [];
    const certs   = res?.certifications || prof?.certifications || [];
    const projs   = res?.projects || prof?.projects || [];
    const name    = prof?.name || '';
    const phone   = prof?.phone || '';
    const loc     = prof?.location || '';
    const email   = prof?.email || '';
    const gh      = prof?.github || '';
    const li      = prof?.linkedIn || '';
    const summary = res?.summary || prof?.summary || '';
    const added   = fixResult?.addedKeywords || [];

    const expHtml = exp.map(e => `
      <div style="display:flex;justify-content:space-between;margin-bottom:2pt">
        <b>${e.company || ''}${e.location ? ', ' + e.location : ''}</b>
        <span style="font-style:italic;color:#555;font-size:8.5pt">${e.startDate||''}${e.endDate||e.current?` – ${e.current?'Present':e.endDate||''}`:''}</span>
      </div>
      <div style="font-style:italic;margin-bottom:3pt">${e.title || ''}</div>
      <ul style="margin:0 0 5pt;padding-left:14pt">${(e.bullets||[]).filter(Boolean).map(b => `<li>${b}</li>`).join('')}</ul>
    `).join('');

    const eduHtml = edu.map(e => `
      <div style="display:flex;justify-content:space-between;margin-bottom:2pt">
        <b>${e.institution || ''}</b>
        <span style="font-style:italic;color:#555;font-size:8.5pt">${e.startDate||''}${e.endDate?` – ${e.endDate}`:''}</span>
      </div>
      <div style="margin-bottom:4pt">${e.degree || ''}${e.gpa ? ' · GPA: '+e.gpa : ''}</div>
    `).join('');

    const pubHtml = pubs.map(p => `<div style="margin-bottom:3pt">• ${typeof p==='object'?(p.title||p):p}</div>`).join('');
    const certHtml = certs.map(c => typeof c==='object'?c.name||c:c).join(' | ');
    const projHtml = projs.map(p => `<div style="margin-bottom:4pt"><b>${p.name||''}</b>${(p.bullets||[]).length?' — '+(p.bullets[0]||''):''}</div>`).join('');

    const win = window.open('', '_blank');
    if (!win) { alert('Allow popups from localhost:3000 to download your resume.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Resume – ${name}</title><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4;margin:14mm 18mm}
body{font-family:'Times New Roman',serif;font-size:9.5pt;line-height:1.45;color:#000;background:white}
h1{font-size:17pt;font-weight:bold;text-align:center;margin-bottom:3pt}
.contact{font-size:8.5pt;text-align:center;color:#444;margin-bottom:8pt}
.sec{font-size:10.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:1.5px solid #222;margin:8pt 0 4pt;padding-bottom:1pt}
ul{padding-left:14pt;margin:2pt 0}
li{margin-bottom:1.5pt}
a{color:#333;text-decoration:none}
.added-note{font-size:7.5pt;color:#065f46;background:#d1fae5;padding:2pt 6pt;border-radius:3pt;margin-bottom:6pt;display:inline-block}
</style></head><body>
<h1>${name}</h1>
<div class="contact">${[loc,phone,email,li&&`<a href="${li}">LinkedIn</a>`,gh&&`<a href="${gh}">GitHub</a>`].filter(Boolean).join(' | ')}</div>
${added.length>0?`<div class="added-note">✅ ${added.length} keyword${added.length!==1?'s':''} added for this application: ${added.join(', ')}</div>`:''}
${summary ? `<div class="sec">Summary</div><p>${summary}</p>` : ''}
${edu.length>0?`<div class="sec">Education & Certifications</div>${eduHtml}${certHtml?`<div style="margin-top:3pt;font-size:8.5pt">${certHtml}</div>`:''}` : ''}
${skills.length>0?`<div class="sec">Technical Skills</div><p><b>Skills:</b> ${skills.join(', ')}</p>` : ''}
${pubs.length>0?`<div class="sec">Publications</div>${pubHtml}` : ''}
${exp.length>0?`<div class="sec">Professional Experience</div>${expHtml}` : ''}
${projs.length>0?`<div class="sec">Open-Source Projects</div>${projHtml}` : ''}
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 700);
  };

  const openUrl = (url, job) => {
    if (!url) return;
    jobsAPI.applyJob(job.id||job.jobId, { applyUrl:url, title:job.title, company:job.company }).catch(()=>{});
    setPendingConfirmJob(job);
    setApplyModal(null);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) alert('Open: '+url);
  };

  const confirmApply = async yes => {
    if (!didApplyModal) return;
    await jobsAPI.confirmApply(didApplyModal.id||didApplyModal.jobId, yes).catch(()=>{});
    if (yes) {
      setAppliedList(prev => [...prev, { jobId:didApplyModal.id, title:didApplyModal.title, company:didApplyModal.company, appliedAt:new Date() }]);
      setJobs(prev => prev.filter(j => (j.id||j.jobId) !== (didApplyModal.id||didApplyModal.jobId)));
    }
    setDidApplyModal(null);
  };

  const rawList = liveResults ? liveResults.jobs
    : tab==='saved'   ? jobs.filter(j => savedIds.has(j.id||j.jobId))
    : tab==='applied' ? appliedList.map(a => ({ ...jobs.find(j=>(j.id||j.jobId)===a.jobId)||{}, ...a, id:a.jobId }))
    : jobs;
  const displayJobs = applyLocalFilters(rawList, filters);

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 56px)', overflow:'hidden', background:'#f8fafc' }}>

      {/* Top bar */}
      <div style={{ padding:'10px 0 0', flexShrink:0, background:'#f8fafc' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap', paddingBottom:8 }}>
          <div>
            <h1 style={{ fontSize:19, fontWeight:800, margin:0, color:'#111' }}>💼 Jobs</h1>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
              {liveResults ? `🔴 Live: ${liveResults.total} results for "${liveResults.query}"`
                : `${displayJobs.length} jobs · Live from Greenhouse & Lever · < 14 days old`}
              {!liveResults && meta.aboveThreshold > 0 && ` · ${meta.aboveThreshold} strong matches`}
            </div>
          </div>
          <div style={{ display:'flex', gap:7, alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <input value={search} onChange={e => onSearchChange(e.target.value)}
                placeholder="Search by title or company…"
                style={{ width:240, fontSize:13, padding:'8px 36px 8px 12px', border:'1px solid #e5e7eb', borderRadius:9, background:'white', outline:'none' }}/>
              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:16 }}>🔍</span>
              {liveSearching && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:12 }}>⏳</span>}
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              style={{ position:'relative', display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'white', border:'1.5px solid #e5e7eb', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151' }}>
              ⚙️ All Filters
              {activeFilterCount > 0 && <span style={{ background:'#00c46a', color:'white', borderRadius:99, fontSize:10, fontWeight:700, padding:'1px 6px' }}>{activeFilterCount}</span>}
            </button>
            <button onClick={handleRefresh} disabled={refreshing}
              style={{ padding:'8px 12px', background:'white', border:'1px solid #e5e7eb', borderRadius:9, fontSize:13, cursor:'pointer', color:'#374151' }}>
              {refreshing?'⏳':'🔄'}
            </button>
            <button onClick={async()=>{ await jobsAPI.clearDismissed().catch(()=>{}); loadJobs(1); }}
              style={{ padding:'8px 12px', background:'white', border:'1px solid #e5e7eb', borderRadius:9, fontSize:13, cursor:'pointer', color:'#6b7280' }}>↺</button>
          </div>
        </div>

        {/* Filter pills row */}
        {activeFilterCount > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingBottom:8 }}>
            <span style={{ fontSize:12, padding:'4px 10px', background:'#dbeafe', color:'#1e40af', borderRadius:20, fontWeight:600 }}>🇺🇸 United States</span>
            {filters.jobFunction && <span style={{ fontSize:12, padding:'4px 10px', background:'#f3f4f6', color:'#374151', borderRadius:20, display:'flex', alignItems:'center', gap:4 }}>{filters.jobFunction} <button onClick={() => setFilters(p=>({...p,jobFunction:''}))} style={{ background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:14,lineHeight:1 }}>×</button></span>}
            {(filters.workModels||[]).map(m => <span key={m} style={{ fontSize:12, padding:'4px 10px', background:'#f3f4f6', color:'#374151', borderRadius:20, display:'flex', alignItems:'center', gap:4 }}>{m} <button onClick={() => setFilters(p=>({...p,workModels:(p.workModels||[]).filter(x=>x!==m)}))} style={{ background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:14,lineHeight:1 }}>×</button></span>)}
            {filters.maxHours && <span style={{ fontSize:12, padding:'4px 10px', background:'#f3f4f6', color:'#374151', borderRadius:20, display:'flex', alignItems:'center', gap:4 }}>{DATE_OPTIONS.find(d=>d.hours===filters.maxHours)?.label} <button onClick={() => setFilters(p=>({...p,maxHours:null}))} style={{ background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:14,lineHeight:1 }}>×</button></span>}
            {filters.h1bOnly && <span style={{ fontSize:12, padding:'4px 10px', background:'#d1fae5', color:'#065f46', borderRadius:20, display:'flex', alignItems:'center', gap:4 }}>H1B <button onClick={() => setFilters(p=>({...p,h1bOnly:false}))} style={{ background:'none',border:'none',cursor:'pointer',color:'#065f46',fontSize:14,lineHeight:1 }}>×</button></span>}
            <button onClick={() => setFilters({})} style={{ fontSize:12, padding:'4px 10px', background:'none', border:'1px solid #e5e7eb', borderRadius:20, cursor:'pointer', color:'#6b7280' }}>Clear all ×</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb', background:'#f8fafc' }}>
          {[['recommended','Recommended'],['saved',`Saved${savedIds.size>0?` (${savedIds.size})`:''}`],['applied',`Applied${appliedList.length>0?` (${appliedList.length})`:''}`]].map(([k,l]) => (
            <button key={k} onClick={() => { setTab(k); setLiveResults(null); }}
              style={{ padding:'10px 16px', background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:tab===k?700:500, color:tab===k?'#111':'#6b7280', borderBottom:tab===k?'2px solid #00c46a':'2px solid transparent', marginBottom:-1 }}>
              {l}
            </button>
          ))}
          {!meta.hasProfile && (
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', padding:'0 12px', fontSize:12, color:'#f59e0b' }}>
              ⚠️ <button onClick={() => navigate('/profile')} style={{ background:'none',border:'none',color:'#f59e0b',cursor:'pointer',fontWeight:600,fontSize:12,marginLeft:4 }}>Add skills →</button>
            </div>
          )}
        </div>
      </div>

      {/* Main split - each side scrolls independently */}
      <div style={{ display:'grid', gridTemplateColumns:'clamp(320px,34%,440px) 1fr', flex:1, minHeight:0, overflow:'hidden' }}>

        {/* Left: job list — own scroll */}
        <div style={{ overflowY:'auto', borderRight:'1px solid #e5e7eb', background:'white', height:'100%' }}>
          {liveSearching && (
            <div style={{ padding:24, textAlign:'center', color:'#6b7280' }}>
              <div style={{ fontSize:28 }}>🔴</div>
              <div style={{ fontWeight:600, fontSize:13, marginTop:8 }}>Searching career portals...</div>
            </div>
          )}
          {displayJobs.length === 0 && !liveSearching && (
            <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>
              <div style={{ fontSize:40 }}>🔍</div>
              <div style={{ fontWeight:600, fontSize:14, marginTop:10 }}>No jobs found</div>
              <div style={{ fontSize:13, marginTop:6 }}>{tab==='saved'?'Star jobs to save':tab==='applied'?'No applications yet':'Try a different search or clear filters'}</div>
              {tab==='recommended' && <button onClick={handleRefresh} style={{ marginTop:12, padding:'8px 20px', background:'#00c46a', color:'white', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer' }}>🔄 Load Jobs</button>}
            </div>
          )}

          {displayJobs.map(job => {
            const id = job.id||job.jobId;
            const isSel = (selectedJob?.id||selectedJob?.jobId) === id;
            const isSaved = savedIds.has(id);
            const isApplied = appliedList.some(a => a.jobId===id);

            return (
              <div key={id} onClick={() => setSelectedJob(job)}
                style={{ padding:'14px 16px', borderBottom:'1px solid #f1f5f9', cursor:'pointer',
                  background: isSel ? '#f0fdf4' : 'white',
                  borderLeft: isSel ? '3px solid #00c46a' : '3px solid transparent',
                  transition:'background 0.1s' }}>
                <div style={{ display:'flex', gap:12 }}>
                  <CompanyLogo logo={job.companyLogo} company={job.company} size={44}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <div>
                        <div style={{ fontSize:11.5, color:'#6b7280', marginBottom:2 }}>
                          <span style={{ fontWeight:600, color:'#374151' }}>{job.company}</span>
                          {job.category && <span style={{ color:'#9ca3af' }}> · {job.category.split('/')[0]}</span>}
                        </div>
                        <div style={{ fontSize:14, fontWeight:700, lineHeight:1.3, color:'#111' }}>{job.title}</div>
                      </div>
                      {/* Match circle */}
                      {job.matchScore > 0 && !job.noProfile && (
                        <div style={{ flexShrink:0, textAlign:'center' }}>
                          <div style={{ position:'relative', width:48, height:48 }}>
                            <svg width="48" height="48" viewBox="0 0 48 48">
                              <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4"/>
                              <circle cx="24" cy="24" r="20" fill="none" stroke={SC(job.matchScore)} strokeWidth="4"
                                strokeDasharray={`${2*Math.PI*20*job.matchScore/100} ${2*Math.PI*20}`}
                                strokeLinecap="round" transform="rotate(-90 24 24)"/>
                            </svg>
                            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                              <span style={{ fontSize:11, fontWeight:800, color:SC(job.matchScore), lineHeight:1 }}>{job.matchScore}%</span>
                            </div>
                          </div>
                          <div style={{ fontSize:10, fontWeight:600, color:SC(job.matchScore), marginTop:2 }}>{job.matchLabel?.split(' ')[0]}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ display:'flex', gap:10, marginTop:6, fontSize:12.5, color:'#6b7280', flexWrap:'wrap' }}>
                      {job.location && <span>📍 {job.location.split(',')[0]}</span>}
                      {job.locationType && <span>🏠 {job.locationType}</span>}
                      {job.salary && <span style={{ color:'#065f46', fontWeight:600 }}>{job.salary}</span>}
                    </div>

                    <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap', alignItems:'center' }}>
                      {job.earlyApplicant && <span style={{ fontSize:11, background:'#d1fae5', color:'#065f46', padding:'2px 8px', borderRadius:99, fontWeight:600 }}>Early applicant</span>}
                      {job.h1bSponsor && <span style={{ fontSize:11, background:'#dbeafe', color:'#1e40af', padding:'2px 8px', borderRadius:99, fontWeight:600 }}>✅ H1B Likely</span>}
                      {job.applicants > 0 && <span style={{ fontSize:11, color:'#9ca3af' }}>{job.applicants} applicants</span>}
                    </div>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                      <span style={{ fontSize:11.5, color:'#9ca3af' }}>{fmtAge(job.postedHoursAgo)}</span>
                      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                        {isApplied && <span style={{ fontSize:11, background:'#d1fae5', color:'#065f46', padding:'2px 7px', borderRadius:99 }}>✓ Applied</span>}
                        <button onClick={e=>toggleSave(job,e)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:16,color:isSaved?'#f59e0b':'#d1d5db',padding:'0 2px' }}>{isSaved?'★':'☆'}</button>
                        <button onClick={e=>handleDismiss(job,e)} style={{ background:'none',border:'none',cursor:'pointer',color:'#d1d5db',fontSize:14,padding:'0 2px' }} title="Not interested">✕</button>
                        <button onClick={e=>{e.stopPropagation();openApply(job);}}
                          style={{ fontSize:11.5, padding:'4px 10px', background:'#00c46a', color:'white', border:'none', borderRadius:7, fontWeight:700, cursor:'pointer' }}>
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && !liveResults && tab==='recommended' && (
            <div style={{ padding:14, textAlign:'center', borderTop:'1px solid #f1f5f9' }}>
              <button onClick={() => loadJobs(page+1,true)} disabled={loadingMore}
                style={{ width:'100%', padding:'10px', background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151' }}>
                {loadingMore?'⏳ Loading…':'⬇ Load More Jobs'}
              </button>
            </div>
          )}
        </div>

        {/* Right: detail — own independent scroll */}
        <div style={{ overflowY:'auto', background:'#fff', height:'100%' }}>
          <JobDetail
            job={selectedJob}
            isSaved={savedIds.has(selectedJob?.id||selectedJob?.jobId)}
            isApplied={appliedList.some(a => a.jobId===(selectedJob?.id||selectedJob?.jobId))}
            onSave={e => toggleSave(selectedJob, e)}
            onApply={() => openApply(selectedJob)}
            onDismiss={() => handleDismiss(selectedJob, null)}
          />
        </div>
      </div>

      {/* Filter drawer */}
      {showFilters && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:999 }} onClick={() => setShowFilters(false)}/>
          <FilterDrawer filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)}/>
        </>
      )}

      {/* Apply modal */}
      {applyModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:560, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div><div style={{ fontWeight:800, fontSize:16 }}>Apply: {applyModal.title}</div><div style={{ fontSize:12, color:'#6b7280' }}>{applyModal.company}</div></div>
              <button onClick={() => setApplyModal(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9ca3af' }}>✕</button>
            </div>
            <div style={{ display:'flex', padding:'10px 20px', gap:5, alignItems:'center', borderBottom:'1px solid #f1f5f9' }}>
              {['Match','Optimize','Apply'].map((label,i) => (
                <React.Fragment key={i}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background:applyStep>i+1?'#00c46a':applyStep===i+1?'#111':'#e5e7eb', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:10 }}>{applyStep>i+1?'✓':i+1}</div>
                    <span style={{ fontSize:12, fontWeight:applyStep===i+1?700:400, color:applyStep===i+1?'#111':'#9ca3af' }}>{label}</span>
                  </div>
                  {i<2 && <div style={{ flex:1, height:1, background:applyStep>i+1?'#00c46a':'#e5e7eb' }}/>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ padding:20 }}>
              {applyStep===1 && (
                <div>
                  <h3 style={{ fontWeight:800, marginBottom:12, fontSize:15 }}>Choose Your Resume</h3>

                  {/* Resume selection with ATS score per resume */}
                  {resumes.length > 1 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:12.5, color:'#6b7280', marginBottom:8 }}>Select which resume to apply with:</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                        {resumes.map(res => {
                          const isSelected = (selectedApplyResume?._id || '') === res._id;
                          const ats = res.atsScore || 0;
                          return (
                            <div key={res._id} onClick={() => setSelectedApplyResume(res)}
                              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', border:`2px solid ${isSelected?'#00c46a':'#e5e7eb'}`, borderRadius:9, cursor:'pointer', background:isSelected?'#f0fdf4':'white', transition:'all 0.1s' }}>
                              <div>
                                <div style={{ fontWeight:600, fontSize:13, color:'#111' }}>
                                  {res.name}
                                  {res.isPrimary && <span style={{ marginLeft:6, fontSize:10, background:'#d1fae5', color:'#065f46', padding:'1px 6px', borderRadius:99 }}>Primary</span>}
                                </div>
                                <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2 }}>
                                  {res.targetCareer || 'General Resume'} · Modified {new Date(res.lastModified||res.uploadDate).toLocaleDateString()}
                                </div>
                              </div>
                              <div style={{ textAlign:'center', flexShrink:0 }}>
                                {ats > 0 && (
                                  <>
                                    <div style={{ fontSize:18, fontWeight:800, color:SC(ats) }}>{ats}</div>
                                    <div style={{ fontSize:10, color:'#9ca3af' }}>ATS Score</div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
                    {[['Overall',applyModal.matchScore||0],['Skill',applyModal.skillScore||0],['Role',applyModal.industryScore||0],['Exp',applyModal.expScore||0]].map(([l,v]) => (
                      <div key={l} style={{ padding:10, background:'#f8fafc', borderRadius:8, textAlign:'center' }}>
                        <div style={{ fontSize:20, fontWeight:800, color:SC(v) }}>{v}%</div>
                        <div style={{ fontSize:10.5, color:'#9ca3af' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setApplyStep(2)} style={{ width:'100%', padding:'12px', background:'#00c46a', color:'white', border:'none', borderRadius:9, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    {applyModal.missingSkills?.length>0?'✨ Customize Resume →':'Continue to Apply →'}
                  </button>
                </div>
              )}
              {applyStep===2 && (
                <div>
                  <h3 style={{ fontWeight:800, marginBottom:4, fontSize:15 }}>Customize Your Resume</h3>
                  <p style={{ fontSize:13, color:'#6b7280', marginBottom:14 }}>Add missing keywords to boost your match score.</p>
                  {applyModal.missingSkills?.length>0 ? (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:14 }}>
                      {applyModal.missingSkills.map((s,i) => { const on=skillPicks.includes(s); return (
                        <span key={i} onClick={()=>setSkillPicks(p=>on?p.filter(x=>x!==s):[...p,s])}
                          style={{ fontSize:13, padding:'6px 13px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${on?'#00c46a':'#e5e7eb'}`, background:on?'#f0fdf4':'#fff', color:on?'#065f46':'#374151', fontWeight:on?600:400 }}>
                          {on&&'✓ '}{s}
                        </span>
                      ); })}
                    </div>
                  ) : <div style={{ padding:12, background:'#f0fdf4', borderRadius:8, marginBottom:14, color:'#065f46', fontWeight:600 }}>✅ Your resume is already well-matched.</div>}
                  <div style={{ display:'flex', gap:8, flexDirection:'column' }}>
                    <button onClick={handleOptimize} disabled={fixing} style={{ padding:'12px', background:'#00c46a', color:'white', border:'none', borderRadius:9, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                      {fixing?'⏳ Updating...':skillPicks.length>0?'✨ Update Resume & Apply →':'Continue without changes →'}
                    </button>
                    <button onClick={() => setApplyStep(3)} style={{ padding:'12px', background:'#f8fafc', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:9, fontWeight:600, fontSize:13.5, cursor:'pointer' }}>
                      📄 Apply with Original Resume
                    </button>
                    <button onClick={() => setApplyStep(1)} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:13 }}>← Back</button>
                  </div>
                </div>
              )}
              {applyStep===3 && (
                <div>
                  <div style={{ textAlign:'center', marginBottom:16 }}>
                    <div style={{ fontSize:44 }}>🚀</div>
                    <h3 style={{ fontWeight:800, fontSize:18, marginTop:8 }}>Ready to Apply!</h3>
                  </div>

                  {/* What was changed — keywords added only */}
                  {fixResult && (
                    <div style={{ marginBottom:14 }}>
                      {fixResult.addedKeywords?.length > 0 ? (
                        <div style={{ padding:'12px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:9, marginBottom:10 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#065f46', marginBottom:6 }}>
                            ✅ {fixResult.addedKeywords.length} keyword{fixResult.addedKeywords.length!==1?'s':''} added to your skills section:
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                            {fixResult.addedKeywords.map((kw,i) => (
                              <span key={i} style={{ fontSize:12, background:'#d1fae5', color:'#065f46', padding:'3px 9px', borderRadius:99, fontWeight:600 }}>+{kw}</span>
                            ))}
                          </div>
                          <div style={{ fontSize:11.5, color:'#6b7280', marginTop:8, lineHeight:1.5 }}>
                            ℹ️ Your original resume content is unchanged. Only these keywords were appended to your skills list.
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding:'10px 14px', background:'#fafafa', border:'1px solid #e5e7eb', borderRadius:9, marginBottom:10, fontSize:13, color:'#6b7280' }}>
                          ✅ No changes needed — your resume already covers these skills.
                        </div>
                      )}

                      {/* ATS Score change */}
                      {fixResult.addedKeywords?.length > 0 && (
                        <div style={{ display:'flex', justifyContent:'center', gap:24, padding:'10px', background:'#f8fafc', borderRadius:9 }}>
                          {[['Before',fixResult.atsBefore,'#9ca3af'],['After',fixResult.atsAfter,'#00c46a'],['Boost',`+${fixResult.atsAfter-fixResult.atsBefore}`,'#00c46a']].map(([l,v,clr])=>(
                            <div key={l} style={{ textAlign:'center' }}>
                              <div style={{ fontSize:22, fontWeight:800, color:clr }}>{v}</div>
                              <div style={{ fontSize:11, color:'#9ca3af' }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Direct posting URL */}
                  {applyModal.applyUrl && (
                    <div style={{ marginBottom:12, padding:'9px 13px', background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8 }}>
                      <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, marginBottom:3 }}>🔗 Direct job posting URL:</div>
                      <div style={{ fontSize:12, color:'#1e40af', wordBreak:'break-all' }}>{applyModal.applyUrl}</div>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:8, flexDirection:'column' }}>

                    {/* DOWNLOAD UPDATED RESUME — primary action when keywords were added */}
                    {fixResult?.addedKeywords?.length > 0 && (
                      <button onClick={downloadTailoredResume}
                        style={{ padding:'13px', background:'#1e40af', color:'white', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        ⬇ Download Updated Resume (with added keywords)
                      </button>
                    )}

                    {/* Apply button */}
                    {applyModal.applyUrl && (
                      <button onClick={() => openUrl(applyModal.applyUrl, applyModal)}
                        style={{ padding:'13px', background:'#111827', color:'white', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                        📄 Original Job Post — Apply Now ↗
                      </button>
                    )}
                    {applyModal.careerPageUrl && (
                      <button onClick={() => openUrl(applyModal.careerPageUrl, applyModal)}
                        style={{ padding:'11px', background:'#f8fafc', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:10, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                        🏢 {applyModal.company} Careers Page
                      </button>
                    )}
                    <div style={{ display:'flex', gap:8 }}>
                      <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent((applyModal.title||'')+' '+(applyModal.company||''))}`} target="_blank" rel="noreferrer" onClick={()=>{setPendingConfirmJob(applyModal);setApplyModal(null);}} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'10px', border:'1.5px solid #0077b5', borderRadius:9, color:'#0077b5', fontSize:13, fontWeight:600, textDecoration:'none' }}>💼 LinkedIn</a>
                      <a href={`https://www.indeed.com/jobs?q=${encodeURIComponent((applyModal.title||'')+' '+(applyModal.company||''))}`} target="_blank" rel="noreferrer" onClick={()=>{setPendingConfirmJob(applyModal);setApplyModal(null);}} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'10px', border:'1.5px solid #003a9b', borderRadius:9, color:'#003a9b', fontSize:13, fontWeight:600, textDecoration:'none' }}>🔍 Indeed</a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Did you apply? */}
      {didApplyModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:16 }}>
          <div style={{ background:'white', borderRadius:20, width:380, maxWidth:'100%', padding:'28px 24px', textAlign:'center', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>💼</div>
            <h2 style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>Did you apply?</h2>
            <p style={{ fontSize:13, color:'#6b7280', marginBottom:20, lineHeight:1.6 }}>Track your application and improve future recommendations.</p>
            <button onClick={()=>confirmApply(true)} style={{ width:'100%', padding:'13px', background:'#00c46a', color:'white', border:'none', borderRadius:10, fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:8 }}>Yes, I applied! 🎉</button>
            <button onClick={()=>confirmApply(false)} style={{ width:'100%', padding:'13px', background:'#f8fafc', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:10, fontWeight:500, fontSize:14, cursor:'pointer' }}>No, I didn't apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
