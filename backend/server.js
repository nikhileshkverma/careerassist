require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');
const connectDB     = require('./database');
const errorHandler  = require('./middleware/errorHandler');
const { setupOllama } = require('./utils/ollama_setup');

const app  = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: ['http://localhost:3000','http://localhost:3001'], credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/career',  require('./routes/career'));
app.use('/api/resume',  require('./routes/resume'));
app.use('/api/jobs',    require('./routes/jobs'));
app.use('/api/events',  require('./routes/events'));

const { feedbackRouter, adminRouter, successRouter, notifRouter } = require('./routes/other');
app.use('/api/feedback',       feedbackRouter);
app.use('/api/admin',          adminRouter);
app.use('/api/success',        successRouter);
app.use('/api/notifications',  notifRouter);

app.get('/api/health', (req, res) => {
  const { getStatus, isReady } = require('./utils/ollama_setup');
  res.json({ status: 'CareerAssist v10.0', port: PORT, ai: { ...getStatus(), ready: isReady(), model: process.env.OLLAMA_MODEL || 'qwen2.5:14b' }, timestamp: new Date().toISOString() });
});

app.use(errorHandler);

connectDB().then(async () => {
  app.listen(PORT, () => {
    console.log(`\n🚀 CareerAssist v10.0 Backend`);
    console.log(`   ➜  http://localhost:${PORT}/api/health`);
    console.log(`   ➜  AI Model: ${process.env.OLLAMA_MODEL || 'qwen2.5:14b'} via Ollama`);
  });

  // Wire AI setup
  setupOllama().catch(e => console.error('Ollama setup error:', e.message));

  // Trigger live job scrape on startup so jobs are ready immediately
  setTimeout(async () => {
    try {
      const JobIngestionService = require('./services/jobs/jobIngestionService');
      const result = await JobIngestionService.refreshCache({ force: false });
      if (result.refreshed) console.log(`   ✅ Jobs: ${result.count} live jobs cached from Greenhouse + Lever`);
      else if (result.skipped) console.log(`   ✅ Jobs: Cache is fresh (${result.message})`);
    } catch (e) { console.log('   ⚠️  Job cache refresh failed:', e.message); }
  }, 2000); // 2s delay to let DB connect first

  // Kick off initial job cache fill (non-blocking, runs in background)
  const JobIngestionService = require('./services/jobs/jobIngestionService');
  JobIngestionService.refreshCache()
    .then(r => {
      const fetched = (r.refreshed || []).reduce((s, x) => s + (x.count || 0), 0);
      if (fetched > 0) console.log(`   ➜  Job cache: ${fetched} live jobs loaded from Remotive`);
      else console.log('   ➜  Job cache: using seed jobs (Remotive fetch pending or unavailable)');
    })
    .catch(() => console.log('   ➜  Job cache: seed jobs active, live fetch will retry on next refresh'));
});
