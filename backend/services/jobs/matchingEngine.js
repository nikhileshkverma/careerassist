const { isReady, callOllamaDirectly } = require('../../utils/ollama_setup');

// AI-powered batch job scoring — uses Qwen2.5 when available
// Scores 10 jobs at once for efficiency
async function aiScoreJobs(jobs, profile) {
  if (!isReady() || jobs.length === 0) return null;
  try {
    const userSkills = (profile.skills || []).slice(0, 30).join(', ');
    const userExp    = (profile.experience || []).slice(0, 2)
      .map(e => `${e.title} at ${e.company}`).join('; ');
    const userGoals  = profile.careerGoals || '';

    const jobList = jobs.slice(0, 15).map((j, i) =>
      `${i}: ${j.title} at ${j.company} | Tags: ${(j.tags||[]).join(',')} | Cat: ${j.category}`
    ).join('\n');

    const prompt = `You are a career matching AI. Score how well this candidate matches each job (0-100).

CANDIDATE:
Skills: ${userSkills}
Experience: ${userExp}
Goals: ${userGoals}

JOBS:
${jobList}

Rules:
- Score 80-98 if the candidate's skills strongly match the job's core requirements
- Score 65-79 if there is a good partial match  
- Score 45-64 if skills are adjacent/related
- Score below 45 if there is little relevance
- Higher scores for roles matching the candidate's apparent career direction

Return ONLY a JSON array of numbers, one score per job, in order. Example: [85,72,60,45]
Return exactly ${Math.min(jobs.length, 15)} numbers.`;

    const text = await callOllamaDirectly(prompt, { temperature: 0.1, maxTokens: 200 });
    const match = text.match(/\[([\d,\s]+)\]/);
    if (!match) return null;
    const scores = match[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 100);
    return scores.length >= Math.min(jobs.length, 15) ? scores : null;
  } catch { return null; }
}

/**
 * matchingEngine.js — deterministic job matching with realistic scores.
 *
 * Root cause of 99% bug: user with 80 skills maxed every component.
 * Fix: score is based on PRECISION (matching skills / total required),
 * not recall (user skills matched). A broad skill set should NOT inflate scores
 * unless those skills are ACTUALLY required by the job.
 *
 * Scoring (sums to 100):
 *   40%  Skill precision  — required skills the user has / total required
 *   25%  Keyword depth    — JD keywords found in user's top skills (capped)
 *   20%  Role relevance   — title/category alignment with recs & goals
 *   15%  Experience depth — proxy from experience entries + skill match rate
 */

const { normAll, norm } = require('../../utils/scoring');

const THRESHOLD = parseInt(process.env.JOB_MATCH_THRESHOLD) || 70;

function scoreJob(job, profile, recs = []) {
  const userSkills    = normAll(profile.skills || []);
  const userInterests = (profile.interests || []).map(s => s.toLowerCase());

  if (userSkills.length === 0) {
    return {
      ...job,
      matchScore: 0, matchLabel: 'Add Skills',
      matchingSkills: [], missingSkills: (job.tags || []).slice(0, 6),
      skillScore: 0, expScore: 0, industryScore: 0,
      matchExplanation: 'Add skills to your profile to see your match score.',
      noProfile: true,
    };
  }

  const jobTags     = normAll(job.tags || []);
  const jobTitle    = (job.title || '').toLowerCase();
  const jobDesc     = (job.description || '').toLowerCase();
  const jobCategory = (job.category || '').toLowerCase();

  // ── 1. Skill PRECISION (40 pts) ───────────────────────────────────────────
  // Key fix: denominator is job's required tags, not user's total skills.
  // A user with 80 skills matching 5/8 required = 62.5%, not 100%.
  const matchedTags = jobTags.filter(jt =>
    userSkills.some(us => us === jt || (jt.length > 3 && us.includes(jt)) || (us.length > 3 && jt.includes(us)))
  );
  const missingTags = jobTags.filter(jt =>
    !userSkills.some(us => us === jt || (jt.length > 3 && us.includes(jt)) || (us.length > 3 && jt.includes(us)))
  ).slice(0, 8);

  const tagBase  = Math.max(jobTags.length, 4); // min denominator 4 so short tag lists don't inflate
  const precision = matchedTags.length / tagBase;         // 0.0 – 1.0
  const skillPts = Math.round(precision * 40);

  // ── 2. Keyword depth in JD (25 pts) ─────────────────────────────────────
  // Count user skills that appear in job description text (broader match).
  const jdKeywords = userSkills.filter(us => {
    if (us.length < 2) return false;
    if (jobDesc.includes(us)) return true;
    // Also check job tags text for partial matches
    return jobTags.some(jt => jt === us || (jt.length > 3 && (jt.includes(us) || us.includes(jt))));
  });
  // Use max(tags, 6) as base so jobs with few tags don't over-reward
  const relevantBase = Math.min(15, Math.max(jobTags.length, 6));
  const kwPts = Math.round(Math.min(1, jdKeywords.length / relevantBase) * 25);

  // ── 3. Role relevance (20 pts) ────────────────────────────────────────────
  const topRoles = recs.map(r => (r.careerTitle || '').toLowerCase());
  const goals    = (profile.careerGoals || '').toLowerCase();
  let rolePts = 0;

  // Title word match to recommended careers (max 12 pts)
  if (topRoles.length > 0) {
    const titleWords = jobTitle.split(/\s+/).filter(w => w.length > 3);
    const roleWordMatches = titleWords.filter(w =>
      topRoles.some(r => r.includes(w) || w.includes(r.split(' ')[0]))
    );
    rolePts += Math.min(12, roleWordMatches.length * 4);
  } else {
    // No recs yet: give partial credit if job category matches user's top skills domain
    const isAI = userSkills.some(s => ['python','tensorflow','pytorch','machine learning','llm','nlp'].includes(s));
    const isCloud = userSkills.some(s => ['aws','azure','gcp','kubernetes','docker','terraform'].includes(s));
    const isSDE = userSkills.some(s => ['javascript','react','node.js','java','sql'].includes(s));
    if (isAI && (jobCategory.includes('ai') || jobCategory.includes('data') || jobTitle.includes('ai') || jobTitle.includes('ml') || jobTitle.includes('machine'))) rolePts += 8;
    else if (isCloud && (jobCategory.includes('cloud') || jobCategory.includes('devops') || jobTitle.includes('cloud') || jobTitle.includes('devops'))) rolePts += 8;
    else if (isSDE && (jobCategory.includes('software') || jobCategory.includes('web') || jobTitle.includes('engineer') || jobTitle.includes('developer'))) rolePts += 6;
  }

  // Interest ↔ category/title match (max 5 pts)
  if (userInterests.some(ui => jobCategory.includes(ui) || jobTitle.includes(ui))) rolePts += 5;

  // Goals ↔ job title (max 3 pts)
  if (goals) {
    const goalWords = goals.split(/\s+/).filter(w => w.length > 4);
    if (goalWords.some(w => jobTitle.includes(w) || jobCategory.includes(w))) rolePts += 3;
  }
  rolePts = Math.min(20, rolePts);

  // ── 4. Experience depth (15 pts) ─────────────────────────────────────────
  // Based on experience entries + how many required skills user has (precision again)
  const expEntries = (profile.experience || []).length;
  const expFromHistory = expEntries >= 3 ? 8 : expEntries >= 2 ? 6 : expEntries >= 1 ? 4 : 2;
  const expFromPrecision = Math.round(precision * 7); // reward matching the right skills
  const expPts = Math.min(15, expFromHistory + expFromPrecision);

  // ── H1B micro-boost ───────────────────────────────────────────────────────
  const h1bBoost = job.h1bSponsor ? 2 : 0;

  // ── Total ─────────────────────────────────────────────────────────────────
  const raw   = skillPts + kwPts + rolePts + expPts + h1bBoost;
  const total = Math.min(98, Math.max(5, raw));

  const label = total >= 80 ? 'Strong Match'
              : total >= 65 ? 'Good Match'
              : total >= 45 ? 'Fair Match'
              : 'Low Match';

  // ── Explanation ───────────────────────────────────────────────────────────
  const parts = [];
  if (matchedTags.length > 0)
    parts.push(`You have ${matchedTags.length} of ${jobTags.length} required skill${jobTags.length > 1 ? 's' : ''}: ${matchedTags.slice(0, 3).join(', ')}.`);
  if (missingTags.length > 0)
    parts.push(`Missing: ${missingTags.slice(0, 3).join(', ')}.`);
  if (rolePts >= 10)
    parts.push('This role aligns with your career goals.');
  if (matchedTags.length === 0)
    parts.push('Build your profile to improve skill matching.');
  const matchExplanation = parts.join(' ') || 'General match based on available data.';

  return {
    ...job,
    matchScore:       total,
    matchLabel:       label,
    matchingSkills:   matchedTags.slice(0, 8),
    missingSkills:    missingTags,
    skillScore:       Math.round(precision * 100),          // precision-based
    expScore:         Math.round((expPts / 15) * 100),
    industryScore:    Math.round((rolePts / 20) * 100),
    matchExplanation,
    noProfile:        false,
  };
}

/**
 * Rank jobs. Returns { above, below, threshold }.
 * Jobs below threshold are shown last with a "lower match" note.
 */
async function rankJobsAI(jobs, profile, recs = [], threshold = THRESHOLD) {
  // First do rule-based scoring for all jobs (fast)
  const scored = jobs.map(j => scoreJob(j, profile, recs));

  // Then use AI to re-score the top candidates (above 40%) for better accuracy
  if (isReady() && (profile.skills || []).length > 0) {
    try {
      // Get top candidates by rule-based score
      const candidates = scored
        .filter(j => !j.noProfile && j.matchScore >= 40)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 15);

      if (candidates.length > 0) {
        const aiScores = await aiScoreJobs(candidates, profile);
        if (aiScores) {
          // Blend: 50% AI score + 50% rule-based score for stability
          candidates.forEach((job, i) => {
            if (aiScores[i] !== undefined) {
              const blended = Math.round((aiScores[i] * 0.6) + (job.matchScore * 0.4));
              const idx = scored.findIndex(j => (j.id || j.jobId) === (job.id || job.jobId));
              if (idx >= 0) {
                scored[idx].matchScore = Math.min(98, Math.max(5, blended));
                scored[idx].matchLabel = scored[idx].matchScore >= 80 ? 'Strong Match'
                  : scored[idx].matchScore >= 65 ? 'Good Match'
                  : scored[idx].matchScore >= 45 ? 'Fair Match' : 'Low Match';
                scored[idx].aiScored = true;
              }
            }
          });
        }
      }
    } catch { /* fall back to rule-based */ }
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const above = scored.filter(j => j.matchScore >= threshold || j.noProfile);
  const below = scored.filter(j => !j.noProfile && j.matchScore < threshold);
  return { above, below, threshold };
}

// Sync version for backwards compatibility
function rankJobs(jobs, profile, recs = [], threshold = THRESHOLD) {
  const scored = jobs.map(j => scoreJob(j, profile, recs));
  scored.sort((a, b) => b.matchScore - a.matchScore);
  const above = scored.filter(j => j.matchScore >= threshold || j.noProfile);
  const below = scored.filter(j => !j.noProfile && j.matchScore < threshold);
  return { above, below, threshold };
}

module.exports = { scoreJob, rankJobs, rankJobsAI, THRESHOLD };
