import React, { useState, useEffect, useCallback } from 'react';
import { eventsAPI } from '../utils/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { id:'All',             icon:'🌐', color:'#374151', bg:'#f1f5f9' },
  { id:'Career Fair',     icon:'🎪', color:'#065f46', bg:'#d1fae5' },
  { id:'Conference',      icon:'🏛️', color:'#1e40af', bg:'#dbeafe' },
  { id:'Workshop',        icon:'🎓', color:'#5b21b6', bg:'#ede9fe' },
  { id:'Meetup',          icon:'☕', color:'#92400e', bg:'#fef3c7' },
  { id:'Association Event',icon:'🏢',color:'#0c4a6e', bg:'#e0f2fe' },
  { id:'Hackathon',       icon:'💻', color:'#166534', bg:'#dcfce7' },
  { id:'Startup Event',   icon:'🚀', color:'#7c2d12', bg:'#fed7aa' },
  { id:'Alumni Event',    icon:'🎓', color:'#4a1d96', bg:'#f5f3ff' },
  { id:'Networking',      icon:'☕', color:'#134e4a', bg:'#ccfbf1' },
];

const REG_STYLE = {
  'Required':  { bg:'#fee2e2', color:'#991b1b', label:'Registration Required' },
  'RSVP':      { bg:'#fef3c7', color:'#92400e', label:'RSVP Required' },
  'Open Entry':{ bg:'#d1fae5', color:'#065f46', label:'Open Entry' },
};

function getTypeStyle(type) {
  return EVENT_TYPES.find(t => t.id === type) || EVENT_TYPES[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Card — same card design language as Jobs
// ─────────────────────────────────────────────────────────────────────────────
function EventCard({ event, isSelected, onClick }) {
  const ts = getTypeStyle(event.type);
  const rs = REG_STYLE[event.registration] || REG_STYLE['RSVP'];

  return (
    <div onClick={onClick}
      style={{ padding:'14px 16px', borderBottom:'1px solid #f1f5f9', cursor:'pointer',
        background: isSelected ? '#f0fdf4' : 'white',
        borderLeft: `3px solid ${isSelected ? '#00c46a' : 'transparent'}`,
        transition:'background 0.1s' }}>
      <div style={{ display:'flex', gap:12 }}>
        {/* Icon */}
        <div style={{ width:44, height:44, borderRadius:10, background:ts.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
          {ts.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, color:'#6b7280', marginBottom:2 }}>
            <span style={{ fontWeight:600, color:ts.color }}>{event.type}</span>
            <span style={{ color:'#9ca3af' }}> · {event.org}</span>
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'#111', lineHeight:1.3, marginBottom:5 }}>{event.title}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:11.5, color:'#6b7280', marginBottom:6 }}>
            <span>{event.virtual ? '🌐 Virtual' : `📍 ${event.location}`}</span>
            <span>📅 {event.nextDate}</span>
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {event.free && <span style={{ fontSize:10.5, background:'#d1fae5', color:'#065f46', padding:'2px 7px', borderRadius:99, fontWeight:600 }}>Free</span>}
            {event.h1bFriendly && <span style={{ fontSize:10.5, background:'#dbeafe', color:'#1e40af', padding:'2px 7px', borderRadius:99, fontWeight:600 }}>H1B ✓</span>}
            {event.virtual && <span style={{ fontSize:10.5, background:'#f1f5f9', color:'#374151', padding:'2px 7px', borderRadius:99 }}>Virtual</span>}
            <span style={{ fontSize:10.5, background:rs.bg, color:rs.color, padding:'2px 7px', borderRadius:99, fontWeight:500 }}>{event.registration}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Detail — right panel
// ─────────────────────────────────────────────────────────────────────────────
function EventDetail({ event }) {
  if (!event) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'#94a3b8' }}>
      <div style={{ fontSize:52 }}>🎪</div>
      <div style={{ fontSize:15, fontWeight:600 }}>Select an event to view details</div>
    </div>
  );

  const ts = getTypeStyle(event.type);
  const rs = REG_STYLE[event.registration] || REG_STYLE['RSVP'];

  return (
    <div style={{ padding:'24px', overflowY:'auto', height:'100%' }}>
      {/* Header */}
      <div style={{ display:'flex', gap:16, marginBottom:20 }}>
        <div style={{ width:60, height:60, borderRadius:14, background:ts.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>
          {ts.icon}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>
            <span style={{ fontWeight:700, color:ts.color, background:ts.bg, padding:'2px 8px', borderRadius:99, fontSize:11 }}>{event.type}</span>
            <span style={{ marginLeft:8, color:'#9ca3af' }}>by {event.org}</span>
          </div>
          <h2 style={{ fontSize:21, fontWeight:800, margin:'0 0 8px', color:'#111', lineHeight:1.2 }}>{event.title}</h2>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, fontSize:13.5, color:'#6b7280' }}>
            <span>{event.virtual ? '🌐 Virtual' : `📍 ${event.location}`}</span>
            <span>📅 {event.date}</span>
            <span>🎯 {event.audience}</span>
          </div>
        </div>
      </div>

      {/* Registration info bar */}
      <div style={{ display:'flex', gap:8, padding:'12px 14px', background:'#f8fafc', borderRadius:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:12.5, background:rs.bg, color:rs.color, padding:'4px 11px', borderRadius:20, fontWeight:700 }}>
          {event.registration === 'Required' ? '📋 Registration Required' :
           event.registration === 'RSVP'     ? '✋ RSVP Required' : '🚪 Open Entry'}
        </span>
        {event.free && <span style={{ fontSize:12.5, background:'#d1fae5', color:'#065f46', padding:'4px 11px', borderRadius:20, fontWeight:600 }}>💰 Free to Attend</span>}
        {!event.free && <span style={{ fontSize:12.5, background:'#fef3c7', color:'#92400e', padding:'4px 11px', borderRadius:20, fontWeight:600 }}>💳 Paid Event</span>}
        {event.h1bFriendly && <span style={{ fontSize:12.5, background:'#dbeafe', color:'#1e40af', padding:'4px 11px', borderRadius:20, fontWeight:600 }}>🌐 H1B Visa Friendly</span>}
        {event.virtual && <span style={{ fontSize:12.5, background:'#f1f5f9', color:'#374151', padding:'4px 11px', borderRadius:20 }}>💻 Virtual / Online</span>}
      </div>

      {/* Description */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:10, color:'#111' }}>📋 About This Event</div>
        <p style={{ fontSize:14, lineHeight:1.8, color:'#374151' }}>{event.description}</p>
      </div>

      {/* Tags */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:8, color:'#374151' }}>🏷️ Relevant For</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {event.tags.map((t,i) => (
            <span key={i} style={{ fontSize:12.5, background:'#f1f5f9', color:'#374151', padding:'4px 11px', borderRadius:8, fontWeight:500 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Audience */}
      <div style={{ marginBottom:24, padding:'12px 14px', background:'#fafafa', borderRadius:10, border:'1px solid #e5e7eb' }}>
        <div style={{ fontSize:12, color:'#6b7280', fontWeight:600, marginBottom:4 }}>👥 Who Should Attend</div>
        <div style={{ fontSize:13.5, color:'#374151', fontWeight:500 }}>{event.audience}</div>
      </div>

      {/* Registration button — opens DIRECT registration page */}
      <div style={{ display:'flex', gap:10, flexDirection:'column' }}>
        <div style={{ padding:'10px 14px', background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8, marginBottom:4 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:3 }}>🔗 Direct Registration Link:</div>
          <div style={{ fontSize:12.5, color:'#1e40af', wordBreak:'break-all' }}>{event.url}</div>
        </div>
        <a href={event.url} target="_blank" rel="noreferrer"
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'16px 24px', background:'#111827', color:'white', borderRadius:10, fontWeight:700, fontSize:15, textDecoration:'none', textAlign:'center' }}>
          {event.registration === 'Required' ? '📋 Register for This Event ↗' :
           event.registration === 'RSVP'     ? '✋ RSVP Now ↗' : '🚪 View & Join Event ↗'}
        </a>
        <div style={{ fontSize:12, color:'#9ca3af', textAlign:'center', lineHeight:1.5 }}>
          ↗ Opens the official {event.registration === 'Required' ? 'registration' : event.registration === 'RSVP' ? 'RSVP' : 'event'} page directly
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Events Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Events() {
  const [events, setEvents]         = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterVirtual, setFilterVirtual] = useState('');
  const [filterFree, setFilterFree] = useState(false);
  const [filterH1b, setFilterH1b]   = useState(false);
  const [total, setTotal]           = useState(0);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)              params.search  = search;
      if (filterType !== 'All') params.type   = filterType;
      if (filterVirtual)       params.virtual = filterVirtual;
      if (filterFree)          params.free    = 'true';
      if (filterH1b)           params.h1b     = 'true';
      const r = await eventsAPI.getAll(params);
      setEvents(r.data.events || []);
      setTotal(r.data.total || 0);
      if ((r.data.events||[]).length > 0 && !selectedEvent) setSelectedEvent(r.data.events[0]);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [search, filterType, filterVirtual, filterFree, filterH1b]);

  useEffect(() => { loadEvents(); }, [filterType, filterVirtual, filterFree, filterH1b]);
  useEffect(() => {
    const t = setTimeout(loadEvents, 350);
    return () => clearTimeout(t);
  }, [search]);

  const typeCount = (type) => {
    if (type === 'All') return events.length;
    return events.filter(e => e.type === type).length;
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 56px)', overflow:'hidden', background:'#f8fafc' }}>

      {/* Top bar */}
      <div style={{ padding:'10px 0', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, paddingBottom:10 }}>
          <div>
            <h1 style={{ fontSize:19, fontWeight:800, margin:0, color:'#111' }}>🎪 Events</h1>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
              {loading ? 'Loading...' : `${total} events · Career fairs, conferences, hackathons & more`}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search events, skills, organizations…"
                style={{ width:260, fontSize:13, padding:'8px 36px 8px 12px', border:'1px solid #e5e7eb', borderRadius:9, background:'white', outline:'none' }}/>
              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:14 }}>🔍</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', paddingBottom:8 }}>
          {/* Virtual / In-person filter */}
          {[
            { val:'',      label:'All Formats' },
            { val:'true',  label:'🌐 Virtual Only' },
            { val:'false', label:'📍 In-Person' },
          ].map(f => (
            <button key={f.val} onClick={() => setFilterVirtual(f.val)}
              style={{ padding:'5px 12px', borderRadius:20, fontSize:12.5, fontWeight:filterVirtual===f.val?700:500, border:`1.5px solid ${filterVirtual===f.val?'#00c46a':'#e5e7eb'}`, background:filterVirtual===f.val?'#f0fdf4':'white', color:filterVirtual===f.val?'#065f46':'#374151', cursor:'pointer' }}>
              {f.label}
            </button>
          ))}
          <div style={{ width:1, height:20, background:'#e5e7eb', margin:'0 2px' }}/>
          <button onClick={() => setFilterFree(v => !v)}
            style={{ padding:'5px 12px', borderRadius:20, fontSize:12.5, fontWeight:filterFree?700:500, border:`1.5px solid ${filterFree?'#00c46a':'#e5e7eb'}`, background:filterFree?'#d1fae5':'white', color:filterFree?'#065f46':'#374151', cursor:'pointer' }}>
            {filterFree ? '✓ ' : ''}Free Events
          </button>
          <button onClick={() => setFilterH1b(v => !v)}
            style={{ padding:'5px 12px', borderRadius:20, fontSize:12.5, fontWeight:filterH1b?700:500, border:`1.5px solid ${filterH1b?'#1e40af':'#e5e7eb'}`, background:filterH1b?'#dbeafe':'white', color:filterH1b?'#1e40af':'#374151', cursor:'pointer' }}>
            {filterH1b ? '✓ ' : ''}H1B Friendly
          </button>
          {(filterVirtual || filterFree || filterH1b || filterType !== 'All') && (
            <button onClick={() => { setFilterVirtual(''); setFilterFree(false); setFilterH1b(false); setFilterType('All'); }}
              style={{ padding:'5px 10px', borderRadius:20, fontSize:12, border:'1px solid #e5e7eb', background:'#f1f5f9', color:'#6b7280', cursor:'pointer' }}>
              Clear all ×
            </button>
          )}
        </div>

        {/* Type filter tabs */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', paddingBottom:2 }}>
          {EVENT_TYPES.map(t => {
            const cnt = t.id === 'All' ? events.length : events.filter(e => e.type === t.id).length;
            const active = filterType === t.id;
            return (
              <button key={t.id} onClick={() => setFilterType(t.id)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12.5, fontWeight:active?700:500,
                  border:`1.5px solid ${active?t.color:'#e5e7eb'}`, background:active?t.bg:'white', color:active?t.color:'#6b7280', cursor:'pointer', transition:'all 0.1s' }}>
                <span>{t.icon}</span> {t.id} {cnt > 0 && <span style={{ fontSize:10.5, background:active?'rgba(0,0,0,0.1)':'#f1f5f9', padding:'0 5px', borderRadius:99 }}>{cnt}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main split */}
      <div style={{ display:'grid', gridTemplateColumns:'clamp(300px,34%,420px) 1fr', flex:1, minHeight:0, overflow:'hidden' }}>

        {/* Left: events list */}
        <div style={{ overflowY:'auto', borderRight:'1px solid #e5e7eb', background:'white', height:'100%' }}>
          {loading && <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}><div className="spinner" style={{ margin:'0 auto 12px' }}/><div>Loading events...</div></div>}
          {!loading && events.length === 0 && (
            <div style={{ padding:48, textAlign:'center', color:'#9ca3af' }}>
              <div style={{ fontSize:44 }}>🔍</div>
              <div style={{ fontWeight:600, fontSize:14, marginTop:12 }}>No events found</div>
              <div style={{ fontSize:13, marginTop:6 }}>Try adjusting your filters</div>
              <button onClick={() => { setFilterType('All'); setFilterVirtual(''); setFilterFree(false); setFilterH1b(false); setSearch(''); }}
                style={{ marginTop:14, padding:'8px 20px', background:'#00c46a', color:'white', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer' }}>
                Clear Filters
              </button>
            </div>
          )}
          {events.map(event => (
            <EventCard key={event.id} event={event}
              isSelected={(selectedEvent?.id) === event.id}
              onClick={() => setSelectedEvent(event)}/>
          ))}
        </div>

        {/* Right: event detail */}
        <div style={{ overflowY:'auto', background:'white', height:'100%' }}>
          <EventDetail event={selectedEvent}/>
        </div>
      </div>
    </div>
  );
}
