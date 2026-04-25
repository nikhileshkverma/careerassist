const mongoose = require('mongoose');

const jobRoleSchema = new mongoose.Schema({
  roleName: { type: String, required: true }, category: String, icon: { type: String, default: '💼' },
  description: String, avgSalary: String, growth: { type: String, default: 'High' },
  requiredSkills: [{ skill: String, weight: Number }],
  relatedInterests: [String], educationMatch: [String], keyResources: [String],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const recommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roleId: mongoose.Schema.Types.ObjectId,
  careerTitle: String, category: String, icon: String,
  matchPercentage: Number, confidenceScore: Number,
  missingSkills: [String], presentSkills: [String],
  recommendationText: String, growth: String, avgSalary: String, keyResources: [String],
  learningRoadmap: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user', 'assistant'] },
  content: String,
  context: String, // 'career' | 'resume' | 'general'
}, { timestamps: true });

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['bug', 'feature', 'improvement', 'general', 'success_story'] },
  description: String, rating: Number,
  status: { type: String, default: 'pending' },
  adminResponse: String,
  isPublished: { type: Boolean, default: false },   // for success stories
  publishedAt: Date,
  notificationSent: { type: Boolean, default: false }, // track if user was notified
}, { timestamps: true });

const userNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: String,
  type: { type: String, enum: ['bug_fixed', 'feature_planned', 'story_published', 'general'], default: 'general' },
  isRead: { type: Boolean, default: false },
  relatedId: mongoose.Schema.Types.ObjectId, // feedbackId or other
}, { timestamps: true });

const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String, details: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = {
  JobRole: mongoose.model('JobRole', jobRoleSchema),
  Recommendation: mongoose.model('Recommendation', recommendationSchema),
  ChatHistory: mongoose.model('ChatHistory', chatHistorySchema),
  Feedback: mongoose.model('Feedback', feedbackSchema),
  UserNotification: mongoose.model('UserNotification', userNotificationSchema),
  ActivityLog: mongoose.model('ActivityLog', activityLogSchema),
};
