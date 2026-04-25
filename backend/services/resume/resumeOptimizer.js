/**
 * resumeOptimizer.js — safe resume optimization with honest enhancement tracking.
 *
 * Rules enforced here:
 * - Preserve original structure and bullets
 * - Only ADD missing keywords to skills section
 * - Only rephrase bullets if explicitly requested AND changes are real
 * - Track exactly what changed
 * - Never mark "Enhanced" unless actual changes happened
 */

const { isReady, callOllamaChat } = require('../../utils/ollama_setup');

/**
 * Add missing skills to a resume's skill list.
 * Safe: only appends, never removes existing skills.
 *
 * @param {string[]} currentSkills
 * @param {string[]} skillsToAdd
 * @returns {{ updatedSkills: string[], added: string[], alreadyHad: string[] }}
 */
function addMissingSkills(currentSkills, skillsToAdd) {
  const current = new Set(currentSkills.map(s => s.toLowerCase().trim()));
  const added = [];
  const alreadyHad = [];
  const updated = [...currentSkills];

  for (const skill of skillsToAdd) {
    const key = skill.toLowerCase().trim();
    if (!key) continue;
    if (current.has(key)) {
      alreadyHad.push(skill);
    } else {
      updated.push(skill);
      current.add(key);
      added.push(skill);
    }
  }
  return { updatedSkills: updated, added, alreadyHad };
}

/**
 * Rephrase a single experience bullet using LLM (Ollama).
 * Safe: returns the ORIGINAL if LLM is unavailable or produces no real change.
 *
 * @param {string} bullet     - Original bullet text
 * @param {string} jdContext  - Brief JD keywords for context
 * @returns {Promise<{text: string, changed: boolean}>}
 */
async function rephraseBullet(bullet, jdContext = '') {
  if (!isReady()) return { text: bullet, changed: false };
  if (!bullet || bullet.trim().length < 10) return { text: bullet, changed: false };

  try {
    const prompt = `You are a professional resume editor. Improve this single resume bullet point.
Rules:
- Keep the same meaning and facts
- Start with a strong action verb
- Add measurable impact if implied by context
- Do NOT make up numbers or facts
- Return ONLY the improved bullet, no explanation
- If the bullet is already strong, return it unchanged

JD context (keywords to align with if naturally possible): ${jdContext || 'none'}
Original bullet: ${bullet}`;

    const response = await callOllamaChat([
      { role: 'user', content: prompt }
    ], { temperature: 0.4, maxTokens: 150 });

    if (!response) return { text: bullet, changed: false };

    const improved = response.replace(/^["'\-•*]\s*/, '').trim();
    // Only report changed if text actually differs meaningfully
    const changed = improved.length > 0 && improved.toLowerCase() !== bullet.toLowerCase();
    return { text: changed ? improved : bullet, changed };
  } catch {
    return { text: bullet, changed: false };
  }
}

/**
 * Main optimizer function.
 *
 * @param {Object} resume          - Resume subdocument from User model
 * @param {string[]} skillsToAdd   - Skills selected by user from missing list
 * @param {boolean} rephraseExp    - Whether to rephrase experience bullets
 * @param {string}  jdText         - Job description for context (may be empty)
 * @returns {Promise<OptimizeResult>}
 */
async function optimizeResume(resume, skillsToAdd = [], rephraseExp = false, jdText = '') {
  const changes = [];
  let modified = false;

  // Clone to avoid mutating the original object reference
  const updated = {
    skills:     [...(resume.skills || [])],
    experience: JSON.parse(JSON.stringify(resume.experience || [])),
    // Everything else unchanged
  };

  // ── Step 1: Add missing skills ────────────────────────────────────────────
  if (skillsToAdd.length > 0) {
    const { updatedSkills, added, alreadyHad } = addMissingSkills(updated.skills, skillsToAdd);
    if (added.length > 0) {
      updated.skills = updatedSkills;
      changes.push(`Added ${added.length} skill${added.length > 1 ? 's' : ''} to Skills section: ${added.join(', ')}.`);
      modified = true;
    }
    if (alreadyHad.length > 0) {
      changes.push(`Already had: ${alreadyHad.join(', ')} (no change needed).`);
    }
  }

  // ── Step 2: Rephrase bullets (optional, LLM-assisted) ────────────────────
  if (rephraseExp && isReady()) {
    const jdContext = jdText.slice(0, 300); // keep prompt small
    let bulletChanges = 0;

    for (let i = 0; i < updated.experience.length; i++) {
      const exp = updated.experience[i];
      if (!Array.isArray(exp.bullets)) continue;

      const newBullets = [];
      for (const bullet of exp.bullets) {
        const { text, changed } = await rephraseBullet(bullet, jdContext);
        newBullets.push(text);
        if (changed) bulletChanges++;
      }
      updated.experience[i] = { ...exp, bullets: newBullets };
    }

    if (bulletChanges > 0) {
      changes.push(`Rephrased ${bulletChanges} experience bullet${bulletChanges > 1 ? 's' : ''} for impact.`);
      modified = true;
    } else if (rephraseExp) {
      changes.push('Experience bullets were already strong — no changes made.');
    }
  } else if (rephraseExp && !isReady()) {
    changes.push('AI rephrase skipped (Ollama offline). Skills were still updated.');
  }

  return {
    updatedSkills:     updated.skills,
    updatedExperience: updated.experience,
    changes,
    wasModified: modified,
    // "Enhanced" is ONLY true if real changes happened
    enhancedLabel: modified ? 'Enhanced' : 'Unchanged',
    aiUsed: rephraseExp && isReady(),
  };
}

module.exports = { optimizeResume, addMissingSkills };
