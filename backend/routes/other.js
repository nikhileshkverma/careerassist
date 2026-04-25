const express = require('express');
const User = require('../models/User');
const { Recommendation, ChatHistory, Feedback, ActivityLog, UserNotification } = require('../models/index');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getStatus, isReady } = require('../utils/ollama_setup');
const { JobRole } = require('../models/index');

// ── FEEDBACK ──────────────────────────────────────────────────────────────────
const feedbackRouter = express.Router();
feedbackRouter.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { type, description, rating } = req.body;
    if (!type || !description) return res.status(400).json({ error: 'Type and description required.' });
    await Feedback.create({ userId: req.user._id, type, description, rating });
    res.status(201).json({ message: 'Submitted! Thank you.' });
  } catch (err) { next(err); }
});
feedbackRouter.get('/my', authenticateToken, async (req, res, next) => {
  try { res.json(await Feedback.find({ userId: req.user._id }).sort({ createdAt: -1 })); }
  catch (err) { next(err); }
});
feedbackRouter.get('/admin/all', authenticateToken, requireAdmin, async (req, res, next) => {
  try { res.json(await Feedback.find().populate('userId', 'name email').sort({ createdAt: -1 })); }
  catch (err) { next(err); }
});
feedbackRouter.patch('/admin/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { status, adminResponse } = req.body;
    const item = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status, adminResponse, notificationSent: true },
      { new: true }
    );
    // Send in-app notification to the user
    if (item && item.userId) {
      let msg = '';
      let type = 'general';
      if (status === 'fixed') {
        msg = `✅ Your bug report has been fixed! ${adminResponse ? 'Admin note: ' + adminResponse : ''}`;
        type = 'bug_fixed';
      } else if (status === 'planned') {
        msg = `🗓️ Your feature request has been noted and is being planned! ${adminResponse || ''}`;
        type = 'feature_planned';
      } else if (status === 'accepted') {
        msg = `✅ Your feedback was accepted! ${adminResponse || ''}`;
      } else if (status === 'rejected') {
        msg = `Your feedback was reviewed. ${adminResponse || 'Thank you for your input.'}`;
      }
      if (msg) {
        await UserNotification.create({ userId: item.userId, message: msg, type, relatedId: item._id });
      }
    }
    res.json({ message: 'Updated and user notified.' });
  } catch (err) { next(err); }
});
feedbackRouter.get('/admin/stats', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const [total, pending] = await Promise.all([Feedback.countDocuments(), Feedback.countDocuments({ status: 'pending' })]);
    res.json({ total, pending });
  } catch (err) { next(err); }
});

// Publish/unpublish a success story
feedbackRouter.patch('/admin/:id/publish', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { publish } = req.body; // true or false
    const item = await Feedback.findByIdAndUpdate(
      req.params.id,
      { isPublished: publish, publishedAt: publish ? new Date() : null },
      { new: true }
    );
    if (item && publish && item.userId) {
      await UserNotification.create({
        userId: item.userId,
        message: '🎉 Your success story has been published to the CareerAssist community!',
        type: 'story_published',
        relatedId: item._id,
      });
    }
    res.json({ message: publish ? 'Story published!' : 'Story unpublished.', isPublished: item?.isPublished });
  } catch (err) { next(err); }
});

// Get published success stories (public - for dashboard/homepage)
feedbackRouter.get('/published-stories', async (req, res, next) => {
  try {
    const stories = await Feedback.find({ type: 'success_story', isPublished: true })
      .populate('userId', 'name')
      .sort({ publishedAt: -1 })
      .limit(10);
    res.json(stories);
  } catch (err) { next(err); }
});

// ── ADMIN (simplified — just what admin actually needs) ───────────────────────
const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireAdmin);

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const now = new Date();
    const last7 = new Date(now - 7*24*60*60*1000);
    const last30 = new Date(now - 30*24*60*60*1000);
    const [totalUsers, activeProfiles, totalRecs, totalFeedback, pendingFeedback, newUsersWeek, totalApplied, totalResumeActions, jobsViewed, successStories] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', skills: { $ne: [] } }),
      Recommendation.countDocuments(),
      Feedback.countDocuments(),
      Feedback.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'student', createdAt: { $gte: last7 } }),
      ActivityLog.countDocuments({ action: 'JOB_APPLY' }),
      ActivityLog.countDocuments({ action: { $in: ['RESUME_UPLOAD','RESUME_TAILOR','RESUME_PARSE'] } }),
      ActivityLog.countDocuments({ action: 'JOBS_VIEW' }),
      Feedback.countDocuments({ type: 'success_story' }),
    ]);
    const dailySignups = await ActivityLog.aggregate([
      { $match: { action: 'REGISTER', createdAt: { $gte: new Date(now - 14*24*60*60*1000) } } },
      { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const jobApplyBreakdown = await ActivityLog.aggregate([
      { $match: { action: 'JOB_APPLY' } },
      { $group: { _id: '$details.company', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 6 },
    ]);
    const recentActivity = await ActivityLog.find().sort({ createdAt: -1 }).limit(20).populate('userId', 'name email');
    const successStoriesData = await Feedback.find({ type: 'success_story' }).populate('userId', 'name').sort({ createdAt: -1 }).limit(10);
    const platformHealthScore = Math.min(100, Math.round(
      (Math.min(totalUsers / 10, 1) * 20) + (Math.min(totalApplied / 5, 1) * 25) +
      (activeProfiles > 0 ? Math.min(activeProfiles / Math.max(totalUsers, 1), 1) * 20 : 0) +
      (successStories * 5) + (isReady() ? 20 : 10)
    ));
    res.json({ overview: { totalUsers, activeProfiles, totalRecs, totalFeedback, pendingFeedback, newUsersWeek, totalApplied, totalResumeActions, jobsViewed, successStories, platformHealthScore, aiReady: isReady() }, charts: { dailySignups, jobApplyBreakdown }, recentActivity, successStoriesData });
  } catch (err) { next(err); }
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    const enriched = await Promise.all(users.map(async u => {
      const [logins, jobApps, resumeActions] = await Promise.all([
        ActivityLog.countDocuments({ userId: u._id, action: 'LOGIN' }),
        ActivityLog.countDocuments({ userId: u._id, action: 'JOB_APPLY' }),
        ActivityLog.countDocuments({ userId: u._id, action: { $in: ['RESUME_UPLOAD','RESUME_TAILOR'] } }),
      ]);
      return { ...u.toObject(), stats: { logins, jobApps, resumeActions } };
    }));
    res.json(enriched);
  } catch (err) { next(err); }
});

adminRouter.delete('/users/:id', async (req, res, next) => {
  try {
    await Promise.all([User.findByIdAndDelete(req.params.id), Recommendation.deleteMany({ userId: req.params.id }), ChatHistory.deleteMany({ userId: req.params.id }), Feedback.deleteMany({ userId: req.params.id }), ActivityLog.deleteMany({ userId: req.params.id })]);
    res.json({ message: 'User deleted.' });
  } catch (err) { next(err); }
});

adminRouter.get('/roles', async (req, res, next) => {
  try { res.json(await JobRole.find().sort({ roleName: 1 })); } catch (err) { next(err); }
});
adminRouter.post('/roles', async (req, res, next) => {
  try { res.status(201).json(await JobRole.create(req.body)); } catch (err) { next(err); }
});
adminRouter.delete('/roles/:id', async (req, res, next) => {
  try { await JobRole.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted.' }); } catch (err) { next(err); }
});
adminRouter.get('/activity', async (req, res, next) => {
  try { res.json(await ActivityLog.find().sort({ createdAt: -1 }).limit(100).populate('userId', 'name email')); }
  catch (err) { next(err); }
});

// ── SUCCESS STORIES ───────────────────────────────────────────────────────────
const successRouter = express.Router();
successRouter.post('/report', authenticateToken, async (req, res, next) => {
  try {
    const { company, role, message } = req.body;
    await Feedback.create({ userId: req.user._id, type: 'success_story', description: `🎉 Got a job! Role: ${role} at ${company}. ${message || ''}`, status: 'accepted' });
    await ActivityLog.create({ userId: req.user._id, action: 'JOB_SUCCESS', details: { company, role } });
    res.json({ message: 'Congratulations! Your success story has been recorded.' });
  } catch (err) { next(err); }
});

// ── USER NOTIFICATIONS ─────────────────────────────────────────────────────
const notifRouter = require('express').Router();

// Get my notifications
notifRouter.get('/', authenticateToken, async (req, res, next) => {
  try {
    const notifs = await UserNotification.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).limit(20);
    res.json(notifs);
  } catch (err) { next(err); }
});

// Mark all as read
notifRouter.patch('/read-all', authenticateToken, async (req, res, next) => {
  try {
    await UserNotification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All marked as read.' });
  } catch (err) { next(err); }
});

// Mark one as read
notifRouter.patch('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    await UserNotification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Unread count
notifRouter.get('/unread-count', authenticateToken, async (req, res, next) => {
  try {
    const count = await UserNotification.countDocuments({ userId: req.user._id, isRead: false });
    res.json({ count });
  } catch (err) { next(err); }
});

module.exports = { feedbackRouter, adminRouter, successRouter, notifRouter };
