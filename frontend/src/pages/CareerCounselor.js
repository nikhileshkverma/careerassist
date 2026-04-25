import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { careerAPI } from '../utils/api';

const C = ['#00c46a','#6366f1','#f59e0b','#06b6d4','#ef4444','#8b5cf6'];
const GB = { 'Very High':'badge-green','High':'badge-blue','Medium':'badge-yellow','Low':'badge-gray' };
const cc = c => c >= 70 ? '#00c46a' : c >= 40 ? '#f59e0b' : '#ef4444';

// Typewriter hook - streams text character by character for realism
function useTypewriter(text, speed = 12) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(true); return; }
    setDisplayed(''); setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(timer); setDone(true); }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return { displayed, done };
}

function ChatBubble({ msg, isLatest }) {
  const fmtContent = t => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
  const { displayed, done } = useTypewriter(isLatest && msg.role === 'assistant' ? msg.content : null, 8);
  const content = isLatest && msg.role === 'assistant' ? displayed : msg.content;

  return (
    <div className={`chat-msg ${msg.role}`}>
      <div className="chat-avatar" style={{ background: msg.role === 'user' ? 'var(--primary)' : '#f3f4f6', fontSize: 14 }}>
        {msg.role === 'user' ? '👤' : '🤖'}
      </div>
      <div className={`chat-bubble ${msg.role}`} style={{ position: 'relative' }}>
        <div dangerouslySetInnerHTML={{ __html: fmtContent(content || '') }} />
        {isLatest && msg.role === 'assistant' && !done && (
          <span style={{ display: 'inline-block', width: 8, height: 14, background: '#00c46a', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 0.7s step-end infinite', borderRadius: 2 }} />
        )}
      </div>
    </div>
  );
}

const QUICK_QUESTIONS = [
  'What career best matches my profile?',
  'What skills am I missing for my top match?',
  'How do I become a Machine Learning Engineer?',
  'What salary can I expect?',
  'Create a 3-month learning roadmap for me',
  'How should I prepare for ML interviews?',
  'Compare my top 3 career matches',
  'What projects should I build for my portfolio?',
];

export default function CareerCounselor() {
  const [recs, setRecs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('matches');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [roadmap, setRoadmap] = useState(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [simSkills, setSimSkills] = useState([]);  // multi-skill selection
  const [simInput, setSimInput] = useState('');
  const [simResults, setSimResults] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState({});

  // Chat
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInit, setChatInit] = useState(true);
  const [latestIdx, setLatestIdx] = useState(-1);
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    Promise.all([careerAPI.getRecommendations(), careerAPI.counselHistory(), careerAPI.aiStatus()])
      .then(([r, h, ai]) => {
        setRecs(r.data || []);
        const hist = h.data || [];
        if (hist.length > 0) {
          setMessages(hist);
          setLatestIdx(hist.length - 1);
        } else {
          const welcome = { role: 'assistant', content: `Hi there! 👋 I'm your AI Career Counselor — think of me as your personal career advisor who knows your full profile.\n\nI can help you with **career path planning, skill gap analysis, interview prep, salary negotiation, and personalized learning roadmaps**.\n\nWhat's on your mind today?`, createdAt: new Date() };
          setMessages([welcome]);
          setLatestIdx(0);
        }
        setAiStatus(ai.data || {});
      }).catch(() => {}).finally(() => { setLoading(false); setChatInit(false); });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const generate = async () => {
    setGenerating(true); setError(''); setSelected(null); setRoadmap(null);
    try { const r = await careerAPI.recommend(); setRecs(r.data.recommendations || []); setTab('matches'); }
    catch (e) { setError(e.response?.data?.error || 'Failed. Add skills to your profile first.'); }
    finally { setGenerating(false); }
  };

  // addSimSkill: toggle a skill in/out of the multi-skill simulation list
  const addSimSkill = (skill) => {
    const s = (typeof skill === 'string' ? skill : simInput).trim();
    if (!s) return;
    setSimSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setSimInput('');
  };

  const simulate = async () => {
    const skillsToSim = simSkills.length > 0 ? simSkills : (simInput.trim() ? [simInput.trim()] : []);
    if (skillsToSim.length === 0) return;
    setSimLoading(true); setSimResults(null);
    try {
      // Simulate all selected skills combined
      const r = await careerAPI.simulate(skillsToSim.join(', '));
      setSimResults(r.data);
    }
    catch (e) { setSimResults({ error: e.response?.data?.error || 'Failed. Check your profile has skills added.' }); }
    finally { setSimLoading(false); }
  };

  const loadRoadmap = async (rec) => {
    setTab('roadmap'); setRoadmap(null); setRoadmapLoading(true);
    try {
      const r = await careerAPI.roadmap({ roleId: rec.roleId, roleName: rec.careerTitle, missingSkills: rec.missingSkills || [] });
      setRoadmap({ ...r.data.roadmap, targetRole: rec.careerTitle });
    } catch { setRoadmap({ error: 'Failed to generate roadmap.' }); }
    finally { setRoadmapLoading(false); }
  };

  const sendMessage = async (text) => {
    const msg = text || chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const userMsg = { role: 'user', content: msg, createdAt: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLatestIdx(newMessages.length); // next message will be latest
    setChatLoading(true);
    inputRef.current?.focus();
    try {
      const r = await careerAPI.counsel({ message: msg, history: messages.slice(-8) });
      const assistantMsg = { role: 'assistant', content: r.data.response, createdAt: new Date() };
      const final = [...newMessages, assistantMsg];
      setMessages(final);
      setLatestIdx(final.length - 1);
    } catch {
      const errMsg = { role: 'assistant', content: 'Sorry, I ran into an issue. Please try again.', createdAt: new Date() };
      const final = [...newMessages, errMsg];
      setMessages(final);
      setLatestIdx(final.length - 1);
    } finally { setChatLoading(false); }
  };

  const clearChat = async () => {
    await careerAPI.clearCounselHistory().catch(() => {});
    const welcome = { role: 'assistant', content: 'Chat cleared! 🔄 Ready for a fresh conversation — what would you like to explore?', createdAt: new Date() };
    setMessages([welcome]);
    setLatestIdx(0);
  };

  const selRec = selected !== null ? recs[selected] : null;
  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 390px', gap: 16, height: 'calc(100vh - 80px)' }}>
      {/* Left: Career matching + roadmap + simulation */}
      <div style={{ overflowY: 'auto', paddingRight: 2 }}>
        <div className="page-header">
          <h1>🎯 Career Counselor</h1>
          <p>AI-powered career matching · learning roadmaps · skill gap analysis</p>
        </div>

        {/* AI status */}
        <div className={`ai-status-bar ${aiStatus.ready ? 'ready' : 'offline'}`} style={{ marginBottom: 14 }}>
          {aiStatus.ready
            ? <><span className="ai-ready-dot" /> Qwen2.5-14B Active — Full AI counseling enabled</>
            : <>🤖 Smart rule-based counseling · <span style={{ fontWeight: 400 }}>Install Ollama for Qwen2.5-14B: <code>brew install ollama && ollama pull qwen2.5:14b</code></span></>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="tab-nav" style={{ marginBottom: 0, flex: 1 }}>
            <button className={`tab-btn${tab === 'matches' ? ' active' : ''}`} onClick={() => setTab('matches')}>🎯 Matches</button>
            <button className={`tab-btn${tab === 'simulate' ? ' active' : ''}`} onClick={() => setTab('simulate')}>🔬 Simulation</button>
            <button className={`tab-btn${tab === 'roadmap' ? ' active' : ''}`} onClick={() => setTab('roadmap')}>🗺️ Roadmap</button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={generate} disabled={generating} style={{ marginLeft: 12 }}>
            {generating ? '⏳...' : '🔄 Generate'}
          </button>
        </div>

        {error && <div className="alert alert-error">⚠️ {error} <Link to="/profile" style={{ fontWeight: 600 }}>Fix profile →</Link></div>}

        {/* MATCHES */}
        {tab === 'matches' && (
          recs.length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: 50 }}>
              <div style={{ fontSize: 50 }}>🎯</div>
              <h3 style={{ marginTop: 14 }}>No matches yet</h3>
              <p style={{ color: 'var(--muted)', margin: '8px 0 18px', fontSize: 13 }}>Add skills to your profile, then click Generate</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Link to="/profile" className="btn btn-secondary">Build Profile</Link>
                <button className="btn btn-primary" onClick={generate} disabled={generating}>{generating ? '⏳' : '⚡ Generate Now'}</button>
              </div>
            </div>
            : <div style={{ display: 'grid', gridTemplateColumns: selRec ? '280px 1fr' : '1fr', gap: 14 }}>
              <div>
                {recs.map((rec, i) => (
                  <div key={i} onClick={() => setSelected(selected === i ? null : i)} className="card card-sm"
                    style={{ marginBottom: 10, cursor: 'pointer', border: selected === i ? `2px solid ${C[i]}` : '1px solid var(--border)', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${C[i]}18`, color: C[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{rec.icon || `#${i + 1}`}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{rec.careerTitle}</div>
                        <div className="progress-track" style={{ marginBottom: 3 }}><div className="progress-bar" style={{ width: `${rec.matchPercentage}%`, background: C[i] }} /></div>
                        <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                          <span style={{ color: C[i], fontWeight: 700 }}>{rec.matchPercentage}% match</span>
                          <span style={{ color: cc(rec.confidenceScore || 0) }}>💡 {rec.confidenceScore || 0}% conf</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selRec && (
                <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{selRec.icon}</div>
                      <h2 style={{ fontSize: 17 }}>{selRec.careerTitle}</h2>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{selRec.category}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[['matchPercentage', 'Match', C[selected]], ['confidenceScore', 'Confidence', cc(selRec.confidenceScore || 0)]].map(([k, l, cl]) => (
                      <div key={k} style={{ background: '#f9fafb', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: cl }}>{selRec[k]}%</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                    {selRec.growth && <span className={`badge ${GB[selRec.growth] || 'badge-gray'}`}>📈 {selRec.growth}</span>}
                    {selRec.avgSalary && <span className="badge badge-green">💰 {selRec.avgSalary}</span>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 7 }}>💡 Why This Career?</div>
                    <p style={{ fontSize: 12.5, lineHeight: 1.7, background: '#f9fafb', borderRadius: 8, padding: 10 }}>{selRec.recommendationText}</p>
                  </div>
                  {selRec.missingSkills?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 7, color: '#f59e0b' }}>📚 Skill Gaps</div>
                      <div>{selRec.missingSkills.map((g, i) => <span key={i} className="tag tag-yellow">{g}</span>)}</div>
                    </div>
                  )}
                  {selRec.keyResources?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 7 }}>🔗 Resources</div>
                      <div>{selRec.keyResources.map((r, i) => <span key={i} className="tag tag-accent">📌 {r}</span>)}</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => loadRoadmap(selRec)}>🗺️ Learning Roadmap</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { sendMessage(`Tell me everything about becoming a ${selRec.careerTitle} — roadmap, skills, salary, and interview tips.`); }}>Ask AI →</button>
                  </div>
                </div>
              )}
            </div>
        )}

        {/* SIMULATION */}
        {tab === 'simulate' && (
          <div>
            <div className="card" style={{ marginBottom: 18 }}>
              <h3 style={{ marginBottom: 4, fontSize: 14 }}>🔬 Multi-Skill Career Simulation</h3>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
                Add multiple skills to see how learning them together changes your career match scores.
              </p>

              {/* Input + add */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input className="form-control" value={simInput}
                  onChange={e => setSimInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSimSkill(simInput); }}}
                  placeholder="Type a skill and press Enter…" />
                <button className="btn btn-secondary" onClick={() => addSimSkill(simInput)} disabled={!simInput.trim()}>Add</button>
                <button className="btn btn-primary" onClick={simulate} disabled={simLoading || !simSkills.length}
                  style={{ background: '#00c46a', borderColor: '#00c46a', whiteSpace: 'nowrap' }}>
                  {simLoading ? '⏳' : '🚀 Run'}
                </button>
              </div>

              {/* Quick-add chips */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {['Python','PyTorch','LangChain','AWS','React','Docker','SQL','Kubernetes','TensorFlow','LLM','RAG','TypeScript','Go','Redis'].map(s => (
                  <span key={s} onClick={() => addSimSkill(s)}
                    style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', userSelect: 'none',
                      background: simSkills.includes(s) ? '#d1fae5' : '#f1f5f9',
                      color: simSkills.includes(s) ? '#065f46' : '#475569',
                      border: `1px solid ${simSkills.includes(s) ? '#6ee7b7' : '#e2e8f0'}`,
                      fontWeight: simSkills.includes(s) ? 600 : 400 }}>
                    {simSkills.includes(s) ? '✓ ' : '+ '}{s}
                  </span>
                ))}
              </div>

              {/* Selected skills */}
              {simSkills.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '8px 10px', background: '#f0fdf4', borderRadius: 8, marginBottom: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600, marginRight: 4 }}>Simulating:</span>
                  {simSkills.map(s => (
                    <span key={s} style={{ fontSize: 12, background: '#00c46a', color: 'white', padding: '2px 10px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {s}
                      <button onClick={() => removeSimSkill(s)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  ))}
                  <button onClick={() => setSimSkills([])} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, marginLeft: 4 }}>Clear all</button>
                </div>
              )}

              {simResults?.error && <div className="alert alert-error">{simResults.error}</div>}
            </div>

            {/* Results */}
            {simResults && !simResults.error && (
              <div>
                <div className="alert alert-success" style={{ marginBottom: 14 }}>
                  ✅ If you learn <strong>{simResults.new_skill}</strong>, here's how your career matches change:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                  {simResults.simulations.map((sim, i) => (
                    <div key={i} className="card card-sm" style={{ borderLeft: `3px solid ${sim.improvement > 5 ? '#00c46a' : sim.improvement > 0 ? '#3b82f6' : '#e5e7eb'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{sim.icon || '💼'} {sim.careerTitle}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: sim.improvement > 0 ? '#00c46a' : sim.improvement < 0 ? '#ef4444' : '#9ca3af', whiteSpace: 'nowrap' }}>
                          {sim.improvement > 0 ? `+${sim.improvement}%` : sim.improvement < 0 ? `${sim.improvement}%` : '—'}
                        </div>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ color: 'var(--muted)' }}>Current</span>
                          <span>{sim.beforeScore}%</span>
                        </div>
                        <div className="progress-track" style={{ marginBottom: 5 }}>
                          <div className="progress-bar" style={{ width: `${sim.beforeScore}%`, background: '#e5e7eb' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ color: 'var(--muted)' }}>After learning</span>
                          <span style={{ fontWeight: 700, color: sim.improvement > 0 ? '#00c46a' : '#6b7280' }}>{sim.afterScore}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-bar" style={{ width: `${sim.afterScore}%`, background: sim.improvement > 0 ? '#00c46a' : '#6366f1' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROADMAP */}
        {tab === 'roadmap' && (
          <div>
            {roadmapLoading && <div className="loading"><div className="spinner" /></div>}
            {!roadmapLoading && !roadmap && (
              <div className="card" style={{ textAlign: 'center', padding: 50 }}>
                <div style={{ fontSize: 50 }}>🗺️</div>
                <h3 style={{ marginTop: 14 }}>Generate a Learning Roadmap</h3>
                <p style={{ color: 'var(--muted)', margin: '8px 0 18px', fontSize: 13 }}>Go to Matches, click any career, then click "Learning Roadmap"</p>
                <button className="btn btn-secondary" onClick={() => setTab('matches')}>← Go to Matches</button>
              </div>
            )}
            {roadmap && !roadmap.error && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: 17 }}>🗺️ Roadmap: {roadmap.targetRole}</h2>
                    {roadmap.estimated_time && <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>⏱️ Estimated time: {roadmap.estimated_time}</p>}
                  </div>
                  {roadmap.aiUsed ? <span className="ai-badge">🤖 AI Generated</span> : <span className="badge badge-gray">Rule-based</span>}
                </div>

                {roadmap.missing_skills?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ marginBottom: 12, fontSize: 14 }}>❌ Skills to Develop</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                      {roadmap.missing_skills.map((item, i) => (
                        <div key={i} className="card card-sm" style={{ borderLeft: `4px solid ${C[i % C.length]}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: C[i % C.length] }}>{item.skill}</div>
                            {item.priority && <span className={`badge ${item.priority === 'High' ? 'badge-red' : 'badge-yellow'}`}>{item.priority}</span>}
                          </div>
                          {item.reason && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>{item.reason}</p>}
                          {item.estimated_weeks && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>⏱️ ~{item.estimated_weeks} weeks</div>}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {/* Show real course links if available, fallback to search */}
                            {item.course_links?.length > 0
                              ? item.course_links.map((link, li) => (
                                <a key={li} href={link.url} target="_blank" rel="noreferrer"
                                  className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
                                  {link.label}
                                </a>
                              ))
                              : <>
                                {item.google_query && <a href={`https://www.google.com/search?q=${encodeURIComponent(item.google_query)}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>🔍 Google</a>}
                                {item.youtube_query && <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.youtube_query)}`} target="_blank" rel="noreferrer" className="btn btn-danger btn-sm" style={{ fontSize: 11 }}>▶ YouTube</a>}
                              </>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {roadmap.learning_roadmap?.length > 0 && (
                  <div className="card">
                    <h3 style={{ marginBottom: 14, fontSize: 14 }}>🧭 Step-by-Step Plan</h3>
                    {roadmap.learning_roadmap.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i < roadmap.learning_roadmap.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: C[i % C.length], color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.6, paddingTop: 2 }}>{step}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: AI Chat */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--border)', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>🤖 AI Career Counselor</div>
            <div style={{ fontSize: 11.5, color: aiStatus.ready ? '#00c46a' : 'var(--muted)', marginTop: 1 }}>
              {aiStatus.ready ? '● Qwen2.5-14B Active' : '● Smart responses'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={clearChat} style={{ fontSize: 11 }}>🗑️ Clear</button>
        </div>

        {/* Quick suggestions */}
        {messages.length <= 1 && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>TRY ASKING:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {QUICK_QUESTIONS.map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {chatInit
            ? <div className="loading"><div className="spinner" /></div>
            : messages.map((m, i) => (
              <ChatBubble key={i} msg={m} isLatest={i === latestIdx} />
            ))
          }
          {chatLoading && (
            <div className="chat-msg assistant">
              <div className="chat-avatar" style={{ background: '#f3f4f6', fontSize: 14 }}>🤖</div>
              <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', minWidth: 60 }}>
                {[0, 0.18, 0.36].map((d, i) => (
                  <div key={i} className="typing-dot" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={inputRef} className="form-control" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())} placeholder="Ask about careers, skills, salary, interviews..." style={{ flex: 1, fontSize: 13 }} />
            <button className="btn btn-primary btn-sm" onClick={() => sendMessage()} disabled={!chatInput.trim() || chatLoading} style={{ background: '#00c46a', borderColor: '#00c46a', padding: '7px 14px' }}>→</button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5, textAlign: 'center' }}>
            {aiStatus.ready ? '🤖 Qwen2.5-14B · context-aware responses' : '💡 Smart counseling · install Ollama for Qwen2.5-14B'}
          </div>
        </div>
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}
