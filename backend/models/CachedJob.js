const mongoose = require('mongoose');

/**
 * CachedJob — stores normalized jobs fetched from external providers.
 * TTL index on fetchedAt auto-expires documents after 24 hours.
 */
const cachedJobSchema = new mongoose.Schema({
  jobId:           { type: String, required: true, unique: true, index: true },
  source:          { type: String, required: true, index: true },
  sourceUrl:       String,
  applyUrl:        String,
  careerPageUrl:   String,
  title:           { type: String, index: true },
  company:         { type: String, index: true },
  companyLogo:     String,
  location:        String,
  locationType:    { type: String, enum: ['Remote','Onsite','Hybrid'], default: 'Remote' },
  jobType:         String,
  category:        { type: String, index: true },
  salary:          String,
  description:     String,
  tags:            [String],
  publicationDate: String,
  postedHoursAgo:  Number,
  h1bSponsor:      { type: Boolean, default: false },
  earlyApplicant:  { type: Boolean, default: false },
  applicants:      { type: Number, default: 0 },
  fetchedAt:       { type: Date, default: Date.now, index: true },
}, { timestamps: false });

// Auto-delete after 24 hours (86400 seconds)
cachedJobSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 86400 });

// Text index for full-text search
cachedJobSchema.index({ title: 'text', company: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('CachedJob', cachedJobSchema);
