/**
 * jobIngestionService.js — manages live job cache from Greenhouse + Lever
 */
const { fetchAllLiveJobs } = require('./liveJobProvider');
const CachedJob = require('../../models/CachedJob');

const CACHE_TTL_MS = (parseInt(process.env.JOB_CACHE_TTL_MINUTES) || 60) * 60 * 1000;

const JobIngestionService = {

  async refreshCache({ force = false } = {}) {
    const newest = await CachedJob.findOne().sort({ fetchedAt: -1 });
    const age = newest ? Date.now() - newest.fetchedAt.getTime() : Infinity;

    if (!force && age < CACHE_TTL_MS) {
      return { skipped: true, message: `Cache is ${Math.round(age/60000)} min old` };
    }

    console.log('[JobIngestionService] Fetching live jobs from Greenhouse + Lever...');
    try {
      const jobs = await fetchAllLiveJobs();
      console.log(`[JobIngestionService] Fetched ${jobs.length} live jobs`);

      if (jobs.length > 0) {
        await Promise.all(
          jobs.map(job =>
            CachedJob.findOneAndUpdate(
              { jobId: job.id },
              { ...job, jobId: job.id, fetchedAt: new Date() },
              { upsert: true, new: true }
            )
          )
        );
      }
      return { refreshed: true, count: jobs.length };
    } catch (err) {
      console.error('[JobIngestionService] Error:', err.message);
      return { error: err.message };
    }
  },

  async getCachedJobs({ search, category, jobType, locationType, limit = 200, skip = 0 } = {}) {
    const query = {};
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: re }, { company: re }, { tags: re }, { description: re }];
    }
    if (category)     query.category     = new RegExp(category, 'i');
    if (jobType)      query.jobType       = new RegExp(jobType, 'i');
    if (locationType) query.locationType  = locationType;

    const total = await CachedJob.countDocuments(query);
    const jobs  = await CachedJob.find(query)
      .sort({ postedHoursAgo: 1, fetchedAt: -1 })  // newest first
      .skip(skip).limit(limit).lean();

    return {
      jobs: jobs.map(doc => {
        const { _id, __v, fetchedAt, jobId, ...rest } = doc;
        return { ...rest, id: jobId || doc.id };
      }),
      total,
    };
  },

  async cacheAgeMinutes() {
    const newest = await CachedJob.findOne().sort({ fetchedAt: -1 }).lean();
    if (!newest) return Infinity;
    return Math.round((Date.now() - new Date(newest.fetchedAt).getTime()) / 60000);
  },

  async totalCached() {
    return CachedJob.countDocuments();
  },
};

module.exports = JobIngestionService;
