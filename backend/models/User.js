const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const resumeSchema = new mongoose.Schema({
  name: { type: String, default: 'My Resume' },
  isPrimary: { type: Boolean, default: false },
  fileName: String,
  uploadDate: { type: Date, default: Date.now },
  lastModified: { type: Date, default: Date.now },
  atsScore: { type: Number, default: 0 },
  targetCareer: String,
  targetJD: String,
  // Structured resume data (can differ per resume)
  summary: String,
  skills: [String],
  experience: [mongoose.Schema.Types.Mixed],
  education: [mongoose.Schema.Types.Mixed],
  projects: [mongoose.Schema.Types.Mixed],
  certifications: [String],
  publications: [String],
  // Original raw text (preserved for display, not modified by tailoring)
  rawText: String,
  // AI tailoring history
  tailoringHistory: [{ date: Date, jobTitle: String, atsScoreBefore: Number, atsScoreAfter: Number, changesApplied: [String] }],
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  // Base profile
  phone: String, location: String, linkedIn: String, github: String, portfolio: String,
  skills: [String], interests: [String], certifications: [String], publications: [String],
  education: [mongoose.Schema.Types.Mixed],
  experience: [mongoose.Schema.Types.Mixed],
  projects: [mongoose.Schema.Types.Mixed],
  summary: String, careerGoals: String,
  // Multiple resumes
  resumes: [resumeSchema],
  // Job tracking
  savedJobs: [{ jobId: String, title: String, company: String, url: String, savedAt: Date }],
  appliedJobs: [{ jobId: String, title: String, company: String, appliedAt: Date, status: String }],
  pendingApply: [String],
  dismissedJobs: [String],
}, { timestamps: true });

userSchema.methods.comparePassword = async function(p) { return bcrypt.compare(p, this.passwordHash); };
userSchema.methods.toSafeObject = function() { const o=this.toObject(); delete o.passwordHash; return o; };
module.exports = mongoose.model('User', userSchema);
