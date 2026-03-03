const mongoose = require('mongoose');

// ─── User ──────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name:     { type: String, required: true, trim: true },
    role:     { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

// ─── Profile ───────────────────────────────────────────────────────────────────
const profileSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    education:   { type: String, default: '' },
    skills:      { type: [String], default: [] },
    experience:  { type: String, default: '' },
    interests:   { type: [String], default: [] },
    career_goals:{ type: String, default: '' },
  },
  { timestamps: true }
);

// ─── Career Recommendation ─────────────────────────────────────────────────────
const recommendationSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    career_title:  { type: String, required: true },
    match_score:   { type: Number, default: 0 },
    reasoning:     { type: String, default: '' },
    skill_gaps:    { type: [String], default: [] },
    category:      { type: String, default: '' },
    description:   { type: String, default: '' },
    avg_salary:    { type: String, default: '' },
    growth:        { type: String, default: '' },
    matched_skills:{ type: [String], default: [] },
  },
  { timestamps: true }
);

// ─── Resume Feedback ───────────────────────────────────────────────────────────
const resumeSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    feedback: { type: mongoose.Schema.Types.Mixed, default: {} },
    score:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── Activity Log ──────────────────────────────────────────────────────────────
const activitySchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action:  { type: String, required: true },
    details: { type: String, default: '' },
  },
  { timestamps: true }
);

const User           = mongoose.model('User',           userSchema);
const Profile        = mongoose.model('Profile',        profileSchema);
const Recommendation = mongoose.model('Recommendation', recommendationSchema);
const ResumeFeedback = mongoose.model('ResumeFeedback', resumeSchema);
const ActivityLog    = mongoose.model('ActivityLog',    activitySchema);

module.exports = { User, Profile, Recommendation, ResumeFeedback, ActivityLog };
