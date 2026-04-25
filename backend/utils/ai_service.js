/**
 * ai_service.js — Qwen2.5:7b powered AI features
 * Qwen2.5-14B — primary AI model for all CareerAssist features:
 *  - Stronger JSON adherence (critical for structured outputs)
 *  - Better instruction following
 *  - Better multilingual + technical reasoning
 *  - Faster on Apple Silicon M-series chips
 */
const { callOllamaDirectly, callOllamaChat, isReady } = require('./ollama_setup');

// ── JSON extraction with multiple fallback strategies ─────────────────────────
function extractJSON(text) {
  if (!text) return null;
  // Direct parse
  try { return JSON.parse(text.trim()); } catch {}
  // Remove markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(stripped); } catch {}
  // Find first { ... } block
  const obj = stripped.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch {} }
  // Find first [ ... ] block
  const arr = stripped.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch {} }
  return null;
}

// ── Career Counselor Chat ─────────────────────────────────────────────────────
async function careerCounselorChat(messages, userContext) {
  if (!isReady()) return null;

  const system = `You are CareerAssist AI — an expert career counselor powered by Qwen2.5.
User profile:
- Name: ${userContext.name || 'User'}
- Skills (${(userContext.skills||[]).length}): ${(userContext.skills||[]).slice(0,20).join(', ')}
- Career Goals: ${userContext.careerGoals || 'Not set'}
- Top Career Match: ${userContext.topCareer || 'Not generated'} (${userContext.topScore||0}%)
- Missing Skills for top role: ${(userContext.missingSkills||[]).slice(0,5).join(', ')||'None'}
- Education: ${userContext.education || 'Not specified'}

Instructions:
- Be specific, actionable, and reference the user's actual profile data
- For skill gaps: recommend exact courses (Coursera, fast.ai, official docs)
- For career paths: give realistic timelines and step-by-step plans
- Keep responses focused and under 300 words unless a detailed plan is requested
- Format with **bold** for key points`;

  const response = await callOllamaChat(
    [{ role: 'system', content: system }, ...messages.slice(-12)],
    { temperature: 0.7, maxTokens: 900 }
  );
  return response;
}

// ── JD Analysis ───────────────────────────────────────────────────────────────
async function analyzeJD(jdText, userProfile) {
  if (!isReady()) return null;

  const prompt = `You are a resume analyst. Compare the job description to the candidate profile.
Output ONLY valid JSON with no extra text.

JOB DESCRIPTION:
${jdText.slice(0, 2500)}

CANDIDATE SKILLS: ${(userProfile.skills||[]).join(', ')}
CANDIDATE EXPERIENCE: ${String(userProfile.experience||'').slice(0, 600)}
CANDIDATE EDUCATION: ${String(userProfile.education||'').slice(0, 300)}

Return this exact JSON structure:
{
  "match_percentage": <integer 0-100>,
  "required_skills": ["skill1", "skill2"],
  "present_skills": ["skill1"],
  "missing_skills": ["skill1"],
  "suggested_additions": ["what to add to resume"],
  "hiring_likelihood": "Low | Moderate | Strong",
  "summary": "2-3 sentence honest summary",
  "ats_keywords": ["keyword1", "keyword2"]
}`;

  const text = await callOllamaDirectly(prompt, { temperature: 0.1, maxTokens: 1000 });
  return extractJSON(text);
}

// ── Resume Tailoring ──────────────────────────────────────────────────────────
async function tailorResume(resumeData, jdText, selectedSkills, rephraseExperience) {
  if (!isReady()) return null;

  const expText = Array.isArray(resumeData.experience)
    ? resumeData.experience.map(e => `${e.title} at ${e.company}: ${(e.bullets||[]).slice(0,3).join('; ')}`).join('\n')
    : String(resumeData.experience || '');

  const prompt = `You are an expert resume writer. Improve this resume for the job.
Rules: 
1. Do NOT remove existing content
2. Only ADD missing skills and REPHRASE bullets to use JD keywords
3. Keep all facts accurate — do not invent achievements
4. Output ONLY valid JSON

CURRENT RESUME:
Skills: ${(resumeData.skills||[]).join(', ')}
Experience:
${expText.slice(0, 1800)}

JOB DESCRIPTION: ${jdText.slice(0, 1200)}
SKILLS TO ADD: ${selectedSkills.join(', ')}
${rephraseExperience ? 'Also improve experience bullets to use JD keywords.' : 'Do not change experience bullets.'}

Return this exact JSON:
{
  "updated_skills": ["full combined skill list"],
  "updated_experience": [
    {"company": "name", "title": "title", "bullets": ["bullet1", "bullet2"]}
  ],
  "added_keywords": ["kw1"],
  "changes_made": ["Added X skills", "Improved Y bullet"],
  "ats_score_before": <integer>,
  "ats_score_after": <integer>
}`;

  const text = await callOllamaDirectly(prompt, { temperature: 0.2, maxTokens: 2500 });
  return extractJSON(text);
}

// ── Resume Section Edit ───────────────────────────────────────────────────────
async function editResumeSection(section, currentContent, instruction, profileContext) {
  if (!isReady()) return null;

  const prompt = `Edit this resume section. Be professional and ATS-friendly.
Output ONLY the improved text — no JSON, no explanation, no preamble.

Section: ${section}
Current content: ${currentContent.slice(0, 800)}
Instruction: ${instruction}
User skills context: ${(profileContext.skills||[]).slice(0,12).join(', ')}`;

  const text = await callOllamaDirectly(prompt, { temperature: 0.4, maxTokens: 600 });
  return text?.trim() || null;
}

// ── Learning Roadmap ──────────────────────────────────────────────────────────
async function generateRoadmap(missingSkills, targetRole, candidateSkills) {
  if (!isReady()) return null;

  const prompt = `Create a practical learning roadmap. Output ONLY valid JSON.

Target Role: ${targetRole}
Candidate already has: ${candidateSkills.slice(0,15).join(', ')}
Skills to learn: ${missingSkills.slice(0,6).join(', ')}

Return this exact JSON:
{
  "missing_skills": [
    {
      "skill": "skill name",
      "priority": "High",
      "reason": "why critical for ${targetRole}",
      "estimated_weeks": <integer 2-12>,
      "course_links": [
        {"label": "🆓 Free", "url": "https://actual-url.com"},
        {"label": "🎓 Coursera", "url": "https://coursera.org/..."}
      ],
      "google_query": "skill beginner tutorial",
      "youtube_query": "skill full course 2024"
    }
  ],
  "learning_roadmap": ["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ..."],
  "estimated_time": "X-Y months",
  "priority_skill": "most important skill name"
}`;

  const text = await callOllamaDirectly(prompt, { temperature: 0.3, maxTokens: 1800 });
  return extractJSON(text);
}

// ── Job Match Explanation ─────────────────────────────────────────────────────
async function scoreJobMatch(jobDescription, userProfile) {
  if (!isReady()) return null;

  const prompt = `Score this job match briefly. Output ONLY valid JSON.

Job: ${jobDescription.slice(0, 800)}
Candidate Skills: ${(userProfile.skills||[]).slice(0,20).join(', ')}

{
  "score": <0-100>,
  "label": "Strong Match | Good Match | Fair Match | Low Match",
  "matching_skills": ["skill1"],
  "missing_skills": ["skill1"],
  "one_line": "one honest sentence"
}`;

  const text = await callOllamaDirectly(prompt, { temperature: 0.1, maxTokens: 400 });
  return extractJSON(text);
}

module.exports = { careerCounselorChat, analyzeJD, tailorResume, editResumeSection, generateRoadmap, scoreJobMatch };
