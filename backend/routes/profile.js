const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ActivityLog } = require('../models/index');
const { authenticateToken } = require('../middleware/auth');
const { parseResumeText } = require('../utils/resume_parser');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination: (r,f,cb)=>cb(null,UPLOAD_DIR), filename: (r,f,cb)=>cb(null,`${Date.now()}-${f.originalname}`) }), limits: { fileSize: 15*1024*1024 } });

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  try {
    if (ext === '.txt') return fs.readFileSync(filePath, 'utf-8');
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      // Use Buffer for reliable cross-platform PDF parsing
      const buf = fs.readFileSync(filePath);
      const data = await pdfParse(buf, { max: 0 }); // max:0 = all pages
      const text = data.text || '';
      if (text.trim().length < 20) {
        // Try alternate approach for scanned/odd PDFs
        console.warn('[Profile Parser] PDF extracted very little text:', text.length, 'chars');
      }
      return text;
    }
    if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    }
  } catch (e) {
    console.error('[Profile Parser] Extraction error for', originalName, ':', e.message);
    // Try fallback: read raw bytes and extract printable text
    try {
      const raw = fs.readFileSync(filePath, 'latin1');
      const printable = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ');
      if (printable.trim().length > 100) return printable;
    } catch {}
  }
  return '';
}

router.get('/', authenticateToken, async (req, res, next) => {
  try { res.json(await User.findById(req.user._id).select('-passwordHash')); }
  catch (err) { next(err); }
});

const smartDedup = (arr) => {
  if (!Array.isArray(arr)) return arr;
  const seen = new Set();
  return arr.filter(item => {
    const key = (typeof item === 'object' ? JSON.stringify(item) : String(item)).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
};

router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const allowed = ['name','phone','location','linkedIn','github','portfolio','summary','skills','interests','certifications','publications','education','experience','projects','careerGoals'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    // Auto-dedup array fields on every save
    ['certifications','publications','skills'].forEach(f => { if (updates[f]) updates[f] = smartDedup(updates[f]); });
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true }).select('-passwordHash');
    await ActivityLog.create({ userId: req.user._id, action: 'PROFILE_UPDATE' });

    // Auto-regenerate career recommendations if skills changed
    // This ensures jobs re-score immediately with the new profile
    const skillsChanged = req.body.skills !== undefined;
    if (skillsChanged && (user.skills || []).length > 0) {
      try {
        const { JobRole, Recommendation } = require('../models/index');
        const { scoreCareer } = require('../utils/scoring');
        const roles = await JobRole.find({ isActive: true });
        if (roles.length > 0) {
          const scored = roles
            .map(r => scoreCareer(r, user.skills, user.interests, JSON.stringify(user.education||[]), user.careerGoals||''))
            .sort((a, b) => b.matchPercentage - a.matchPercentage)
            .slice(0, 6);
          await Recommendation.deleteMany({ userId: user._id });
          await Recommendation.insertMany(scored.map(r => ({ userId: user._id, ...r })));
        }
      } catch (e) { /* non-fatal - recommendations will update next time user visits career page */ }
    }

    res.json({ message: 'Profile saved! Job recommendations updated.', user, recommendationsRefreshed: skillsChanged });
  } catch (err) { next(err); }
});

// ── Parse resume and auto-fill profile ───────────────────────────────────────
router.post('/parse-resume', authenticateToken, upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const text = await extractText(req.file.path, req.file.originalname);
    fs.unlink(req.file.path, () => {});

    if (!text || text.length < 50) {
      return res.json({
        parsed: {},
        confidence: 0,
        message: `Could not extract readable text from ${req.file.originalname}. Make sure the PDF is text-based (not scanned). Try re-saving as PDF from Word.`
      });
    }

    const parsed = parseResumeText(text);

    // Confidence scoring
    let confidence = 0;
    const checks = [
      [parsed.name && parsed.name.length > 2, 15],
      [parsed.email, 15],
      [parsed.phone, 10],
      [parsed.skills.length >= 5, 15],
      [parsed.skills.length >= 15, 10],
      [parsed.experience.length >= 1, 15],
      [parsed.experience.length >= 2, 5],
      [parsed.education.length >= 1, 10],
      [parsed.summary && parsed.summary.length > 20, 5],
    ];
    checks.forEach(([cond, pts]) => { if (cond) confidence += pts; });

    // Auto-update base profile with parsed data if better
    const user = await User.findById(req.user._id);
    const updates = {};
    if (parsed.name && !user.name) updates.name = parsed.name;
    if (parsed.phone && !user.phone) updates.phone = parsed.phone;
    if (parsed.linkedIn && !user.linkedIn) updates.linkedIn = parsed.linkedIn;
    if (parsed.github && !user.github) updates.github = parsed.github;
    if (parsed.summary && !user.summary) updates.summary = parsed.summary;
    if (parsed.skills.length > (user.skills||[]).length) {
      updates.skills = [...new Set([...(user.skills||[]), ...parsed.skills])].slice(0, 80);
    }
    if (parsed.experience.length > 0 && (!user.experience || user.experience.length === 0)) updates.experience = parsed.experience;
    if (parsed.education.length > 0 && (!user.education || user.education.length === 0)) updates.education = parsed.education;
    if (parsed.projects.length > 0 && (!user.projects || user.projects.length === 0)) updates.projects = parsed.projects;
    // Smart dedup: normalize strings, keep only unique entries
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,40);
    const smartDedup = (existing, incoming) => {
      const seen = new Set((existing||[]).map(s => normalize(typeof s==='object'?(s.name||s.title||''):s)));
      const merged = [...(existing||[])];
      for (const item of incoming) {
        const str = typeof item==='object'?(item.name||item.title||''):item;
        if (str && !seen.has(normalize(str))) { seen.add(normalize(str)); merged.push(str); }
      }
      return merged.slice(0, 20);
    };
    if (parsed.certifications.length > 0) {
      const certStrings = parsed.certifications.map(c => typeof c === 'object' ? c.name || '' : c).filter(Boolean);
      updates.certifications = smartDedup(user.certifications||[], certStrings);
    }
    if (parsed.publications.length > 0) {
      const pubStrings = parsed.publications.map(p => typeof p === 'object' ? p.title || '' : p).filter(Boolean);
      updates.publications = smartDedup(user.publications||[], pubStrings);
    }
    if (Object.keys(updates).length > 0) await User.findByIdAndUpdate(req.user._id, { $set: updates });

    await ActivityLog.create({ userId: req.user._id, action: 'RESUME_PARSE', details: { confidence, skillsFound: parsed.skills.length } });
    res.json({ parsed, confidence, rawLength: text.length, message: confidence >= 60 ? 'Profile auto-filled successfully!' : 'Partial data extracted — please review and complete manually.' });
  } catch (err) { next(err); }
});

router.post('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ error: 'Current password incorrect.' });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password changed.' });
  } catch (err) { next(err); }
});

module.exports = router;
