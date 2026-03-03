const express = require('express');
const router  = express.Router();
const { User, Profile, Recommendation, ResumeFeedback, ActivityLog } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authenticateToken, requireAdmin);

// ─── Get all users ─────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching users.' });
  }
});

// ─── Platform stats ────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalProfiles, totalRecommendations, totalResumes, recentActivity] =
      await Promise.all([
        User.countDocuments({ role: 'user' }),
        Profile.countDocuments(),
        Recommendation.countDocuments(),
        ResumeFeedback.countDocuments(),
        ActivityLog.find()
          .sort({ createdAt: -1 })
          .limit(20)
          .populate('userId', 'name email'),
      ]);

    res.json({ totalUsers, totalProfiles, totalRecommendations, totalResumes, recentActivity });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching stats.' });
  }
});

// ─── Full activity log ─────────────────────────────────────────────────────────
router.get('/activity', async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('userId', 'name email');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching activity.' });
  }
});

// ─── Delete a user (cascade) ───────────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await Promise.all([
      Profile.deleteMany({ userId: id }),
      Recommendation.deleteMany({ userId: id }),
      ResumeFeedback.deleteMany({ userId: id }),
      ActivityLog.deleteMany({ userId: id }),
      User.findByIdAndDelete(id),
    ]);
    res.json({ message: 'User and all related data deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting user.' });
  }
});

module.exports = router;
