# CareerAssist — MongoDB + Vercel Deployment Guide

## What Changed from SQLite Version

| File | Change |
|------|--------|
| `backend/database.js` | Replaced better-sqlite3 with mongoose |
| `backend/models/index.js` | NEW — 5 Mongoose schemas replacing SQL tables |
| `backend/server.js` | Added dotenv, updated CORS for Vercel |
| `backend/middleware/auth.js` | JWT_SECRET now reads from env var |
| `backend/routes/auth.js` | SQLite queries → async mongoose calls |
| `backend/routes/profile.js` | SQLite queries → async mongoose calls |
| `backend/routes/career.js` | DB layer only — engine logic unchanged |
| `backend/routes/resume.js` | DB layer only — analyzeResume() unchanged |
| `backend/routes/admin.js` | SQLite queries → async mongoose calls |
| `backend/vercel.json` | NEW — tells Vercel how to run Express |
| `frontend/src/context/AuthContext.js` | Reads REACT_APP_API_URL env var |
| `frontend/vercel.json` | NEW — fixes React Router on Vercel |

---

## STEP 1 — Set Up MongoDB Atlas (Free)

1. Go to https://cloud.mongodb.com → Sign up free
2. Click **"Build a Database"** → Choose **M0 Free** → Pick any region → Click **Create**
3. **Create a database user:**
   - Left menu → Security → Database Access → Add New Database User
   - Username: `careerassist`
   - Password: `CareerAssist2026!` (write this down)
   - Role: **"Read and write to any database"**
   - Click Add User
4. **Allow all IPs (required for Vercel):**
   - Left menu → Security → Network Access → Add IP Address
   - Click **"Allow Access from Anywhere"** (adds 0.0.0.0/0)
   - Click Confirm
5. **Get connection string:**
   - Left menu → Database → Connect → Connect your application
   - Driver: Node.js, Version: 4.1 or later
   - Copy the string — looks like:
     `mongodb+srv://careerassist:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   - Replace `<password>` with your actual password
   - Add `/careerassist` before the `?` to name your database:
     `mongodb+srv://careerassist:CareerAssist2026!@cluster0.xxxxx.mongodb.net/careerassist?retryWrites=true&w=majority`

---

## STEP 2 — Test Locally First

```bash
# 1. Go into backend folder
cd backend

# 2. Create your .env file (copy from .env.example and fill in your values)
cp .env.example .env
# Edit .env and paste your MongoDB connection string

# 3. Install dependencies
npm install

# 4. Start backend
npm run dev
# You should see:
# ✅ MongoDB Atlas connected successfully
# ✅ Admin user seeded: admin@careerassist.com / Admin@123
# ✅ CareerAssist Backend running on http://localhost:5000

# 5. In another terminal, start frontend
cd ../frontend
npm install
npm start
# App opens at http://localhost:3000
```

Test everything works locally before deploying.

---

## STEP 3 — Push to GitHub

```bash
# From the root of careerassist-mongo folder
git init
git add .
git commit -m "CareerAssist - MongoDB version ready for Vercel"

# Go to github.com → New Repository → name it careerassist → Create
# Then run these two lines (replace YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/careerassist.git
git push -u origin main
```

---

## STEP 4 — Deploy Backend on Vercel

1. Go to https://vercel.com → Sign up with GitHub
2. Click **"Add New Project"**
3. Import your `careerassist` GitHub repo
4. **IMPORTANT — set Root Directory to `backend`**
   - Click "Edit" next to Root Directory
   - Type: `backend`
5. Framework Preset: **Other**
6. Click **"Environment Variables"** and add these 3:

   | Name | Value |
   |------|-------|
   | `MONGODB_URI` | your full Atlas connection string |
   | `JWT_SECRET` | `careerassist_secret_2026` |
   | `FRONTEND_URL` | (leave blank for now, fill in after frontend deploys) |

7. Click **Deploy**
8. Wait ~1 minute. You'll get a URL like:
   `https://careerassist-backend-xxxx.vercel.app`
9. Test it: open `https://careerassist-backend-xxxx.vercel.app/api/health`
   — you should see: `{"status":"CareerAssist API running","db":"MongoDB Atlas"}`

---

## STEP 5 — Deploy Frontend on Vercel

1. Go back to Vercel dashboard → **"Add New Project"**
2. Import the **same** `careerassist` GitHub repo again
3. **Set Root Directory to `frontend`**
4. Framework Preset: **Create React App**
5. Add Environment Variable:

   | Name | Value |
   |------|-------|
   | `REACT_APP_API_URL` | `https://careerassist-backend-xxxx.vercel.app` (your backend URL from Step 4) |

6. Click **Deploy**
7. You'll get a frontend URL like:
   `https://careerassist-frontend-xxxx.vercel.app`

---

## STEP 6 — Connect Frontend URL back to Backend

1. Go to your **backend** project on Vercel
2. Settings → Environment Variables
3. Edit `FRONTEND_URL` → paste your frontend URL:
   `https://careerassist-frontend-xxxx.vercel.app`
4. Go to **Deployments** → click the three dots on latest → **Redeploy**

---

## STEP 7 — Test Your Live App

Open your frontend URL and test:
- Register a new account
- Login
- Fill in career profile
- Generate recommendations
- Upload a resume
- Login as admin: `admin@careerassist.com` / `Admin@123`

---

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@careerassist.com | Admin@123 |
| User | register a new account | your choice |

---

## Troubleshooting

**"Cannot connect to MongoDB"**
→ Check your MONGODB_URI in Vercel env vars
→ Make sure 0.0.0.0/0 is in MongoDB Atlas Network Access

**"CORS error" in browser**
→ Make sure FRONTEND_URL in backend env vars exactly matches your frontend URL (no trailing slash)

**"Page not found" on refresh**
→ Make sure frontend/vercel.json exists with the rewrites rule

**Resume upload not persisting between sessions**
→ This is expected on Vercel — files are ephemeral. Feedback data is saved in MongoDB, only the actual file is lost. For production, use Cloudinary for file storage.
