const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { ResumeFeedback, Profile, ActivityLog } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// ─── Multer Storage ────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, TXT files allowed.'));
  },
});

// ─── Resume Analysis Engine (UNCHANGED logic) ─────────────────────────────────
function analyzeResume(filename, profile) {
  // profile.skills is now a native array (not JSON string) thanks to Mongoose
  const userSkills  = profile?.skills || [];
  const careerGoals = profile?.career_goals || '';

  const feedback = {
    overall_score: 0,
    sections:      [],
    strengths:     [],
    improvements:  [],
    career_alignment: '',
  };

  // File format check
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') {
    feedback.sections.push({ name: 'File Format', status: 'Good', note: 'PDF format is professional and universally accepted.' });
    feedback.overall_score += 10;
  } else if (ext === '.docx') {
    feedback.sections.push({ name: 'File Format', status: 'Good', note: 'DOCX is widely accepted.' });
    feedback.overall_score += 8;
  } else {
    feedback.sections.push({ name: 'File Format', status: 'Needs Improvement', note: 'Consider converting to PDF for professional submission.' });
    feedback.overall_score += 4;
  }

  // Skills coverage
  if (userSkills.length >= 8) {
    feedback.sections.push({ name: 'Skills Coverage', status: 'Excellent', note: `You have ${userSkills.length} skills listed — strong technical breadth.` });
    feedback.overall_score += 20;
    feedback.strengths.push('Strong skills portfolio with broad technical coverage.');
  } else if (userSkills.length >= 4) {
    feedback.sections.push({ name: 'Skills Coverage', status: 'Good', note: `${userSkills.length} skills listed. Consider adding more relevant skills.` });
    feedback.overall_score += 12;
  } else {
    feedback.sections.push({ name: 'Skills Coverage', status: 'Needs Improvement', note: 'Limited skills listed. Expand your technical skills section.' });
    feedback.overall_score += 4;
    feedback.improvements.push('Add more technical skills aligned with your target career.');
  }

  // Experience
  const exp = profile?.experience || '';
  if (exp.length > 150) {
    feedback.sections.push({ name: 'Experience', status: 'Good', note: 'Experience section has adequate detail.' });
    feedback.overall_score += 25;
    feedback.strengths.push('Detailed experience description demonstrates career depth.');
  } else if (exp.length > 50) {
    feedback.sections.push({ name: 'Experience', status: 'Fair', note: 'Experience could be more detailed. Add specific achievements and metrics.' });
    feedback.overall_score += 15;
    feedback.improvements.push('Quantify your achievements (e.g., "Improved performance by 30%").');
  } else {
    feedback.sections.push({ name: 'Experience', status: 'Needs Improvement', note: 'No or minimal experience listed. Even academic projects count.' });
    feedback.overall_score += 5;
    feedback.improvements.push('Add internships, projects, or academic work to your experience.');
  }

  // Education
  const edu = profile?.education || '';
  if (edu.length > 20) {
    feedback.sections.push({ name: 'Education', status: 'Good', note: 'Education section present.' });
    feedback.overall_score += 15;
  } else {
    feedback.sections.push({ name: 'Education', status: 'Needs Improvement', note: 'Add full educational details including degree, institution, and year.' });
    feedback.overall_score += 5;
    feedback.improvements.push('Include your full degree name, institution, and graduation year.');
  }

  // Career goal
  if (careerGoals) {
    feedback.sections.push({ name: 'Career Objective', status: 'Good', note: 'Career goals are defined.' });
    feedback.overall_score += 10;
    feedback.career_alignment = `Your resume appears aligned with your goal: "${careerGoals.substring(0, 80)}..."`;
    feedback.strengths.push('Clear career objective adds direction to your resume.');
  } else {
    feedback.sections.push({ name: 'Career Objective', status: 'Missing', note: 'Add a concise career objective or professional summary.' });
    feedback.improvements.push('Add a 2-3 sentence professional summary at the top of your resume.');
  }

  feedback.improvements.push('Use action verbs to start bullet points (e.g., "Developed", "Led", "Implemented").');
  feedback.improvements.push('Tailor your resume keywords to match the job description you are applying for.');
  feedback.overall_score = Math.min(100, feedback.overall_score);
  return feedback;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Upload and analyze resume
router.post('/upload', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const profile  = await Profile.findOne({ userId: req.user.id });
    const feedback = analyzeResume(req.file.originalname, profile);

    await ResumeFeedback.create({
      userId:   req.user.id,
      filename: req.file.originalname,
      feedback,
      score:    feedback.overall_score,
    });

    await ActivityLog.create({ userId: req.user.id, action: 'RESUME_UPLOAD' });
    res.json({ message: 'Resume analyzed successfully.', feedback, filename: req.file.originalname });
  } catch (err) {
    console.error('Resume upload error:', err);
    res.status(500).json({ error: 'Server error analyzing resume.' });
  }
});

// Get resume feedback history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const history = await ResumeFeedback.find({ userId: req.user.id })
      .select('filename score createdAt')
      .sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching history.' });
  }
});

// Get specific feedback
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const record = await ResumeFeedback.findOne({ _id: req.params.id, userId: req.user.id });
    if (!record) return res.status(404).json({ error: 'Not found.' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
