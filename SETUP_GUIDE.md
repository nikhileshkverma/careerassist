# CareerAssist v5.0 – Setup Guide
## SmartPath Innovators | COSC 6370.001

---

## 🚀 Quick Start (5 Commands)

```bash
# 1. Kill old ports
lsof -ti:5001 | xargs kill -9 ; lsof -ti:3000 | xargs kill -9

# 2. Start MongoDB
brew services start mongodb-community@7.0

# 3. Install & seed backend
cd careerassist-v5/backend
npm install
node scripts/seed.js

# 4. Run backend (Terminal 1)
npm run dev

# 5. Run frontend (Terminal 2)
cd ../frontend && npm install && npm start
```

## 🤖 LLaMA 3 - Auto-Setup on Backend Start

When you run `npm run dev`, the backend **automatically**:
1. Checks if Ollama is installed
2. Starts the Ollama service if not running
3. Pulls the llama3 model if not downloaded (~4.7GB, first time only)
4. Reports status in terminal

**You only need Ollama installed:**
```bash
brew install ollama
```

The backend does everything else automatically.

---

## 🔐 Credentials
- Admin: `admin@careerassist.com` / `Admin@123`
- Register new user accounts

---

## 🆕 What's New in v5

| Feature | Details |
|---------|---------|
| **Auto Ollama Setup** | Backend auto-installs/starts Ollama on boot |
| **Career Counselor** | Career matches + AI counselor chat merged in one page |
| **Multi-Resume Manager** | Upload multiple resumes, set primary, track versions |
| **JD Tailoring** | Paste JD → select missing skills → AI updates resume |
| **Jobs Section** | 15 curated jobs matched to profile with apply flow |
| **Apply with Autofill** | Click apply → see missing skills → fix resume in 1 click |
| **Better Resume Parser** | Improved PDF extraction for experience and skills |
| **Resume Chat** | Right-panel AI chat while editing resume |

---

## 🔧 Troubleshooting

```bash
# Port conflict
lsof -ti:5001 | xargs kill -9

# MongoDB not running
brew services start mongodb-community@7.0

# Re-seed database
cd backend && node scripts/seed.js --force

# Reinstall
rm -rf node_modules && npm install
```

---
**SmartPath Innovators · CareerAssist v5.0 · COSC 6370.001**
