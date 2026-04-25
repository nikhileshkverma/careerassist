# CareerAssist — Setup & Project Guide
## SmartPath Innovators · COSC 6370.001 · Spring 2026

---

## Quick Start

> You need **3 terminal windows** open at the same time. Do this in order.

### Terminal 1 — AI Model
```bash
ollama serve
```
Wait until you see `Ollama is running` before continuing.

### Terminal 2 — Backend
```bash
cd careerassist-v10/backend
npm install
node scripts/seed.js        # first time only — creates demo accounts + clears old data
npm run dev
```
You should see:
```
🚀 CareerAssist v10.0 Backend
   ➜  http://localhost:5001/api/health
   ➜  AI Model: qwen2.5:14b via Ollama
   ✅ Jobs: live jobs cached from Greenhouse + Lever
```

### Terminal 3 — Frontend
```bash
cd careerassist-v10/frontend
npm install
npm start
```
Browser opens automatically at **http://localhost:3000**

---

## Prerequisites (install once)

```bash
# Homebrew (macOS package manager)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js
brew install node

# MongoDB
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0

# Ollama AI runtime
brew install ollama

# Download Qwen2.5-14B model (~9 GB, one time only)
ollama pull qwen2.5:14b
```

> The model download takes 10–20 minutes. It only needs to be done once.  
> All AI runs 100% locally on your machine — no data is sent anywhere.

---

## Login Credentials

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Student (demo) | `demo@student.com` | `Demo@123` | All student features |
| Admin | `admin@careerassist.com` | `Admin@123` | Admin panel + all features |

---

## Environment Variables (`backend/.env`)

| Variable | Value | Purpose |
|----------|-------|---------|
| `PORT` | `5001` | Backend API port |
| `MONGODB_URI` | `mongodb://localhost:27017/careerassist_v10` | Local MongoDB |
| `JWT_SECRET` | `careerassist_v10_jwt_2026` | Token signing |
| `OLLAMA_MODEL` | `qwen2.5:14b` | AI model to use |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama address |
| `AUTO_SETUP_OLLAMA` | `true` | Auto-pull model if missing |
| `JOB_MATCH_THRESHOLD` | `70` | Minimum match score to show |
| `JOB_CACHE_TTL_MINUTES` | `60` | How long live jobs are cached |
| `JOB_FETCH_LIMIT` | `100` | Max jobs to fetch per scrape |

---

## Full Reset (if anything breaks)

```bash
# Kill any stuck processes
lsof -ti:5001 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Drop and recreate the database
mongosh --eval "db.getSiblingDB('careerassist_v10').dropDatabase()"

# Reseed
cd careerassist-v10/backend
node scripts/seed.js

# Then start again normally (3 terminals above)
```

### Frontend module error fix
If you see `@pmmmwh/react-refresh-webpack-plugin` error:
```bash
cd careerassist-v10/frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm start
```

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Frontend | React 18 + React Router v6 | SPA, port 3000 |
| Styling | Custom CSS + inline styles | Inter font, design tokens |
| Backend | Node.js + Express | REST API, port 5001 |
| Database | MongoDB 7.0 (local) | Users, resumes, jobs, history, feedback |
| AI Runtime | Ollama (local) | Hosts Qwen2.5-14B on port 11434 |
| AI Model | Qwen2.5-14B (Q4_K_M) | All AI features — local, private, free |
| Job Data | Greenhouse ATS + Lever ATS | Live scraping from 90+ companies |
| Auth | JWT (7-day tokens) | Stateless, role-based |
| File Parsing | pdf-parse + mammoth | PDF and DOCX resume extraction |

---

## Project Structure

```
careerassist-v10/
├── backend/
│   ├── server.js                  Main Express app, auto-scrapes jobs on startup
│   ├── .env                       Environment config
│   ├── routes/
│   │   ├── auth.js                Register, login, JWT
│   │   ├── profile.js             Profile CRUD, resume auto-fill
│   │   ├── resume.js              Upload, parse, AI chat, ATS, tailor, re-parse
│   │   ├── jobs.js                Recommended, save, apply, dismiss, refresh
│   │   ├── events.js              27 curated events with registration URLs
│   │   ├── career.js              Counselor, simulation, roadmap, recommendations
│   │   └── other.js               Feedback, admin, notifications, success stories
│   ├── models/
│   │   ├── User.js                User + embedded resume schema (with all contact fields)
│   │   ├── CachedJob.js           Live job cache with TTL
│   │   └── index.js               Feedback, ChatHistory, Notification schemas
│   ├── services/jobs/
│   │   ├── liveJobProvider.js     Greenhouse + Lever scraper (90+ companies, 14-day filter)
│   │   ├── jobIngestionService.js MongoDB job cache manager
│   │   ├── matchingEngine.js      AI-powered scoring (Qwen2.5 + rule-based blend)
│   │   └── normalizedJobSchema.js Consistent job data structure
│   ├── utils/
│   │   ├── ollama_setup.js        Qwen2.5-14B connection and auto-pull
│   │   ├── ai_service.js          AI: counselor, JD analysis, tailoring, roadmap
│   │   └── resume_parser.js       v11 parser — works with ALL resume formats
│   └── scripts/
│       └── seed.js                Creates demo accounts, clears old data
│
└── frontend/src/
    ├── App.js                     Routes
    ├── components/Layout.js       Sidebar, topbar, notification bell, AI status
    ├── context/AuthContext.js     Global auth state
    ├── pages/
    │   ├── Auth.js                Login + Register
    │   ├── Dashboard.js           Welcome, stats, career matches
    │   ├── Jobs.js                Live job board, filter, Apply with AI modal
    │   ├── Events.js              27 events, filters, direct registration links
    │   ├── ResumeManager.js       A4 editor, AI chat, JD analysis, download
    │   ├── Profile.js             Single-page all sections, auto-fill from resume
    │   ├── CareerCounselor.js     AI counselor, simulation, learning roadmap
    │   ├── FeedbackPage.js        User feedback
    │   └── AdminPanel.js          Analytics, users, feedback inbox, health score
    └── utils/api.js               All API calls with JWT headers
```

---

## Features

### Jobs
- Live scraping from **90+ companies** via Greenhouse ATS and Lever ATS public APIs
- All job URLs link directly to the **exact job application page** on the company's career portal
- **14-day freshness filter** — no stale or expired postings
- Auto-scrapes on backend startup and when cache is empty
- **AI-powered matching** — Qwen2.5-14B scores job relevance (60% AI + 40% keyword blend)
- Max 8 jobs per company to ensure feed diversity
- Filters: job function, type, location, experience level, salary, H1B, date posted
- H1B Sponsorship Likely badge, Early Applicant badge (< 48 hours)
- Saved, Applied, Dismissed tabs

### Apply with AI (3-step modal)
1. **Match** — see your match score breakdown for the specific job
2. **Optimize** — select which resume; choose missing keywords to add to your skills section
3. **Apply** — original resume content is **never changed**; only missing keywords are appended to skills; download updated resume; click Original Job Post to open the exact application page

### Resume Manager
- Multi-resume support — upload multiple PDFs/DOCX, set one as Primary
- **A4 live preview** — auto-scales to any window size with ResizeObserver
- **AI Rewrite tab** — chat with Qwen2.5-14B to edit your resume in real time
  - `"add Python to skills"` — adds the skill and preview updates instantly
  - `"improve my experience bullets"` — AI rewrites bullets with action verbs
  - `"write a cover letter for ML Engineer"` — full cover letter from your resume data
  - `"fix duplicate publications"` — removes duplicates using fuzzy matching
- **Editor tab** — drag-to-reorder sections, pencil icon for inline AI editing per section
- **Style tab** — Standard / Compact template, font selector, Fit to One Page
- **Download Resume** and **Print / Save PDF** — exports current live state as A4
- **JD Analysis & ATS tab** — select from 47 career roles or paste custom JD; get ATS score, matched skills, missing skills
- **Re-parse button** — re-extracts all data from the original uploaded file using the improved v11 parser

### Resume Parser (v11)
- Works with **any resume format**: ALL-CAPS headers, Title Case, mixed case
- Extracts: name, email, phone, location, LinkedIn, GitHub, summary, skills, experience (with bullets), education, projects, publications, certifications
- Supports date formats: `Jan 2023`, `2023`, `05/2023`, `MM/YYYY`
- Each uploaded resume is fully self-contained — never inherits data from the logged-in user's profile

### Profile
- Single-page view with all sections visible simultaneously
- Color-coded sections: Personal (blue), Education (purple), Experience (orange), Projects (green), Skills (sky), Certifications (fuchsia), Publications (rose)
- Auto-fill from resume upload — parses PDF and fills all profile fields
- Smart deduplication on publications and certifications (fuzzy normalized matching)
- Per-section Edit/Done toggles, completion progress bar

### Career Counselor
- AI counselor chat with full context of user's profile (skills, experience, goals)
- Career match recommendations with match scores and breakdowns
- **Multi-Skill Career Simulation** — add skills, see projected match score improvements across all roles
- **Learning Roadmap** — generates roadmap with real course links (Coursera, Udemy, certifications)
- Persistent chat history in MongoDB

### Events
- 27 curated professional networking events across 9 categories
- Categories: Career Fairs, Conferences, Workshops, Hackathons, Meetups, Alumni Events, Association Events, Startup Events, Networking
- Every event has a **direct verified registration URL**
- Filters: virtual/in-person, free, H1B friendly, event type

### Admin Panel (`admin@careerassist.com`)
- Platform health score (0–100) based on user activity, application rate, AI status
- Daily new users chart, jobs applied by company chart
- Stat cards: total users, active profiles, jobs applied, resume actions, jobs viewed, success stories
- Feedback inbox with user ratings
- Success stories publisher
- Full user list and activity log
- Notification system — message users when their feedback is resolved

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| AI shows "Offline" or rule-based only | Run `ollama serve` in Terminal 1 |
| "AI Offline" after `ollama serve` | Run `ollama pull qwen2.5:14b` |
| Port 5001 in use | `lsof -ti:5001 \| xargs kill -9` |
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| Login fails for demo account | Run `node scripts/seed.js` in `backend/` |
| Cannot connect to MongoDB | `brew services start mongodb-community@7.0` |
| No jobs loading | Wait 30s after backend starts, then click 🔄 Refresh on Jobs page |
| Resume shows only skills, no experience | Click the **Re-parse** button next to the resume in the resume list |
| Resume showing wrong person's data | Delete and re-upload — old resumes pre-date the parser fix |
| Frontend webpack error (`@pmmmwh`) | `rm -rf node_modules package-lock.json && npm install --legacy-peer-deps` |
| AI responses slow | Normal for cover letters (60–90s). Short tasks ~5–15s |
| Job link opens career homepage not exact job | Jobs scraped before the URL fix — click Refresh to fetch updated links |

---

## Live Job Sources (90+ companies)

**Greenhouse ATS:** Anthropic, Databricks, Elastic, Confluent, CockroachDB, Grafana Labs, Weaviate, Cloudflare, HashiCorp, MongoDB, Vercel, Netlify, Stripe, Brex, Rippling, Deel, Gusto, Plaid, Chime, Robinhood, Airbnb, Shopify, Figma, Notion, Airtable, Discord, Canva, Reddit, Twilio, Retool, Linear, Zendesk, Asana, Greenhouse, Benchling, Lattice, Carta, Gong, Mixpanel, Amplitude, Segment, Braze, Klaviyo, Iterable, Snyk, Lacework, Wiz, Orca Security, Nuna, Tempus, dbt Labs, Fivetran, Airbyte, Hex, and more

**Lever ATS:** OpenAI, Scale AI, Cohere, Mistral AI, Perplexity, Hugging Face, Together AI, Anyscale, Modal, Replicate, Qdrant, LangChain, LlamaIndex, Weights & Biases, Determined AI, Lightning AI, CoreWeave, Tailscale, ngrok, Fly.io, Render, Railway, Mercury, Ramp, Sourcegraph, Codeium, Cursor, Replit, Gitpod, and more

---

## AI Model Details

| Property | Value |
|----------|-------|
| Model | Qwen2.5-14B |
| Quantization | Q4_K_M (optimized for Apple Silicon) |
| Parameters | 14 billion |
| Context window | 128K tokens |
| RAM required | ~10 GB unified memory (16 GB Mac recommended) |
| Storage | ~9 GB on disk |
| Speed (M3 Pro) | ~25–35 tokens/second |
| Privacy | All inference local — zero data leaves the machine |
| Cost | Free — no API keys, no subscriptions |

**What the AI does in CareerAssist:**
- Resume editing via chat commands (add/remove skills, improve bullets, cover letters)
- Job relevance scoring (blended with keyword matching for stability)
- JD analysis — match score, present skills, missing skills, improvement tips
- Career counselor — personalized advice based on your full profile
- Learning roadmap generation with real course links
- Multi-skill career simulation — projected score improvements

---

## Demo Script (for presentation)

1. Login as `demo@student.com` → show Dashboard with career match rings
2. Open **Resume Manager** → show A4 live preview → type `"add Docker to skills"` in AI chat → watch preview update
3. Open **JD Analysis & ATS tab** → paste a job description → show ATS score and missing keywords
4. Open **Jobs page** → show live companies → click a job → show match rings → click **Original Job Post**
5. Click **Apply with AI** → walk through 3 steps → show Download Updated Resume button
6. Open **Career Counselor** → ask `"What skills am I missing for ML Engineer?"` → show AI response
7. Open **Simulation tab** → add a skill → show score change
8. Open **Events page** → filter by Virtual + Free → click Register Now
9. Login as `admin@careerassist.com` → show Admin Panel with Platform Health score

---

*SmartPath Innovators · CareerAssist v10.0 · COSC 6370.001 · Spring 2026*  
*Nikhilesh Verma · Keerthana Ellanki · Keerthi Reddy Vangeti · Chandana Lingala*