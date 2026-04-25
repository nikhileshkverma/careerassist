/**
 * Normalized job schema — all providers map their data to this shape.
 * This is the single source of truth for how a job looks inside CareerAssist.
 */

/**
 * @typedef {Object} NormalizedJob
 * @property {string}   id               - Unique ID: "<source>_<original_id>"
 * @property {string}   source           - "remotive" | "seed" | "usajobs" | etc.
 * @property {string}   sourceUrl        - Direct link to the job posting
 * @property {string}   applyUrl         - URL to apply (may equal sourceUrl)
 * @property {string}   title            - Job title
 * @property {string}   company          - Company name
 * @property {string}   companyLogo      - Logo URL (may be empty string)
 * @property {string}   location         - Location string
 * @property {string}   locationType     - "Remote" | "Onsite" | "Hybrid"
 * @property {string}   jobType          - "Full-time" | "Part-time" | "Contract" | "Internship"
 * @property {string}   category         - Broad job category
 * @property {string}   salary           - Salary range string (may be empty)
 * @property {string}   description      - Full job description (may be HTML)
 * @property {string[]} tags             - Skill/tool tags extracted from the listing
 * @property {string}   publicationDate  - ISO date string
 * @property {number}   postedHoursAgo   - Computed hours since publication
 * @property {boolean}  h1bSponsor       - Whether sponsorship is mentioned
 * @property {boolean}  earlyApplicant   - True if posted < 48h ago
 * @property {number}   applicants       - Applicant count if available, else 0
 *
 * Fields added by the scoring engine (not from the provider):
 * @property {number}   matchScore       - 0–100
 * @property {string}   matchLabel       - "Strong Match" | "Good Match" | "Fair Match" | "Low Match"
 * @property {string[]} matchingSkills
 * @property {string[]} missingSkills
 * @property {number}   skillScore       - 0–100 component
 * @property {number}   expScore         - 0–100 component
 * @property {number}   industryScore    - 0–100 component
 * @property {string}   matchExplanation - Human-readable explanation
 */

/**
 * Build a safe normalized job with defaults for any missing fields.
 */
function buildNormalizedJob(partial) {
  const pub = partial.publicationDate ? new Date(partial.publicationDate) : new Date();
  const hoursAgo = Math.max(0, Math.round((Date.now() - pub.getTime()) / 3600000));

  return {
    id:              partial.id              || `unknown_${Date.now()}`,
    source:          partial.source          || 'unknown',
    sourceUrl:       partial.sourceUrl       || '',
    applyUrl:        partial.applyUrl        || partial.sourceUrl || '',
    careerPageUrl:   partial.careerPageUrl   || '',
    title:           partial.title           || 'Untitled',
    company:         partial.company         || 'Unknown Company',
    companyLogo:     partial.companyLogo     || '',
    location:        partial.location        || 'Remote',
    locationType:    partial.locationType    || 'Remote',
    jobType:         partial.jobType         || 'Full-time',
    category:        partial.category        || 'Software Development',
    salary:          partial.salary          || '',
    description:     partial.description     || '',
    tags:            Array.isArray(partial.tags) ? partial.tags : [],
    publicationDate: pub.toISOString(),
    postedHoursAgo:  hoursAgo,
    h1bSponsor:      partial.h1bSponsor      ?? false,
    earlyApplicant:  hoursAgo < 48,
    applicants:      partial.applicants      || 0,
    // scoring fields default to 0 — filled by matchingEngine
    matchScore:      0,
    matchLabel:      'Unscored',
    matchingSkills:  [],
    missingSkills:   [],
    skillScore:      0,
    expScore:        0,
    industryScore:   0,
    matchExplanation: '',
  };
}

module.exports = { buildNormalizedJob };
