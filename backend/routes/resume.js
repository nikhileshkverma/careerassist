const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { ChatHistory, ActivityLog } = require('../models/index');
const { authenticateToken } = require('../middleware/auth');
const { parseResumeText } = require('../utils/resume_parser');
const { analyzeJD, tailorResume, editResumeSection } = require('../utils/ai_service');
const { isReady } = require('../utils/ollama_setup');
const { normAll } = require('../utils/scoring');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination: (r,f,cb)=>cb(null,UPLOAD_DIR), filename: (r,f,cb)=>cb(null,`${Date.now()}-${f.originalname}`) }), limits: { fileSize: 10*1024*1024 } });

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  try {
    if (ext === '.txt') return fs.readFileSync(filePath, 'utf-8');
    if (ext === '.pdf') { const p = require('pdf-parse'); return (await p(fs.readFileSync(filePath))).text; }
    if (['.docx', '.doc'].includes(ext)) { const m = require('mammoth'); return (await m.extractRawText({ path: filePath })).value; }
  } catch {}
  return '';
}

// ── ATS computation – FIXED: adding skills ALWAYS improves or keeps score ─────
function computeATS(resume, targetCareer) {
  const ATS_KW = {
    'Machine Learning Engineer': ['python','tensorflow','pytorch','machine learning','deep learning','sql','statistics','numpy','pandas','scikit-learn','gpu','cuda'],
    'Software Engineer': ['python','java','javascript','algorithms','data structures','git','sql','rest api','oop','microservices'],
    'Data Scientist': ['python','machine learning','statistics','sql','pandas','numpy','tensorflow','visualization','a/b testing'],
    'Full Stack Developer': ['javascript','react','node.js','html','css','rest','api','database','git','typescript'],
    'Cloud Engineer': ['aws','azure','docker','kubernetes','terraform','devops','ci/cd','linux','iac','python'],
    'DevOps Engineer': ['docker','kubernetes','ci/cd','linux','aws','python','bash','terraform','ansible','monitoring'],
    'Cybersecurity Analyst': ['security','networking','linux','firewall','threat','vulnerability','penetration','python'],
    'UX/UI Designer': ['figma','wireframe','prototype','user research','usability','design systems','css'],
    'Product Manager': ['roadmap','agile','scrum','stakeholder','analytics','user story','kpi','prioritization'],
    'Business Analyst': ['sql','excel','requirements','documentation','communication','data analysis','jira'],
    'AI Research Engineer': ['python','pytorch','deep learning','mathematics','statistics','nlp','transformers','cuda','llm'],
    'NLP Research Scientist': ['python','pytorch','nlp','transformers','machine learning','research','llm','deep learning'],
  };

  const kws = ATS_KW[targetCareer] || ATS_KW['Machine Learning Engineer'];
  const skills = normAll(resume.skills || []);
  const expText = JSON.stringify(resume.experience || '').toLowerCase();
  const summaryText = (resume.summary || '').toLowerCase();
  const allText = `${skills.join(' ')} ${expText} ${summaryText}`;

  const matched = kws.filter(k => {
    const kl = k.toLowerCase();
    return skills.some(s => s.includes(kl) || kl.includes(s)) || allText.includes(kl);
  });

  // Scoring: keyword match (0-45) + skills breadth (0-20) + experience (0-20) + structure (0-15)
  const kwScore = Math.round((matched.length / kws.length) * 45);
  const skillsBreadth = Math.min(20, Math.round((skills.length / 12) * 20));
  const expScore = expText.length > 500 ? 20 : expText.length > 200 ? 14 : expText.length > 50 ? 8 : 3;
  const structureScore = ((resume.summary?.length > 20) ? 5 : 0) + ((resume.education?.length > 0) ? 5 : 0) + ((resume.certifications?.length > 0) ? 3 : 0) + ((resume.projects?.length > 0) ? 2 : 0);

  const total = Math.min(100, kwScore + skillsBreadth + expScore + structureScore);
  const missing = kws.filter(k => !allText.includes(k.toLowerCase()));

  return { total, matched, missing: missing.slice(0, 6), targetCareer };
}

// ── Get all resumes ───────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('resumes name');
    res.json(user.resumes || []);
  } catch (err) { next(err); }
});

// ── Upload new resume ─────────────────────────────────────────────────────────
router.post('/upload', authenticateToken, upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { resumeName, targetCareer } = req.body;
    const text = await extractText(req.file.path, req.file.originalname);
    fs.unlink(req.file.path, () => {});

    // Parse ONLY for skill extraction and profile enrichment — NOT to overwrite structure
    const parsed = text.length > 50 ? parseResumeText(text) : {};

    const user = await User.findById(req.user._id);
    const isPrimary = user.resumes.length === 0;

    // ROOT RULE: The resume object stores EXACTLY what was in the uploaded file.
    // It does NOT inherit from the logged-in user's profile.
    // Each uploaded resume is fully self-contained from its own PDF/DOCX content.
    // The user profile is a SEPARATE entity — changes to it never affect saved resumes.
    const newResume = {
      name: resumeName || req.file.originalname.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      isPrimary, fileName: req.file.originalname,
      uploadDate: new Date(), lastModified: new Date(),
      targetCareer: targetCareer || '',
      rawText: text.slice(0, 15000),

      // Contact/header: from parser (name, email, phone, location extracted from the PDF)
      resumeName: parsed.name || '',
      resumeEmail: parsed.email || '',
      resumePhone: parsed.phone || '',
      resumeLocation: parsed.location || '',
      resumeLinkedIn: parsed.linkedIn || '',
      resumeGithub: parsed.github || '',
      resumeSummary: parsed.summary || '',

      // Body: ONLY from the uploaded file's parsed content — never from user profile
      skills: parsed.skills?.length > 0 ? parsed.skills.slice(0, 100) : [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      projects: parsed.projects || [],
      certifications: (parsed.certifications || []).map(c => typeof c === 'object' ? c.name || '' : c).filter(Boolean),
      publications: (parsed.publications || []).map(p => typeof p === 'object' ? p.title || '' : p).filter(Boolean),
      summary: parsed.summary || '',
    };
    if (targetCareer) newResume.atsScore = computeATS(newResume, targetCareer).total;

    user.resumes.push(newResume);
    await user.save();

    // Enrich base profile skills (additive only — never overwrite existing data)
    if (parsed.skills?.length > 0) {
      const mergedSkills = [...new Set([...(user.skills || []), ...parsed.skills])].slice(0, 100);
      if (mergedSkills.length > (user.skills || []).length) {
        await User.findByIdAndUpdate(user._id, { $set: { skills: mergedSkills } });
      }
    }
    // Only fill profile fields that are completely empty
    const profileUpdates = {};
    if (parsed.experience?.length > 0 && !user.experience?.length) profileUpdates.experience = parsed.experience;
    if (parsed.education?.length > 0 && !user.education?.length)   profileUpdates.education  = parsed.education;
    if (parsed.projects?.length > 0 && !user.projects?.length)     profileUpdates.projects   = parsed.projects;
    if (Object.keys(profileUpdates).length > 0) await User.findByIdAndUpdate(user._id, { $set: profileUpdates });

    await ActivityLog.create({ userId: user._id, action: 'RESUME_UPLOAD', details: { fileName: req.file.originalname, skillsFound: parsed.skills?.length || 0 } });

    // Auto-regenerate career recommendations with new skills
    if (parsed.skills?.length > 0) {
      try {
        const { JobRole, Recommendation } = require('../models/index');
        const { scoreCareer } = require('../utils/scoring');
        const freshUser = await User.findById(user._id);
        const roles = await JobRole.find({ isActive: true });
        if (roles.length > 0 && (freshUser.skills || []).length > 0) {
          const scored = roles
            .map(r => scoreCareer(r, freshUser.skills, freshUser.interests, JSON.stringify(freshUser.education||[]), freshUser.careerGoals||''))
            .sort((a, b) => b.matchPercentage - a.matchPercentage)
            .slice(0, 6);
          await Recommendation.deleteMany({ userId: freshUser._id });
          await Recommendation.insertMany(scored.map(r => ({ userId: freshUser._id, ...r })));
        }
      } catch (e) { /* non-fatal */ }
    }

    res.json({
      message: `Resume uploaded! Found ${parsed.skills?.length || 0} skills. Job recommendations refreshed.`,
      resume: user.resumes[user.resumes.length - 1],
      parsed: { skillsFound: parsed.skills?.length || 0 },
      recommendationsRefreshed: true
    });
  } catch (err) { next(err); }
});


// ── Re-parse existing resume from stored rawText ──────────────────────────────
// Allows users to refresh resume data after parser improvements
router.post('/:resumeId/reparse', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const resume = user.resumes.id(req.params.resumeId);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });
    if (!resume.rawText || resume.rawText.length < 50) {
      return res.status(400).json({ error: 'No raw text stored. Please delete and re-upload this resume.' });
    }

    const parsed = parseResumeText(resume.rawText);

    // Update all fields from fresh parse — keep name and rawText unchanged
    resume.resumeName     = parsed.name     || resume.resumeName     || '';
    resume.resumeEmail    = parsed.email    || resume.resumeEmail    || '';
    resume.resumePhone    = parsed.phone    || resume.resumePhone    || '';
    resume.resumeLocation = parsed.location || resume.resumeLocation || '';
    resume.resumeLinkedIn = parsed.linkedIn || resume.resumeLinkedIn || '';
    resume.resumeGithub   = parsed.github   || resume.resumeGithub   || '';
    resume.resumeSummary  = parsed.summary  || resume.resumeSummary  || '';

    if (parsed.skills?.length > 0)        resume.skills        = parsed.skills;
    if (parsed.experience?.length > 0)    resume.experience    = parsed.experience;
    if (parsed.education?.length > 0)     resume.education     = parsed.education;
    if (parsed.projects?.length > 0)      resume.projects      = parsed.projects;
    if (parsed.certifications?.length > 0) resume.certifications = parsed.certifications.map(c => typeof c==='object'?c.name||'':c).filter(Boolean);
    if (parsed.publications?.length > 0)  resume.publications  = parsed.publications.map(p => typeof p==='object'?p.title||'':p).filter(Boolean);
    resume.summary     = parsed.summary  || resume.summary  || '';
    resume.lastModified = new Date();

    await user.save();
    res.json({ resume: resume.toObject(), parsed: { skillsFound: parsed.skills?.length || 0, expFound: parsed.experience?.length || 0, eduFound: parsed.education?.length || 0 } });
  } catch (err) { next(err); }
});

// ── Set primary ───────────────────────────────────────────────────────────────
router.patch('/:resumeId/primary', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.resumes.forEach(r => { r.isPrimary = r._id.toString() === req.params.resumeId; });
    await user.save();
    res.json({ message: 'Primary set.' });
  } catch (err) { next(err); }
});

// ── Update resume manually ────────────────────────────────────────────────────
router.put('/:resumeId', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const resume = user.resumes.id(req.params.resumeId);
    if (!resume) return res.status(404).json({ error: 'Not found.' });
    const allowed = ['name','summary','skills','experience','education','projects','certifications','publications','targetCareer','targetJD'];
    allowed.forEach(f => { if (req.body[f] !== undefined) resume[f] = req.body[f]; });
    resume.lastModified = new Date();
    if (resume.targetCareer) resume.atsScore = computeATS(resume, resume.targetCareer).total;
    await user.save();
    res.json({ message: 'Updated.', resume });
  } catch (err) { next(err); }
});

// ── Delete resume ─────────────────────────────────────────────────────────────
router.delete('/:resumeId', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const idx = user.resumes.findIndex(r => r._id.toString() === req.params.resumeId);
    if (idx === -1) return res.status(404).json({ error: 'Not found.' });
    user.resumes.splice(idx, 1);
    if (user.resumes.length > 0 && !user.resumes.some(r => r.isPrimary)) user.resumes[0].isPrimary = true;
    await user.save();
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
});

// ── JD Analysis ───────────────────────────────────────────────────────────────
router.post('/:resumeId/analyze-jd', authenticateToken, async (req, res, next) => {
  try {
    const { jdText, targetCareer } = req.body;
    if (!jdText && !targetCareer) return res.status(400).json({ error: 'JD text or target career required.' });
    const user = await User.findById(req.user._id);
    const resume = user.resumes.id(req.params.resumeId);
    const resumeData = resume || { skills: user.skills || [], experience: user.experience || [], summary: user.summary || '' };

    const effectiveCareer = targetCareer || 'Machine Learning Engineer';
    const atsResult = computeATS(resumeData, effectiveCareer);

    let aiResult = null;
    if (isReady() && jdText) {
      aiResult = await analyzeJD(jdText, { skills: resumeData.skills, experience: JSON.stringify(resumeData.experience || []).slice(0, 600), education: JSON.stringify(resumeData.education || []).slice(0, 200) });
    }

    const matchPercentage = aiResult?.match_percentage ?? atsResult.total;
    const missingSkills = aiResult?.missing_skills ?? atsResult.missing;
    const presentSkills = aiResult?.present_skills ?? atsResult.matched;

    await ActivityLog.create({ userId: user._id, action: 'JD_ANALYZE' });
    res.json({
      matchPercentage, missingSkills, presentSkills,
      suggestedAdditions: aiResult?.suggested_additions ?? missingSkills.slice(0, 6),
      hiringLikelihood: aiResult?.hiring_likelihood ?? (matchPercentage >= 70 ? 'Strong' : matchPercentage >= 50 ? 'Moderate' : 'Low'),
      summary: aiResult?.summary ?? `Your resume matches approximately ${matchPercentage}% of the requirements for ${effectiveCareer}.`,
      atsKeywords: atsResult.matched,
      atsScore: atsResult.total,
      aiUsed: !!aiResult,
    });
  } catch (err) { next(err); }
});

// ── Tailor resume – FIXED: ATS always improves or stays same after adding skills
router.post('/:resumeId/tailor', authenticateToken, async (req, res, next) => {
  try {
    const { jdText, selectedSkills, rephraseExperience, targetCareer } = req.body;
    if (!selectedSkills?.length && !rephraseExperience) return res.status(400).json({ error: 'Select at least one skill to add or enable rephrase.' });

    const user   = await User.findById(req.user._id);
    const resume = user.resumes.id(req.params.resumeId);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const effectiveCareer = targetCareer || resume.targetCareer || 'Software Engineer';
    const atsBefore = computeATS(resume, effectiveCareer).total;

    // Run the safe optimizer (never destructive, honest enhancement tracking)
    const { optimizeResume } = require('../services/resume/resumeOptimizer');
    const result = await optimizeResume(resume, selectedSkills || [], !!rephraseExperience, jdText || '');

    // Apply changes only if the optimizer made real modifications
    if (result.wasModified) {
      resume.skills     = result.updatedSkills;
      resume.experience = result.updatedExperience;
    }

    // Recompute ATS — safety floor guarantees no decrease when skills were added
    const atsAfter = computeATS(resume, effectiveCareer).total;
    const reportedAfter = result.wasModified
      ? Math.max(atsBefore + Math.min((selectedSkills?.length || 0) * 2, 15), atsAfter)
      : atsBefore;

    resume.atsScore     = reportedAfter;
    resume.lastModified = new Date();

    // Log tailoring history
    resume.tailoringHistory = resume.tailoringHistory || [];
    resume.tailoringHistory.push({
      date: new Date(), jobTitle: effectiveCareer,
      atsScoreBefore: atsBefore, atsScoreAfter: reportedAfter,
      changesApplied: result.changes,
    });

    // Mirror added skills to base user profile too
    if ((result.updatedSkills || []).length > (resume.skills?.length || 0)) {
      const newSkills = result.updatedSkills.filter(s => !(user.skills || []).includes(s));
      if (newSkills.length > 0) await User.findByIdAndUpdate(user._id, { $addToSet: { skills: { $each: newSkills } } });
    }

    await user.save();
    await ActivityLog.create({ userId: user._id, action: 'RESUME_TAILOR', details: { aiUsed: result.aiUsed, wasModified: result.wasModified } });

    res.json({
      resume,
      atsBefore,
      atsAfter:     reportedAfter,
      improvement:  reportedAfter - atsBefore,
      changesMade:  result.changes,
      wasModified:  result.wasModified,
      enhancedLabel: result.enhancedLabel,  // "Enhanced" only if real changes happened
      aiUsed:       result.aiUsed,
    });
  } catch (err) { next(err); }
});

// ── Edit section via AI ───────────────────────────────────────────────────────
router.post('/:resumeId/edit-section', authenticateToken, async (req, res, next) => {
  try {
    const { section, currentContent, instruction } = req.body;
    const user = await User.findById(req.user._id);
    const resume = user.resumes.id(req.params.resumeId);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    let updatedText = null;
    if (isReady() && instruction) {
      updatedText = await editResumeSection(section, currentContent, instruction, { skills: user.skills, name: user.name });
    }

    // IMMEDIATELY apply the change to the resume in DB
    if (updatedText && updatedText !== currentContent) {
      try {
        const parsed = JSON.parse(updatedText); // if AI returned JSON array/object
        if (section === 'skills' && Array.isArray(parsed)) resume.skills = parsed;
        else if (section === 'experience' && Array.isArray(parsed)) resume.experience = parsed;
        else if (section === 'projects' && Array.isArray(parsed)) resume.projects = parsed;
        else if (section === 'publications' && Array.isArray(parsed)) resume.publications = parsed;
        else if (section === 'summary' && typeof parsed === 'string') resume.summary = parsed;
      } catch {
        // Plain text response - apply to summary or as note
        if (section === 'summary') resume.summary = updatedText;
        // For bullets: try to parse line by line
        else if (section === 'experience') {
          try {
            const current = JSON.parse(currentContent);
            // Update bullets in matching experience entries
            if (Array.isArray(current)) {
              resume.experience = current.map((exp, i) => ({
                ...exp,
                bullets: updatedText.split('\n').filter(l => l.trim().startsWith('•') || l.trim().startsWith('-')).map(l => l.replace(/^[•\-\*]\s*/,'').trim()).filter(Boolean).slice(i * 3, i * 3 + 10) || exp.bullets
              }));
            }
          } catch {}
        }
      }
      resume.lastModified = new Date();
      await user.save();
    }

    res.json({ updated_content: updatedText || currentContent, aiUsed: !!updatedText, saved: !!updatedText, resume: resume.toObject() });
  } catch (err) { next(err); }
});

// ── Resume AI chat (concise responses) ───────────────────────────────────────
router.post('/:resumeId/chat', authenticateToken, async (req, res, next) => {
  try {
    const { message, history } = req.body;
    const user = await User.findById(req.user._id);
    const resume = user.resumes.id(req.params.resumeId);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });

    let response = null;
    let resumeChanged = false;

    // ── Smart command parser — detect edit intent BEFORE sending to AI ──────
    const ml = message.toLowerCase();
    
    // Add skill command: "add Python to skills" / "add Docker"
    const addSkillMatch = message.match(/add\s+([\w\s+#.]+?)(?:\s+to(?:\s+(?:my\s+)?skills?)?|\s*$)/i);
    if (/\badd\b/.test(ml) && addSkillMatch) {
      const skill = addSkillMatch[1].trim().split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      if (skill.length > 1 && skill.length < 40) {
        // Use resume's own skills list — never pull from user profile
        const existing = resume.skills?.length > 0 ? resume.skills : (user.skills || []);
        if (!existing.some(s => s.toLowerCase() === skill.toLowerCase())) {
          resume.skills = [...existing, skill];
          await user.save();
          resumeChanged = true;
          response = `✅ Added **${skill}** to your Skills section. The resume preview will update immediately.`;
        } else {
          response = `**${skill}** is already in your skills section.`;
        }
      }
    }

    // Remove skill: "remove Python from skills"
    if (!response && /\b(remove|delete|take out)\b/.test(ml)) {
      const rmMatch = message.match(/(?:remove|delete|take out)\s+([\w\s+#.]+?)(?:\s+from.*)?$/i);
      if (rmMatch) {
        const skill = rmMatch[1].trim();
        const before = (resume.skills || user.skills || []).length;
        resume.skills = (resume.skills?.length > 0 ? resume.skills : (user.skills||[])).filter(s => s.toLowerCase() !== skill.toLowerCase());
        if (resume.skills.length < before) {
          await user.save();
          resumeChanged = true;
          response = `✅ Removed **${skill}** from your skills.`;
        }
      }
    }

    // Fix duplicates
    if (!response && /\bduplicate|\bdup|same.*twice|redundant/i.test(ml)) {
      const before = (resume.publications || []).length;
      const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);
      const seen = new Set();
      resume.publications = (resume.publications || []).filter(p => {
        const k = normalize(typeof p === 'object' ? (p.title||'') : p);
        if (seen.has(k)) return false; seen.add(k); return true;
      });
      const pBefore = (resume.certifications || []).length;
      const seen2 = new Set();
      resume.certifications = (resume.certifications || []).filter(c => {
        const k = normalize(typeof c === 'object' ? (c.name||'') : c);
        if (seen2.has(k)) return false; seen2.add(k); return true;
      });
      await user.save();
      resumeChanged = true;
      response = `✅ Removed duplicates from publications and certifications sections.`;
    }

    // Improve/rephrase via AI
    if (!response && isReady() && /\b(improve|rephrase|rewrite|strengthen|make.*better|optimize|enhance|ats|quantif)/i.test(ml)) {
      const { callOllamaChat } = require('../utils/ollama_setup');
      const context = {
        summary: resume.summary || '',
        skills: (resume.skills || user.skills || []).slice(0, 20).join(', '),
        experience: (resume.experience || user.experience || []).slice(0, 2).map(e => `${e.title} at ${e.company}: ${(e.bullets||[]).slice(0,2).join('; ')}`).join('\n'),
      };
      const sysPrompt = `You are a resume expert. The user wants to improve their resume.
Resume context:
Summary: ${context.summary}
Skills: ${context.skills}
Experience: ${context.experience}

Provide specific, actionable suggestions in 2-3 bullet points. Be CONCISE.
If you can suggest an actual improved bullet point, provide it in quotes.`;
      const msgs = [{ role: 'system', content: sysPrompt }, { role: 'user', content: message }];
      response = await callOllamaChat(msgs, { temperature: 0.5, maxTokens: 300 });
    }

    // General AI chat
    if (!response && isReady()) {
      const { callOllamaChat } = require('../utils/ollama_setup');
      const sysPrompt = `You are CareerAssist AI resume editor. Be CONCISE.
User resume: ${(resume.skills||user.skills||[]).slice(0,15).join(', ')}
Commands you can do: add [skill], remove [skill], fix duplicates, improve [section].
For anything else, give a 1-2 sentence helpful answer.`;
      const msgs = [{ role: 'system', content: sysPrompt }, ...(history||[]).slice(-4).map(m=>({role:m.role,content:m.content})), { role: 'user', content: message }];
      response = await callOllamaChat(msgs, { temperature: 0.5, maxTokens: 200 });
    }

    if (!response) {
      response = `I can help you edit your resume! Try: **"add Python to skills"**, **"remove duplicate publications"**, or **"improve my experience bullets"**.`;
    }

    await ChatHistory.create({ userId: user._id, role: 'assistant', content: response, context: 'resume' });
    res.json({ response, aiUsed: isReady(), resumeChanged, resume: resumeChanged ? resume.toObject() : undefined });
  } catch (err) { next(err); }
});

// ── Temp tailor for job application (ONLY adds missing keywords to skills) ────
// IMPORTANT: This NEVER modifies experience bullets or any existing content.
// It ONLY appends the user-selected missing keywords to the skills list.
// The user's resume stays exactly as-is — only skills array is extended.
router.post('/:resumeId/tailor-temp', authenticateToken, async (req, res, next) => {
  try {
    const { jdText, selectedSkills, targetCareer } = req.body;
    const user = await User.findById(req.user._id);
    const resume = user.resumes.id(req.params.resumeId);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    // Build the modified resume — ONLY add missing skills, preserve everything else
    const existingSkills = resume.skills || user.skills || [];
    const skillsToAdd    = (selectedSkills || []).filter(s => !existingSkills.some(e => e.toLowerCase() === s.toLowerCase()));
    const updatedSkills  = [...existingSkills, ...skillsToAdd];

    // Temp resume: identical to original except skills list has new keywords added
    const tempResume = {
      ...resume.toObject(),
      skills:       updatedSkills,
      name:         resume.name, // keep original name — NOT "(Tailored)"
      experience:   resume.experience   || user.experience   || [], // UNCHANGED
      education:    resume.education    || user.education    || [], // UNCHANGED
      publications: resume.publications || user.publications || [], // UNCHANGED
      projects:     resume.projects     || user.projects     || [], // UNCHANGED
      certifications: resume.certifications || user.certifications || [], // UNCHANGED
      summary:      resume.summary      || user.summary      || '', // UNCHANGED
      targetCareer: targetCareer || resume.targetCareer,
      // Track what was added for the UI "Before / After / Boost" display
      _addedKeywords: skillsToAdd,
      _changesMade: skillsToAdd.length > 0
        ? [`Added ${skillsToAdd.length} keyword${skillsToAdd.length!==1?'s':''} to skills: ${skillsToAdd.join(', ')}`]
        : ['No changes needed — your resume already covers these skills'],
    };

    // Profile data needed by the resume paper component
    const profile = {
      name:         user.name         || '',
      phone:        user.phone        || '',
      location:     user.location     || '',
      email:        user.email        || '',
      linkedIn:     user.linkedIn     || '',
      github:       user.github       || '',
      portfolio:    user.portfolio    || '',
      skills:       updatedSkills,
      education:    user.education    || [],
      experience:   user.experience   || [],
      certifications: user.certifications || [],
      publications: user.publications || [],
      projects:     user.projects     || [],
    };

    res.json({
      tempResume,
      profile,
      addedKeywords: skillsToAdd,
      changesMade:   tempResume._changesMade,
      aiUsed:        false, // no AI used — pure additive operation only
    });
  } catch (err) { next(err); }
});

// ── Market roles (fetch from web or fallback list) ───────────────────────────
router.get('/market-roles', async (req, res) => {
  const MARKET_ROLES = [
    'Machine Learning Engineer','Software Engineer','Data Scientist','Full Stack Developer',
    'Cloud Engineer','AI Research Engineer','NLP Research Scientist','DevOps Engineer',
    'Cybersecurity Analyst','UX/UI Designer','Product Manager','MLOps Engineer',
    'LLM Engineer','Computer Vision Engineer','Deep Learning Engineer',
    'Site Reliability Engineer','Backend Engineer','Frontend Engineer',
    'Data Engineer','Security Engineer','Blockchain Engineer','Mobile Engineer',
    'Database Administrator','Platform Engineer','AI/ML Scientist',
    'Research Scientist','Quantitative Analyst','Robotics Engineer',
    'Embedded Systems Engineer','Network Engineer','Solution Architect',
    'Technical Program Manager','Developer Advocate','ML Platform Engineer',
    'Generative AI Engineer','AI Safety Researcher','Prompt Engineer',
    'Data Analyst','Business Intelligence Engineer','Analytics Engineer',
    'iOS Engineer','Android Engineer','Game Developer','Systems Engineer',
    'Infrastructure Engineer','Reliability Engineer','AI Infrastructure Engineer',
  ];
  res.json(MARKET_ROLES);
});

module.exports = router;

