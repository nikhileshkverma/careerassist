const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { JobRole, Recommendation, ChatHistory, ActivityLog } = require('../models/index');
const { authenticateToken } = require('../middleware/auth');
const { scoreCareer, simulateWithSkill } = require('../utils/scoring');
const { careerCounselorChat, generateRoadmap } = require('../utils/ai_service');
const { isReady, getStatus, callOllamaDirectly } = require('../utils/ollama_setup');

// Comprehensive list of real job roles available in the market
const MARKET_JOB_ROLES = [
  'Machine Learning Engineer','Data Scientist','AI Research Scientist','NLP Engineer',
  'Computer Vision Engineer','Deep Learning Engineer','MLOps Engineer','AI Platform Engineer',
  'Software Engineer','Senior Software Engineer','Full Stack Developer','Backend Engineer',
  'Frontend Engineer','iOS Developer','Android Developer','React Native Developer',
  'Cloud Engineer','Site Reliability Engineer','DevOps Engineer','Platform Engineer',
  'Infrastructure Engineer','Solutions Architect','Cloud Architect','AWS Engineer',
  'Cybersecurity Engineer','Security Analyst','Penetration Tester','Security Researcher',
  'Data Engineer','Analytics Engineer','Business Intelligence Developer','Data Analyst',
  'Product Manager','Technical Product Manager','AI Product Manager','Growth PM',
  'UX Designer','UI Engineer','Product Designer','UX Researcher',
  'Quantitative Analyst','Risk Analyst','Financial Engineer','Algorithmic Trader',
  'Robotics Engineer','Autonomous Systems Engineer','Embedded Systems Engineer',
  'Blockchain Developer','Smart Contract Engineer','Web3 Developer',
  'Technical Program Manager','Engineering Manager','Staff Engineer','Principal Engineer',
  'Research Scientist','Applied Scientist','Research Engineer','AI Scientist',
  'Database Administrator','Database Engineer','PostgreSQL Engineer','MongoDB Engineer',
  'Network Engineer','Network Security Engineer','Systems Administrator',
  'Game Developer','Graphics Engineer','Simulation Engineer',
  'Bioinformatics Engineer','Computational Biology Researcher','Health AI Engineer',
  'LLM Engineer','Generative AI Engineer','RAG Engineer','Prompt Engineer',
];

// Generate recommendations
router.post('/recommend', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.skills?.length) return res.status(400).json({ error: 'Add skills to your profile first.' });
    const roles = await JobRole.find({ isActive: true });
    if (!roles.length) return res.status(400).json({ error: 'No job roles in DB. Run: npm run seed' });
    const scored = roles
      .map(r => scoreCareer(r, user.skills, user.interests, JSON.stringify(user.education||[]), user.careerGoals||''))
      .sort((a, b) => b.matchPercentage - a.matchPercentage).slice(0, 6);
    await Recommendation.deleteMany({ userId: user._id });
    await Recommendation.insertMany(scored.map(r => ({ userId: user._id, ...r })));
    await ActivityLog.create({ userId: user._id, action: 'CAREER_RECOMMEND' });
    res.json({ recommendations: scored });
  } catch (err) { next(err); }
});

router.get('/recommendations', authenticateToken, async (req, res, next) => {
  try { res.json(await Recommendation.find({ userId: req.user._id }).sort({ matchPercentage: -1 })); }
  catch (err) { next(err); }
});

router.post('/simulate', authenticateToken, async (req, res, next) => {
  try {
    // Support single skill (new_skill) OR multiple skills (new_skills array)
    const { new_skill, new_skills } = req.body;
    const skillList = new_skills?.length > 0 ? new_skills : (new_skill ? [new_skill] : []);
    if (!skillList.length) return res.status(400).json({ error: 'Provide at least one skill.' });

    const user  = await User.findById(req.user._id);
    const roles = await JobRole.find({ isActive: true });
    const baseSkills = user.skills || [];

    // Score BEFORE adding new skills
    const before = roles.map(r => ({
      roleId: r._id, roleName: r.roleName, icon: r.icon,
      score: require('../utils/scoring').scoreCareer(r, baseSkills, user.interests||[], '', user.careerGoals||'').matchPercentage,
    }));

    // Score AFTER adding all selected skills
    const augmented = [...new Set([...baseSkills, ...skillList])];
    const after = roles.map(r => ({
      roleId: r._id, roleName: r.roleName, icon: r.icon,
      score: require('../utils/scoring').scoreCareer(r, augmented, user.interests||[], '', user.careerGoals||'').matchPercentage,
    }));

    // Build simulation results
    const sims = roles.map((r, i) => ({
      careerTitle: r.roleName,
      icon: r.icon,
      beforeScore: before[i].score,
      afterScore: after[i].score,
      improvement: after[i].score - before[i].score,
    })).sort((a, b) => b.improvement - a.improvement).slice(0, 8);

    res.json({ new_skill: skillList.join(', '), new_skills: skillList, simulations: sims });
  } catch (err) { next(err); }
});

router.post('/roadmap', authenticateToken, async (req, res, next) => {
  try {
    const { roleId, roleName, missingSkills } = req.body;
    const user = await User.findById(req.user._id);
    const targetRole = roleName || 'Software Engineer';
    let aiRoadmap = null;
    if (isReady()) aiRoadmap = await generateRoadmap(missingSkills || [], targetRole, user.skills || []);
    if (aiRoadmap) return res.json({ roadmap: aiRoadmap, aiUsed: true });
    const roadmap = {
      aiUsed: false,
      missing_skills: (missingSkills||[]).map(s => buildSkillResources(s, targetRole)),
      learning_roadmap: ['Step 1: Strengthen your existing core skills first', ...(missingSkills||[]).slice(0,4).map((s,i)=>`Step ${i+2}: Learn ${s} through structured online courses`), 'Build 2-3 portfolio projects', 'Apply for positions'],
      estimated_time: `${Math.ceil((missingSkills?.length||1)*1.5)} months`, priority_skill: missingSkills?.[0]||'',
    };
    res.json({ roadmap, aiUsed: false });
  } catch (err) { next(err); }
});

// ── Career Counselor Chat ─────────────────────────────────────────────────────
router.post('/counsel', authenticateToken, async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required.' });
    const user = await User.findById(req.user._id).select('-passwordHash');
    const recs = await Recommendation.find({ userId: req.user._id }).sort({ matchPercentage: -1 }).limit(6);
    const top = recs[0];

    const userContext = {
      name: user.name, skills: user.skills || [], careerGoals: user.careerGoals || '',
      topCareer: top?.careerTitle || '', topScore: top?.matchPercentage || 0,
      missingSkills: top?.missingSkills || [],
      education: Array.isArray(user.education) ? user.education.map(e => e.degree || e.institution).join(', ') : '',
      allRecs: recs.slice(0, 4).map(r => `${r.careerTitle} (${r.matchPercentage}%)`),
    };

    let response = null, aiUsed = false;

    if (isReady()) {
      const msgHistory = (history || []).slice(-8).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
      msgHistory.push({ role: 'user', content: message });
      response = await careerCounselorChat(msgHistory, userContext);
      if (response) aiUsed = true;
    }

    if (!response) {
      // Comprehensive rule-based that feels natural
      const m = message.toLowerCase();
      const skillList = (user.skills || []).slice(0, 6).join(', ') || 'none added yet';

      if (/^(hi|hello|hey|howdy|good morning|good afternoon)/.test(m)) {
        response = `Hey ${user.name?.split(' ')[0]}! 👋 Great to see you. I'm here to help with your career journey.\n\nLooking at your profile, you have ${user.skills?.length || 0} skills listed. ${top ? `Your strongest match right now is **${top.careerTitle}** at **${top.matchPercentage}%**. ` : ''}What would you like to work on today — job strategy, skill gaps, resume tips, or interview prep?`;
      } else if (/career|match|recommend|path|fit|role/.test(m)) {
        if (!top) {
          response = `Let me check your career matches! To get personalized recommendations, head to the Career Counselor page and click "Generate Matches." Once you do, I can give you much more specific guidance based on your actual fit scores.`;
        } else {
          response = `Based on your profile, here's how you stack up:\n\n${recs.slice(0, 4).map((r, i) => `**${i+1}. ${r.careerTitle}** — ${r.matchPercentage}% match\n   ${r.growth === 'Very High' ? '📈 Very High growth' : r.growth === 'High' ? '📈 High growth' : '📊 Stable'} · ${r.avgSalary || 'Competitive salary'}`).join('\n\n')}\n\nYour strongest match is **${top.careerTitle}**. ${top.recommendationText} Want me to dive deeper into any of these, or discuss how to close the gap on your top choice?`;
        }
      } else if (/skill gap|missing|need to learn|what.*learn|improve/.test(m)) {
        const gaps = top?.missingSkills || [];
        if (!top) {
          response = `To identify your skill gaps accurately, generate career matches first. Then I can tell you exactly what to learn for each role and point you to the best resources.`;
        } else if (gaps.length === 0) {
          response = `Honestly? You're in great shape for **${top.careerTitle}** — no major skill gaps! At ${top.matchPercentage}% match, you're a strong candidate. I'd focus on deepening expertise in your strongest skills and building 1-2 impressive portfolio projects. That'll take you from a solid candidate to a standout one.`;
        } else {
          response = `For **${top.careerTitle}** (your top match at ${top.matchPercentage}%), here are the gaps to close:\n\n${gaps.slice(0, 5).map((g, i) => `**${i+1}. ${g}**\n   → Google: "${g} tutorial step by step"\n   → YouTube: "${g} full course for beginners"`).join('\n\n')}\n\nI'd tackle **${gaps[0]}** first — it has the highest impact on your match score. Expect 4-6 weeks to get job-ready. Want a detailed week-by-week study plan?`;
        }
      } else if (/resume|cv|ats|keyword/.test(m)) {
        response = `Here's what I know about your resume situation:\n\nYou have **${user.skills?.length || 0} skills** in your profile. ${top ? `For **${top.careerTitle}**, the key ATS keywords you should be hitting are: ${(top.presentSkills || []).slice(0, 4).join(', ')}. ` : ''}\n\n**Quick wins to improve your ATS score:**\n• Use exact keywords from the job description (not synonyms)\n• Quantify achievements: "Improved X by 30%" beats "Improved X significantly"\n• Go to Resume & AI → JD Analysis to see your exact match % for any job\n\nWant me to help you optimize for a specific role?`;
      } else if (/interview|prep|question|prepare|practice/.test(m)) {
        const role = top?.careerTitle || 'Software Engineer';
        response = `Let me help you prep for **${role}** interviews specifically.\n\n**Technical rounds to prepare for:**\n${(user.skills || []).slice(0, 3).map(s => `• **${s}**: Be ready for both theory and practical coding questions`).join('\n')}\n\n**Behavioral questions you'll almost certainly get:**\n• "Tell me about a time you faced a technical challenge" → use your ${(user.experience || [])[0]?.company || 'most recent role'} experience\n• "How do you stay current with AI/ML trends?"\n• "Describe your approach to debugging a complex system"\n\n**The STAR method works best:** Situation → Task → Action → Result\n\nWhich company or role are you interviewing for? I can give you more targeted prep.`;
      } else if (/salary|pay|negotiate|compensation|offer/.test(m)) {
        response = `Great question — salary negotiation is where a lot of people leave money on the table. Here's what the market looks like for your top matches:\n\n${recs.slice(0, 4).map(r => `• **${r.careerTitle}**: ${r.avgSalary || '~$90K-$150K'}/year`).join('\n')}\n\n**Negotiation playbook:**\n1. Never give a number first — "I'm flexible, what's the range for this role?"\n2. Use competing offers or market data: "Glassdoor shows $X for this role in this market"\n3. Negotiate everything: base + equity + signing bonus + PTO\n4. Get it in writing before accepting\n\nWith ${user.skills?.length || 0} skills and your background, you're in a strong position. What offer are you working with?`;
      } else if (/roadmap|plan|step|how.*become|transition/.test(m)) {
        response = `Here's a realistic roadmap to becoming a **${top?.careerTitle || 'top tech professional'}**:\n\n**Where you are:** ${top?.matchPercentage || 0}% match, ${user.skills?.length || 0} relevant skills\n\n**Phase 1 (Weeks 1-4): Fill the gaps**\n${(top?.missingSkills || []).slice(0, 2).map(s => `• Learn **${s}** — 10 hrs/week is enough to get job-ready`).join('\n')}\n\n**Phase 2 (Weeks 5-8): Build proof**\n• Create 1-2 projects showing your new skills\n• Push to GitHub, write a short blog post about it\n\n**Phase 3 (Month 3): Apply**\n• Tailor your resume for each application\n• Target companies with good match scores in our Jobs section\n• Aim for 10-15 applications per week\n\nThe biggest mistake people make? Waiting until they feel "ready." Start applying at Phase 2. Want help with any specific phase?`;
      } else if (/job.*search|apply|application|finding job/.test(m)) {
        response = `Let me give you a concrete job search strategy based on your profile.\n\nYour profile shows **${user.skills?.length || 0} skills** — that puts you in a ${(user.skills?.length || 0) >= 8 ? 'strong' : 'developing'} position for most roles.\n\n**Where to apply:**\n• Check the **Jobs** section — scores are calculated from your actual skills\n• Filter for "Strong Match" and "Good Match" first\n• "Be an early applicant" jobs are gold — apply within 24 hours of posting\n\n**Weekly rhythm that works:**\n• Monday: Research 20 jobs, identify top 10\n• Tuesday-Wednesday: Apply to 5-7 with tailored resumes\n• Thursday: Follow up, LinkedIn outreach\n• Friday: Review what's working, adjust\n\nQuality over quantity. 5 tailored applications beats 50 generic ones every time.`;
      } else {
        response = `Good question! Let me think through this with you.\n\n${message.toLowerCase().includes('?') ? "Here's my take: " : "Here's what I'd suggest: "}Your profile (${user.skills?.length || 0} skills, ${(user.experience || []).length} positions) ${top ? `puts you at **${top.matchPercentage}% match** for ${top.careerTitle}` : 'is building toward strong career matches'}.\n\nI can help you dive deep on:\n• **Career strategy** — which roles to target and why\n• **Skill development** — what to learn next and how\n• **Job applications** — tailoring your approach for higher response rates\n• **Interview prep** — role-specific technical and behavioral questions\n• **Salary negotiation** — how to maximize your offer\n\nWhat would be most useful right now?`;
      }
    }

    await ChatHistory.create({ userId: user._id, role: 'user', content: message, context: 'career' });
    await ChatHistory.create({ userId: user._id, role: 'assistant', content: response, context: 'career' });
    res.json({ response, aiUsed, ollamaStatus: getStatus() });
  } catch (err) { next(err); }
});

router.get('/counsel/history', authenticateToken, async (req, res, next) => {
  try { res.json(await ChatHistory.find({ userId: req.user._id, context: 'career' }).sort({ createdAt: 1 }).limit(50)); }
  catch (err) { next(err); }
});

router.delete('/counsel/history', authenticateToken, async (req, res, next) => {
  try { await ChatHistory.deleteMany({ userId: req.user._id, context: 'career' }); res.json({ message: 'Cleared.' }); }
  catch (err) { next(err); }
});

router.get('/careers', authenticateToken, async (req, res, next) => {
  try { res.json(await JobRole.find({ isActive: true }).select('-__v')); }
  catch (err) { next(err); }
});

// Get all market job roles (for JD analysis dropdown)
router.get('/market-roles', authenticateToken, (req, res) => {
  res.json(MARKET_JOB_ROLES.sort());
});

router.get('/ai-status', (req, res) => res.json({ ...getStatus(), ready: isReady() }));

module.exports = router;
