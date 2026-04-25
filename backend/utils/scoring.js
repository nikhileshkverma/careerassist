/**
 * scoring.js — career match scoring engine.
 *
 * Key fix: use WEIGHTED PRECISION (matched weight / total weight), not recall.
 * A user with 80 skills matching all 3 high-weight skills of a role gets credit
 * for those 3, not for every skill they own. Avoids inflation to 100% for everyone.
 *
 * Components (sum to 100):
 *   50pts  Skill precision  — weighted match of required skills
 *   25pts  Interest match   — user interests vs role interests (capped, partial credit)
 *   15pts  Education match  — education relevance (partial if partial match)
 *    5pts  Goal alignment   — career goals mention the role
 *    5pts  Confidence bonus — only added if skill precision > 70%
 */

const ALIASES = {
  // Language aliases
  'js':'javascript','reactjs':'react','nodejs':'node.js','py':'python',
  'golang':'go','c++':'c++','cpp':'c++','csharp':'c#','c sharp':'c#',
  // ML aliases
  'ml':'machine learning','dl':'deep learning','k8s':'kubernetes','tf':'tensorflow',
  'ai':'machine learning','gen ai':'llm','genai':'llm','nlp':'nlp',
  'llms':'llm','large language model':'llm','large language models':'llm',
  // Cloud aliases
  'amazon web services':'aws','google cloud':'gcp','google cloud platform':'gcp',
  'microsoft azure':'azure','azure cloud':'azure',
  // Tool aliases
  'github actions':'ci/cd','gitlab ci':'ci/cd','jenkins ci':'ci/cd',
  'postgres':'postgresql','mongo':'mongodb','elastic':'elasticsearch',
  'rest':'rest api','restful':'rest api','restful api':'rest api','restful apis':'rest api',
  'docker container':'docker','container':'docker',
  'linux os':'linux','unix':'linux',
  'version control':'git','source control':'git',
};

function norm(s) {
  const l = s.toLowerCase().trim();
  return ALIASES[l] || l;
}

function normAll(arr) { return (arr || []).map(norm); }

/**
 * Score a career role against a user profile.
 * Returns realistic 0–100 percentages, not inflated to 99 for broad profiles.
 */
function scoreCareer(jobRole, userSkills, userInterests = [], userEducation = '', userGoals = '') {
  const us  = normAll(userSkills);
  const ui  = (userInterests || []).map(s => s.toLowerCase());
  const ue  = (userEducation || '').toLowerCase();
  const ug  = (userGoals || '').toLowerCase();

  const req = jobRole.requiredSkills || [];

  // ── 1. Skill PRECISION (50 pts) ───────────────────────────────────────────
  // Key: matched weight / total weight — not "how many user skills matched"
  let ws = 0, tw = 0;
  const matched = [], missing = [];
  req.forEach(({ skill, weight }) => {
    const ns = norm(skill);
    tw += weight;
    const hit = us.some(u => u === ns || (u.length > 3 && u.includes(ns)) || (ns.length > 3 && ns.includes(u)));
    if (hit) { matched.push(skill); ws += weight; }
    else      { missing.push(skill); }
  });
  const precision   = tw > 0 ? ws / tw : 0;            // 0.0–1.0
  const skillScore  = Math.round(precision * 50);       // 0–50 pts

  // ── 2. Interest match (25 pts, capped at 20 unless >60% skill precision) ──
  const ri = jobRole.relatedInterests || [];
  let im = 0;
  ri.forEach(interest => {
    const il = interest.toLowerCase();
    if (ui.some(u => u.includes(il) || il.includes(u))) im++;
  });
  const interestRatio = ri.length > 0 ? im / ri.length : 0;
  // Partial credit: each matched interest worth proportional share, capped
  const maxInterest   = precision >= 0.6 ? 25 : 18;   // broader cap if skills are strong
  const interestScore = Math.round(interestRatio * maxInterest);

  // ── 3. Education match (15 pts, partial) ─────────────────────────────────
  const eduMatches = (jobRole.educationMatch || []).filter(e => ue.includes(e.toLowerCase()));
  const eduScore = eduMatches.length > 0
    ? Math.round(Math.min(1, eduMatches.length / (jobRole.educationMatch.length || 1)) * 15)
    : 0;

  // ── 4. Goal alignment (5 pts) ─────────────────────────────────────────────
  const roleName  = (jobRole.roleName || '').toLowerCase();
  const roleWords = roleName.split(/\s+/).filter(w => w.length > 3);
  const goalScore = ug && roleWords.some(w => ug.includes(w)) ? 5 : 0;

  // ── 5. Confidence bonus (5 pts, only if strong skill match) ───────────────
  const bonusPts = precision >= 0.7 ? 5 : 0;

  // ── Total ─────────────────────────────────────────────────────────────────
  const matchPercentage = Math.min(97, Math.max(5,
    skillScore + interestScore + eduScore + goalScore + bonusPts
  ));

  // Confidence = how sure we are the score is meaningful
  const confidenceScore = Math.min(100, Math.round((precision * 0.65 + interestRatio * 0.35) * 100));

  // ── Explanation ───────────────────────────────────────────────────────────
  const reasoning = [];
  if (matched.length > 0)
    reasoning.push(`You have ${matched.length}/${req.length} required skills: ${matched.slice(0, 4).join(', ')}.`);
  if (im > 0)
    reasoning.push('Your interests align with this field.');
  if (eduScore > 0)
    reasoning.push('Your education supports this career.');
  if (missing.length > 0)
    reasoning.push(`Key gaps: ${missing.slice(0, 3).join(', ')}.`);
  if (matched.length === 0)
    reasoning.push('Add relevant skills to improve this match.');

  return {
    careerTitle:       jobRole.roleName,
    category:          jobRole.category,
    icon:              jobRole.icon,
    matchPercentage,
    confidenceScore,
    matchedSkills:     matched,
    missingSkills:     missing,
    presentSkills:     matched,
    recommendationText: reasoning.join(' ') || 'Match based on profile data.',
    growth:            jobRole.growth,
    avgSalary:         jobRole.avgSalary,
    keyResources:      jobRole.keyResources || [],
    roleId:            jobRole._id,
  };
}

function simulateWithSkill(jobRole, currentSkills, userInterests, userEducation, userGoals, newSkill) {
  const before = scoreCareer(jobRole, currentSkills, userInterests, userEducation, userGoals);
  const after  = scoreCareer(jobRole, [...currentSkills, newSkill], userInterests, userEducation, userGoals);
  return {
    careerTitle: jobRole.roleName,
    icon:        jobRole.icon,
    beforeScore: before.matchPercentage,
    afterScore:  after.matchPercentage,
    improvement: after.matchPercentage - before.matchPercentage,
  };
}

module.exports = { scoreCareer, simulateWithSkill, norm, normAll };
