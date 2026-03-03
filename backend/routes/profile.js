const express = require('express');
const router  = express.Router();
const { Profile, ActivityLog } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// ─── Get Profile ───────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user.id });
    res.json(profile || null);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

// ─── Create / Update Profile ───────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { education, skills, experience, interests, career_goals } = req.body;

    // Accept both comma-string and array formats from frontend
    const skillsArr    = Array.isArray(skills)
      ? skills
      : skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    const interestsArr = Array.isArray(interests)
      ? interests
      : interests ? interests.split(',').map(s => s.trim()).filter(Boolean) : [];

    await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { education, skills: skillsArr, experience, interests: interestsArr, career_goals },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await ActivityLog.create({ userId: req.user.id, action: 'PROFILE_UPDATE' });
    res.json({ message: 'Profile saved successfully.' });
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(500).json({ error: 'Server error saving profile.' });
  }
});

module.exports = router;
