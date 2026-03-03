const express = require('express');
const router  = express.Router();
const { Profile, Recommendation, ActivityLog } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// ─── Career Knowledge Base (UNCHANGED from original) ──────────────────────────
const CAREER_KNOWLEDGE_BASE = [
  {
    title: 'Software Engineer',
    category: 'Technology',
    requiredSkills: ['python', 'java', 'javascript', 'data structures', 'algorithms', 'git', 'sql'],
    relatedInterests: ['programming', 'technology', 'problem solving', 'software', 'coding'],
    educationMatch: ['computer science', 'software engineering', 'information technology'],
    description: 'Design, develop and maintain software systems and applications.',
    avgSalary: '$110,000',
    growth: 'High',
  },
  {
    title: 'Data Scientist',
    category: 'Data & Analytics',
    requiredSkills: ['python', 'machine learning', 'statistics', 'sql', 'data analysis', 'pandas', 'numpy', 'visualization'],
    relatedInterests: ['data', 'analytics', 'mathematics', 'research', 'ai', 'machine learning'],
    educationMatch: ['data science', 'statistics', 'mathematics', 'computer science'],
    description: 'Analyze complex datasets to extract insights and build predictive models.',
    avgSalary: '$120,000',
    growth: 'Very High',
  },
  {
    title: 'Full Stack Developer',
    category: 'Technology',
    requiredSkills: ['javascript', 'react', 'node.js', 'html', 'css', 'sql', 'rest api', 'git'],
    relatedInterests: ['web development', 'programming', 'design', 'technology', 'frontend', 'backend'],
    educationMatch: ['computer science', 'software engineering', 'web development'],
    description: 'Build and maintain complete web applications from frontend to backend.',
    avgSalary: '$105,000',
    growth: 'High',
  },
  {
    title: 'Cybersecurity Analyst',
    category: 'Security',
    requiredSkills: ['networking', 'linux', 'security', 'firewalls', 'penetration testing', 'python', 'risk assessment'],
    relatedInterests: ['security', 'networking', 'hacking', 'privacy', 'technology'],
    educationMatch: ['cybersecurity', 'computer science', 'information security', 'networking'],
    description: 'Protect systems and networks from cyber threats and security breaches.',
    avgSalary: '$100,000',
    growth: 'Very High',
  },
  {
    title: 'UX/UI Designer',
    category: 'Design',
    requiredSkills: ['figma', 'user research', 'wireframing', 'prototyping', 'design thinking', 'adobe xd', 'css'],
    relatedInterests: ['design', 'creativity', 'user experience', 'art', 'visual design'],
    educationMatch: ['design', 'human computer interaction', 'graphic design', 'psychology'],
    description: 'Design user interfaces and experiences for digital products.',
    avgSalary: '$90,000',
    growth: 'Medium',
  },
  {
    title: 'Cloud Engineer',
    category: 'Cloud & Infrastructure',
    requiredSkills: ['aws', 'azure', 'docker', 'kubernetes', 'linux', 'terraform', 'networking', 'python'],
    relatedInterests: ['cloud computing', 'infrastructure', 'devops', 'automation', 'technology'],
    educationMatch: ['computer science', 'information technology', 'networking'],
    description: 'Build and manage scalable cloud infrastructure and services.',
    avgSalary: '$115,000',
    growth: 'Very High',
  },
  {
    title: 'Machine Learning Engineer',
    category: 'AI & ML',
    requiredSkills: ['python', 'tensorflow', 'pytorch', 'machine learning', 'deep learning', 'mathematics', 'statistics', 'sql'],
    relatedInterests: ['ai', 'machine learning', 'research', 'mathematics', 'data science'],
    educationMatch: ['computer science', 'data science', 'mathematics', 'electrical engineering'],
    description: 'Develop and deploy machine learning models and AI solutions.',
    avgSalary: '$130,000',
    growth: 'Very High',
  },
  {
    title: 'Product Manager',
    category: 'Product & Business',
    requiredSkills: ['product strategy', 'agile', 'communication', 'analytics', 'roadmapping', 'stakeholder management'],
    relatedInterests: ['business', 'strategy', 'leadership', 'technology', 'innovation'],
    educationMatch: ['business', 'computer science', 'mba', 'engineering'],
    description: 'Lead product development from ideation to launch, aligning business and user needs.',
    avgSalary: '$125,000',
    growth: 'High',
  },
  {
    title: 'DevOps Engineer',
    category: 'Cloud & Infrastructure',
    requiredSkills: ['docker', 'kubernetes', 'ci/cd', 'linux', 'aws', 'python', 'bash', 'git'],
    relatedInterests: ['automation', 'infrastructure', 'devops', 'cloud', 'technology'],
    educationMatch: ['computer science', 'information technology', 'software engineering'],
    description: 'Bridge development and operations to enable fast, reliable software delivery.',
    avgSalary: '$108,000',
    growth: 'High',
  },
  {
    title: 'Business Analyst',
    category: 'Product & Business',
    requiredSkills: ['sql', 'excel', 'requirements analysis', 'documentation', 'communication', 'data analysis'],
    relatedInterests: ['business', 'analytics', 'problem solving', 'strategy', 'process improvement'],
    educationMatch: ['business', 'information systems', 'computer science', 'management'],
    description: 'Analyze business processes and requirements to improve systems and workflows.',
    avgSalary: '$80,000',
    growth: 'Medium',
  },
];

// ─── Skill Normalization (UNCHANGED) ──────────────────────────────────────────
const SKILL_ALIASES = {
  'js': 'javascript', 'reactjs': 'react', 'nodejs': 'node.js', 'py': 'python',
  'ml': 'machine learning', 'dl': 'deep learning', 'ds': 'data structures',
  'ui': 'user interface', 'ux': 'user experience', 'db': 'database',
  'c++': 'c++', 'golang': 'go', 'k8s': 'kubernetes',
};

function normalizeSkill(skill) {
  const s = skill.toLowerCase().trim();
  return SKILL_ALIASES[s] || s;
}

function normalizeSkills(skills) {
  return skills.map(normalizeSkill);
}

// ─── Recommendation Engine (UNCHANGED) ────────────────────────────────────────
function generateRecommendations(profile) {
  const userSkills    = normalizeSkills(profile.skills || []);
  const userInterests = (profile.interests || []).map(i => i.toLowerCase().trim());
  const userEducation = (profile.education || '').toLowerCase();
  const userGoals     = (profile.career_goals || '').toLowerCase();

  const scored = CAREER_KNOWLEDGE_BASE.map(career => {
    let score = 0;
    const reasoning     = [];
    const matchedSkills = [];
    const missingSkills = [];

    // Skill matching (50 pts max)
    career.requiredSkills.forEach(skill => {
      if (userSkills.some(us => us.includes(skill) || skill.includes(us))) {
        matchedSkills.push(skill);
        score += Math.floor(50 / career.requiredSkills.length);
      } else {
        missingSkills.push(skill);
      }
    });

    // Interest matching (30 pts max)
    let interestMatches = 0;
    career.relatedInterests.forEach(interest => {
      if (userInterests.some(ui => ui.includes(interest) || interest.includes(ui))) {
        interestMatches++;
      }
    });
    score += Math.floor((interestMatches / career.relatedInterests.length) * 30);

    // Education matching (15 pts)
    if (career.educationMatch.some(edu => userEducation.includes(edu))) {
      score += 15;
      reasoning.push('Your education background aligns with this career.');
    }

    // Goal matching (5 pts)
    if (
      career.title.toLowerCase().split(' ').some(w => userGoals.includes(w)) ||
      career.category.toLowerCase().split(' ').some(w => userGoals.includes(w))
    ) {
      score += 5;
      reasoning.push('This career aligns with your stated goals.');
    }

    if (matchedSkills.length > 0)
      reasoning.push(`You already have ${matchedSkills.length} of ${career.requiredSkills.length} required skills: ${matchedSkills.slice(0, 4).join(', ')}.`);
    if (interestMatches > 0)
      reasoning.push(`Your interests in ${userInterests.slice(0, 2).join(', ')} match this field.`);
    if (missingSkills.length > 0)
      reasoning.push(`To strengthen your profile, consider developing: ${missingSkills.slice(0, 3).join(', ')}.`);

    return {
      career_title:   career.title,
      category:       career.category,
      match_score:    Math.min(100, score),
      description:    career.description,
      avg_salary:     career.avgSalary,
      growth:         career.growth,
      matched_skills: matchedSkills,
      skill_gaps:     missingSkills,
      reasoning:      reasoning.join(' '),
    };
  });

  return scored.sort((a, b) => b.match_score - a.match_score).slice(0, 5);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Generate recommendations
router.post('/recommend', authenticateToken, async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user.id });
    if (!profile)
      return res.status(400).json({ error: 'Please complete your career profile first.' });

    const recommendations = generateRecommendations(profile);

    // Replace existing recommendations for this user
    await Recommendation.deleteMany({ userId: req.user.id });
    await Recommendation.insertMany(
      recommendations.map(r => ({ ...r, userId: req.user.id }))
    );

    await ActivityLog.create({ userId: req.user.id, action: 'CAREER_RECOMMEND' });
    res.json({ recommendations });
  } catch (err) {
    console.error('Recommend error:', err);
    res.status(500).json({ error: 'Server error generating recommendations.' });
  }
});

// Get saved recommendations
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const recs = await Recommendation.find({ userId: req.user.id }).sort({ match_score: -1 });
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching recommendations.' });
  }
});

// Browse all careers
router.get('/careers', authenticateToken, (req, res) => {
  res.json(CAREER_KNOWLEDGE_BASE);
});

module.exports = router;
