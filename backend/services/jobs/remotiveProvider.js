/**
 * RemotiveProvider — fetches remote jobs from remotive.com (free, no key required).
 * API docs: https://remotive.com/api/remote-jobs
 *
 * This implements the JobProvider interface:
 *   fetchJobs(options) => Promise<NormalizedJob[]>
 *   name: string
 */

const axios = require('axios');
const { buildNormalizedJob } = require('./normalizedJobSchema');

const REMOTIVE_URL = process.env.REMOTIVE_API_URL || 'https://remotive.com/api/remote-jobs';

// Map Remotive categories to our internal categories
const CATEGORY_MAP = {
  'software-dev':        'Software Development',
  'customer-support':    'Customer Support',
  'design':              'Design',
  'devops-sysadmin':     'DevOps / Infrastructure',
  'finance-legal':       'Finance',
  'human-resources':     'Human Resources',
  'marketing':           'Marketing',
  'product':             'Product Management',
  'project-management':  'Project Management',
  'qa':                  'Quality Assurance',
  'sales-business':      'Sales',
  'data':                'Data / Analytics',
  'writing':             'Technical Writing',
  'all-others':          'Other',
};

// Strip HTML tags from description
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{3,}/g, '  ')
    .trim()
    .slice(0, 3000); // cap at 3000 chars
}

// Extract tech tags from title + description
const COMMON_TECH = [
  'python','javascript','typescript','java','golang','go','ruby','rust','swift','kotlin','c#','c++','scala',
  'react','vue','angular','next.js','node.js','express','django','fastapi','flask','spring',
  'aws','azure','gcp','docker','kubernetes','terraform','linux','git','ci/cd','devops',
  'sql','postgresql','mysql','mongodb','redis','elasticsearch',
  'machine learning','deep learning','tensorflow','pytorch','nlp','llm','ai',
  'figma','tableau','power bi','excel','jira','agile','scrum',
];

function extractTags(title, description) {
  const combined = `${title} ${description}`.toLowerCase();
  return COMMON_TECH.filter(t => combined.includes(t))
    .map(t => t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
    .slice(0, 12);
}

// Infer location type from job data
function inferLocationType(job) {
  const txt = `${job.candidate_required_location || ''} ${job.job_type || ''}`.toLowerCase();
  if (txt.includes('hybrid')) return 'Hybrid';
  if (txt.includes('onsite') || txt.includes('on-site') || txt.includes('in office')) return 'Onsite';
  return 'Remote'; // Remotive is remote-first
}

// Normalize a single Remotive job
function normalizeJob(raw) {
  const plain = stripHtml(raw.description || '');
  const tags = extractTags(raw.title || '', plain);
  const category = CATEGORY_MAP[raw.category] || raw.category || 'Software Development';
  const locationType = inferLocationType(raw);

  // Check H1B mention
  const h1b = /h-?1b|visa sponsor|work authorization|sponsorship/i.test(plain);

  return buildNormalizedJob({
    id:             `remotive_${raw.id}`,
    source:         'Remotive',
    sourceUrl:      raw.url || '',
    applyUrl:       raw.url || '',
    title:          raw.title || '',
    company:        raw.company_name || '',
    companyLogo:    raw.company_logo || '',
    location:       raw.candidate_required_location || 'Worldwide',
    locationType,
    jobType:        raw.job_type || 'Full-time',
    category,
    salary:         raw.salary || '',
    description:    plain,
    tags,
    publicationDate: raw.publication_date || new Date().toISOString(),
    h1bSponsor:     h1b,
    applicants:     0,
  });
}

const RemotiveProvider = {
  name: 'Remotive',

  /**
   * Fetch jobs from Remotive API.
   * @param {Object} options
   * @param {string} [options.category] - Remotive category slug (e.g. "software-dev")
   * @param {string} [options.search]   - Free text search term
   * @param {number} [options.limit]    - Max results (default 100)
   * @returns {Promise<NormalizedJob[]>}
   */
  async fetchJobs({ category, search, limit = 100 } = {}) {
    try {
      const params = {};
      if (category) params.category = category;
      if (search) params.search = search;
      if (limit) params.limit = limit;

      const response = await axios.get(REMOTIVE_URL, {
        params,
        timeout: 15000,
        headers: { 'Accept': 'application/json', 'User-Agent': 'CareerAssist/10.0' },
      });

      const jobs = response.data?.jobs || [];
      return jobs.map(normalizeJob);
    } catch (err) {
      console.error(`[RemotiveProvider] Fetch failed: ${err.message}`);
      return []; // graceful degradation — caller falls back to seeds
    }
  },

  /**
   * Fetch across multiple categories to get a broad set of jobs.
   * Useful when no user profile is available.
   */
  async fetchBroadJobs(totalLimit = 150) {
    const categories = ['software-dev', 'data', 'devops-sysadmin', 'design', 'product'];
    const perCat = Math.ceil(totalLimit / categories.length);
    const results = await Promise.allSettled(
      categories.map(cat => this.fetchJobs({ category: cat, limit: perCat }))
    );
    const all = [];
    results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });
    // Deduplicate by id
    const seen = new Set();
    return all.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
  },
};

module.exports = RemotiveProvider;
