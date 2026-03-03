require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

const authRoutes    = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const careerRoutes  = require('./routes/career');
const resumeRoutes  = require('./routes/resume');
const adminRoutes   = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── CORS — allow both local dev and deployed frontend ─────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,        // set in Vercel env vars
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Connect to MongoDB ─────────────────────────────────────────────────────
initializeDatabase();

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/career',  careerRoutes);
app.use('/api/resume',  resumeRoutes);
app.use('/api/admin',   adminRoutes);

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'CareerAssist API running', db: 'MongoDB Atlas' })
);

// ─── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`✅ CareerAssist Backend running on http://localhost:${PORT}`)
);

module.exports = app; // needed for Vercel serverless export
