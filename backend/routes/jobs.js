const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { Recommendation, ActivityLog } = require('../models/index');
const { authenticateToken } = require('../middleware/auth');
const JobIngestionService = require('../services/jobs/jobIngestionService');
const { rankJobs, rankJobsAI, THRESHOLD } = require('../services/jobs/matchingEngine');
const { buildNormalizedJob } = require('../services/jobs/normalizedJobSchema');

// ────────────────────────────────────────────────────────────────────────────
// No static seed jobs — all jobs are live from Greenhouse/Lever ATS
const NORMALIZED_SEEDS = [];

// ── GET /recommended ──────────────────────────────────────────────────────────
router.get('/recommended', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const recs  = await Recommendation.find({ userId: req.user._id }).sort({ matchPercentage: -1 }).limit(3);

    const appliedIds   = new Set((user.appliedJobs  || []).map(j => j.jobId));

    // Auto-expire dismissals if too many (> 20 keep last 10)
    const dismissed = user.dismissedJobs || [];
    if (dismissed.length > 20) {
      await User.findByIdAndUpdate(user._id, { $set: { dismissedJobs: dismissed.slice(-10) } });
      user.dismissedJobs = dismissed.slice(-10);
    }
    const dismissedIds = new Set(user.dismissedJobs || []);

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const { search, category, jobType, locationType, threshold } = req.query;
    const matchThreshold = parseInt(threshold) || THRESHOLD;

    // Get live jobs from cache
    const { jobs: liveJobs, total: totalLive } = await JobIngestionService.getCachedJobs({
      search, category, jobType, locationType, limit: 500,
    });

    // If cache is empty, trigger a background refresh and return empty
    if (liveJobs.length === 0) {
      JobIngestionService.refreshCache({ force: true }).catch(() => {});
    }

    // Cap each company at 5 jobs to prevent any single company dominating
    const companyCounts = {};
    const allJobs = liveJobs.filter(j => {
      const co = (j.company || '').toLowerCase();
      companyCounts[co] = (companyCounts[co] || 0) + 1;
      return companyCounts[co] <= 5;
    });

    // Filter out dismissed + applied
    const eligible = allJobs.filter(j => {
      const id = j.jobId || j.id;
      return !appliedIds.has(id) && !dismissedIds.has(id);
    });

    const profile = {
      skills:      user.skills || [],
      interests:   user.interests || [],
      experience:  user.experience || [],
      careerGoals: user.careerGoals || '',
    };
    const { above, below } = await rankJobsAI(eligible, profile, recs, matchThreshold);
    const ranked    = [...above, ...below];
    const paginated = ranked.slice(skip, skip + limit);

    await ActivityLog.create({ userId: user._id, action: 'JOBS_VIEW' });

    res.json({
      jobs: paginated,
      pagination: {
        page, limit, total: ranked.length,
        totalPages: Math.ceil(ranked.length / limit),
        hasMore: skip + limit < ranked.length,
      },
      meta: {
        totalLiveJobs: totalLive + NORMALIZED_SEEDS.length,
        totalSeeds: NORMALIZED_SEEDS.length,
        cacheAgeMinutes: await JobIngestionService.cacheAgeMinutes(),
        matchThreshold, aboveThreshold: above.length, belowThreshold: below.length,
        hasProfile: (user.skills || []).length > 0,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /saved ────────────────────────────────────────────────────────────────
router.get('/saved', authenticateToken, async (req, res, next) => {
  try { const user = await User.findById(req.user._id); res.json(user.savedJobs || []); }
  catch (err) { next(err); }
});

// ── GET /applied ──────────────────────────────────────────────────────────────
router.get('/applied', authenticateToken, async (req, res, next) => {
  try { const user = await User.findById(req.user._id); res.json(user.appliedJobs || []); }
  catch (err) { next(err); }
});

// ── POST /:id/save ────────────────────────────────────────────────────────────
router.post('/:jobId/save', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { title='', company='' } = req.body;
    user.savedJobs = user.savedJobs || [];
    if (user.savedJobs.find(j => j.jobId === req.params.jobId)) {
      user.savedJobs = user.savedJobs.filter(j => j.jobId !== req.params.jobId);
      await user.save(); return res.json({ saved: false });
    }
    user.savedJobs.push({ jobId: req.params.jobId, title, company, savedAt: new Date() });
    await user.save(); res.json({ saved: true });
  } catch (err) { next(err); }
});

router.delete('/:jobId/save', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.savedJobs = (user.savedJobs||[]).filter(j => j.jobId !== req.params.jobId);
    await user.save(); res.json({ saved: false });
  } catch (err) { next(err); }
});

// ── POST /:id/apply ───────────────────────────────────────────────────────────
router.post('/:jobId/apply', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { applyUrl, title='', company='' } = req.body;
    user.pendingApply = user.pendingApply || [];
    if (!user.pendingApply.includes(req.params.jobId)) user.pendingApply.push(req.params.jobId);
    await user.save();
    await ActivityLog.create({ userId: user._id, action:'JOB_APPLY_START', details:{ jobId:req.params.jobId, title, company } });
    res.json({ applyUrl: applyUrl||'', title, company });
  } catch (err) { next(err); }
});

// ── POST /:id/confirm-apply ───────────────────────────────────────────────────
router.post('/:jobId/confirm-apply', authenticateToken, async (req, res, next) => {
  try {
    const { didApply, title='', company='' } = req.body;
    const user = await User.findById(req.user._id);
    user.pendingApply = (user.pendingApply||[]).filter(id => id !== req.params.jobId);
    if (didApply) {
      user.appliedJobs = user.appliedJobs || [];
      if (!user.appliedJobs.find(j => j.jobId === req.params.jobId)) {
        user.appliedJobs.push({ jobId:req.params.jobId, title, company, appliedAt:new Date(), status:'applied' });
      }
      await ActivityLog.create({ userId:user._id, action:'JOB_APPLY', details:{ jobId:req.params.jobId, title, company } });
    }
    await user.save(); res.json({ confirmed:true, didApply });
  } catch (err) { next(err); }
});

// ── POST /:id/dismiss ─────────────────────────────────────────────────────────
router.post('/:jobId/dismiss', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.dismissedJobs = user.dismissedJobs || [];
    if (!user.dismissedJobs.includes(req.params.jobId)) user.dismissedJobs.push(req.params.jobId);
    await user.save(); res.json({ dismissed: true });
  } catch (err) { next(err); }
});

// ── DELETE /dismissed — clear all dismissed ───────────────────────────────────
router.delete('/dismissed', authenticateToken, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { dismissedJobs:[] } });
    res.json({ cleared:true });
  } catch (err) { next(err); }
});

// ── POST /refresh ─────────────────────────────────────────────────────────────
router.post('/refresh', authenticateToken, async (req, res, next) => {
  try {
    const ageMin = await JobIngestionService.cacheAgeMinutes();
    if (ageMin < 15 && req.query.force !== 'true') {
      return res.json({ refreshed:false, message:`Cache refreshed ${ageMin} min ago.`, cacheAgeMinutes:ageMin });
    }
    const result = await JobIngestionService.refreshCache({ force:true });
    const total  = await JobIngestionService.totalCached();
    res.json({ refreshed:true, ...result, totalCached:total });
  } catch (err) { next(err); }
});

// ── GET /meta ─────────────────────────────────────────────────────────────────
router.get('/meta', authenticateToken, async (req, res, next) => {
  try {
    res.json({
      totalCached: await JobIngestionService.totalCached(),
      cacheAgeMinutes: await JobIngestionService.cacheAgeMinutes(),
      matchThreshold: THRESHOLD,
      providers: ['Remotive (free, no key)', '20 curated LinkedIn/Indeed seed jobs'],
    });
  } catch (err) { next(err); }
});

// ── GET /live-search?company=X — live job search for any company ─────────────
router.get('/live-search', authenticateToken, async (req, res, next) => {
  try {
    const { company, query } = req.query;
    if (!company && !query) return res.status(400).json({ error: 'Provide company or query.' });

    const { fetchCompanyJobs, fetchAllLiveJobs } = require('../services/jobs/liveJobProvider');
    let jobs;
    
    if (company) {
      jobs = await fetchCompanyJobs(company.trim());
    } else {
      jobs = await fetchAllLiveJobs(query);
    }

    // Score against user profile
    const user = await User.findById(req.user._id);
    const recs  = await Recommendation.find({ userId: req.user._id }).sort({ matchPercentage: -1 }).limit(3);
    const profile = { skills: user.skills || [], interests: user.interests || [], experience: user.experience || [], careerGoals: user.careerGoals || '' };
    const { rankJobs } = require('../services/jobs/matchingEngine');
    const { above, below } = rankJobs(jobs, profile, recs, 0); // threshold 0 = show all
    const ranked = [...above, ...below];

    res.json({
      jobs: ranked.slice(0, 50),
      total: ranked.length,
      company: company || null,
      query: query || null,
      source: 'live',
    });
  } catch (err) { next(err); }
});

module.exports = router;
