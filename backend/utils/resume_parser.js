/**
 * resume_parser.js — built from the ACTUAL PDF text extracted by pdfplumber/pdf-parse.
 * 
 * The PDF produces clean line-by-line text. Key patterns observed:
 *
 * EDUCATION section:
 *   "Master in Computer Science. Aug 2024 - Present"
 *   "Texas A&M University – Corpus Christi, Texas, United States."
 *   -- Pattern: degree line with trailing date, then institution on next line
 *
 * PROFESSIONAL EXPERIENCE:
 *   "Graduate Research Assistant | Texas A&M University-Corpus Christi, Texas, USA Jan 2025 – Present"
 *   "Research Project 2: Thunderstorm Prediction Expansion Present"   ← sub-header (NOT a new job)
 *   "• bullet"
 *   "Research Project 1: AI Security (CAHSI–Google Project). Completed"  ← sub-header
 *   "• bullet"
 *   "Cloud System Administrator – Infra, Support and sales Team Dec 2022 - Feb 2024"
 *   "Katalyst Business Solutions Pvt Ltd, Ghansoli, Navi Mumbai, India"  ← company on next line
 *   "• bullet"
 *
 * TECHNICAL SKILLS:
 *   "• Programming languages: C, C++, ..."
 *   "• Cloud-based Technology: AWS Cloud, Microsoft Azure, ..."
 *   -- Bullet-prefixed category lines
 *
 * COURSES AND CERTIFICATIONS:
 *   "• Microsoft — Security, Compliance, and Identity Fundamentals (Jul 2022)"
 *
 * ACADEMIC PROJECTS:
 *   "EmotionWave: An Emotion-Aware Chatbot System – Human-Computer Interaction"
 *   "• bullet"
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cleanText(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2013\u2014\u2015]/g, ' - ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25AA\u25B8]/g, '•')
    .replace(/\t/g, ' ')
    .replace(/[ ]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

const SECTION_NAMES = {
  // ALL-CAPS variants
  'EDUCATION': 'education',
  'EDUCATION & CERTIFICATIONS': 'education',
  'EDUCATION AND CERTIFICATIONS': 'education',
  'EDUCATIONAL BACKGROUND': 'education',
  'ACADEMIC BACKGROUND': 'education',
  'PROFESSIONAL EXPERIENCE': 'experience',
  'WORK EXPERIENCE': 'experience',
  'WORK HISTORY': 'experience',
  'EXPERIENCE': 'experience',
  'EMPLOYMENT HISTORY': 'experience',
  'CAREER HISTORY': 'experience',
  'TECHNICAL SKILLS': 'skills',
  'SKILLS': 'skills',
  'CORE SKILLS': 'skills',
  'KEY SKILLS': 'skills',
  'SKILLS & TECHNOLOGIES': 'skills',
  'SKILLS AND TECHNOLOGIES': 'skills',
  'TECHNOLOGIES': 'skills',
  'TECHNICAL EXPERTISE': 'skills',
  'ACADEMIC PROJECTS': 'projects',
  'OPEN-SOURCE PROJECTS': 'projects',
  'PROJECTS': 'projects',
  'PERSONAL PROJECTS': 'projects',
  'KEY PROJECTS': 'projects',
  'RESEARCH PROJECTS': 'projects',
  'PUBLICATIONS': 'publications',
  'RESEARCH PUBLICATIONS': 'publications',
  'PAPERS': 'publications',
  'COURSES AND CERTIFICATIONS': 'certifications',
  'CERTIFICATIONS': 'certifications',
  'COURSES & CERTIFICATIONS': 'certifications',
  'CERTIFICATES': 'certifications',
  'LICENSES & CERTIFICATIONS': 'certifications',
  'LICENSES AND CERTIFICATIONS': 'certifications',
  'LEADERSHIP & EXTRACURRICULAR ACTIVITIES': 'leadership',
  'LEADERSHIP': 'leadership',
  'EXTRACURRICULAR': 'leadership',
  'SUMMARY': 'summary',
  'PROFESSIONAL SUMMARY': 'summary',
  'CAREER SUMMARY': 'summary',
  'OBJECTIVE': 'summary',
  'CAREER OBJECTIVE': 'summary',
  'PROFILE': 'summary',
  'ABOUT': 'summary',
  'AWARDS': 'awards',
  'HONORS': 'awards',
  'ACHIEVEMENTS': 'awards',
  'INTERESTS': 'interests',
  'LANGUAGES': 'skills',
};

// Build lowercase lookup for fast matching
const SECTION_NAMES_LOWER = {};
for (const [k, v] of Object.entries(SECTION_NAMES)) {
  SECTION_NAMES_LOWER[k.toLowerCase()] = v;
}

function getSectionKey(line) {
  const raw = line.trim();
  const upper = raw.toUpperCase().replace(/[–\-–]/g, '-').replace(/\s+/g, ' ');
  const lower = raw.toLowerCase().replace(/[–\-–]/g, '-').replace(/\s+/g, ' ');

  // Try uppercase exact match
  if (SECTION_NAMES[upper]) return SECTION_NAMES[upper];
  // Try lowercase exact match (catches Title Case, mixed)
  if (SECTION_NAMES_LOWER[lower]) return SECTION_NAMES_LOWER[lower];

  // Prefix match (uppercase)
  for (const [name, key] of Object.entries(SECTION_NAMES)) {
    if (upper.startsWith(name)) return key;
  }
  // Prefix match (lowercase)
  for (const [name, key] of Object.entries(SECTION_NAMES_LOWER)) {
    if (lower.startsWith(name)) return key;
  }
  return null;
}

function isSectionHeader(line) {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  // If it matches a known section name at any case — it's a header
  if (getSectionKey(t) !== null) return true;
  return false;
}

function splitSections(text) {
  const lines = text.split('\n');
  const sections = {};
  let curKey = null;
  let buf = [];

  const flush = () => {
    if (curKey && buf.length > 0) {
      sections[curKey] = (sections[curKey] || []).concat(buf);
    }
    buf = [];
  };

  for (const line of lines) {
    if (isSectionHeader(line)) {
      flush();
      curKey = getSectionKey(line);
    } else if (curKey) {
      buf.push(line);
    }
  }
  flush();

  const result = {};
  for (const [k, v] of Object.entries(sections)) {
    result[k] = v.join('\n').trim();
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────────────────────────────────────

function parseContact(text) {
  const top = text.slice(0, 2000);
  const email    = top.match(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/)?.[0] || '';
  const phone    = top.match(/(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/)?.[0]?.trim() || '';
  const liM      = top.match(/linkedin\.com\/in\/([\w\-_%]+)/i);
  const ghM      = top.match(/github\.com\/([\w\-]+)/i);
  const linkedIn = liM ? `linkedin.com/in/${liM[1]}` : '';
  const github   = ghM ? `github.com/${ghM[1]}` : '';
  const locM     = top.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)?,\s*(?:US|USA|TX|CA|NY|WA|Texas|California|India))\b/);
  const location = locM ? locM[0] : '';
  return { email, phone, linkedIn, github, location, portfolio: '' };
}

function parseName(lines) {
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const l = lines[i].trim();
    if (!l || l.length < 3 || l.length > 70) continue;
    if (l.includes('@') || /^\d/.test(l) || l.includes('http') || l.includes('|')) continue;
    if (/^[A-Z][A-Z\s\-.]{4,60}$/.test(l) && l.split(/\s+/).length >= 2) return l.trim();
    if (/^[A-Z][a-z]+(?: [A-Z][a-z]+){1,4}$/.test(l)) return l.trim();
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Education
// Pattern: "Degree text. MonthYear - EndDate" then "Institution, Location"
// ─────────────────────────────────────────────────────────────────────────────

function parseEducation(text) {
  if (!text) return [];

  const DATE_RE = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*[-–]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current)\b/i;
  const YEAR_RE = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\b/;

  const DEGREE_WORDS = /(?:Master|Bachelor|Doctor|PhD|M\.S\.|B\.S\.|B\.E\.|M\.E\.|MBA|BCA|MCA|B\.Tech|M\.Tech|Diploma|Associate|Engineer|Computer\s+Science|Engineering)/i;
  const INST_WORDS   = /(?:University|College|Institute|School|Academy|Texas\s+A&?M|TAMU|MIT|IIT)/i;

  const lines = text.split('\n').filter(l => l.trim());
  const entries = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip bullet lines
    if (/^[•\-\*]/.test(line)) { i++; continue; }

    // Check if this is a degree line (has degree keywords AND a date/year, OR ends with a year)
    const hasDegreeWord = DEGREE_WORDS.test(line);
    const hasDate = DATE_RE.test(line) || YEAR_RE.test(line);
    // Institution-only lines: "G.V. Acharya Institute..." — no date, just institution
    const isInstOnly = INST_WORDS.test(line) && !hasDate && !hasDegreeWord;

    if (hasDegreeWord && (hasDate || line.length < 80)) {
      // Skip if it looks like an institution line being picked up by engineering keyword
      // "G.V. Acharya Institute of Engineering" has Engineering but it's an institution
      if (INST_WORDS.test(line) && !DATE_RE.test(line) && !line.match(/^(?:Master|Bachelor|Diploma|Doctor|PhD|BCA|MCA|B\.Tech|M\.Tech)/i)) {
        i++; continue;
      }

      const entry = { degree: '', institution: '', location: '', startDate: '', endDate: '', gpa: '' };

      const dm = line.match(DATE_RE);
      if (dm) { entry.startDate = dm[1]; entry.endDate = dm[2]; }
      else { const ym = line.match(YEAR_RE); if (ym) entry.endDate = ym[1]; }

      // Degree = line text without the date
      entry.degree = line.replace(DATE_RE, '').replace(YEAR_RE, '').replace(/\.$/, '').trim();

      // Next line = institution (if it doesn't look like another degree)
      if (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        const nextHasDeg = line.match(/^(?:Master|Bachelor|Diploma|Doctor|PhD)/i);
        if (!DATE_RE.test(next) && !/^[•\-\*]/.test(next) && next.length < 120) {
          if (INST_WORDS.test(next) || next.includes(',')) {
            const locParts = next.split(',');
            entry.institution = locParts[0].replace(/\.$/, '').trim();
            if (locParts.length > 1) entry.location = locParts.slice(1).join(',').replace(/\.$/, '').trim();
            i++;
          }
        }
      }

      if (entry.degree) entries.push(entry);
    }
    i++;
  }

  return entries.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Experience
// Pattern observed from ACTUAL PDF:
//   "Title | Company, Location Date - Date"  (pipe format, date at end of same line)
//   "Title - Subtitle Date - Date"           (dash format, then company on next line)
//   "Research Project N: Name" lines are SUB-HEADERS within a job, not new jobs
// ─────────────────────────────────────────────────────────────────────────────

function parseExperience(text) {
  if (!text) return [];

  // Matches: "Jan 2023 - Present", "2023 - 2024", "05/2023 - Present", "2023/05 - 2024/01"
  const DATE_RE = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}\/\d{2}|\d{4})\s*[-–—]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}\/\d{2}|\d{4}|Present|Current|Now)\b/i;

  // Lines that indicate a new job (have title keywords + date)
  const JOB_TITLE_RE = /(?:Engineer|Developer|Scientist|Manager|Analyst|Designer|Architect|Consultant|Director|Assistant|Research\s+Assistant|Intern|Lead|Senior|Principal|Founder|Administrator|Specialist|Officer|Coordinator)/i;

  // Lines that are sub-project headings WITHIN a job (should become bullets)
  const SUBPROJECT_RE = /^Research\s+Project\s*\d*\s*[:–-]/i;

  const entries = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let entry = null;

  const flush = () => {
    if (!entry) return;
    // Clean up title and company — strip any trailing date fragments
    entry.title   = entry.title.replace(DATE_RE, '').replace(/\s*\d{1,2}\/\d{4}\s*$/, '').replace(/[-–.\s]+$/, '').trim();
    entry.company = entry.company.replace(DATE_RE, '').replace(/\s*\d{1,2}\/\d{4}\s*$/, '').replace(/[-–.\s]+$/, '').trim();
    // If title looks like a company (Pvt Ltd, Inc, etc.) and company is empty, swap
    if (/(?:Pvt\.?\s*Ltd|Inc\.?|LLC|Corp\.?|Solutions|Business|Technologies|Systems)/i.test(entry.title) && !entry.company) {
      entry.company = entry.title;
      entry.title   = '';
    }
    if (entry.title || entry.company || entry.bullets.length > 0) {
      entries.push(entry);
    }
    entry = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[•\-\*◦▸►]/.test(line);

    // Sub-project headings within a job → convert to a bold bullet note
    if (SUBPROJECT_RE.test(line) && entry) {
      const subName = line.replace(SUBPROJECT_RE, '').replace(/\.\s*(Completed|Present|Ongoing)\s*$/i, '').trim();
      entry.bullets.push(`[${subName}]`);
      continue;
    }

    if (isBullet) {
      if (!entry) {
        // Bullet without header — start a generic entry
        entry = { title: '', company: '', location: '', startDate: '', endDate: '', current: false, bullets: [] };
      }
      const b = line.replace(/^[•\-\*◦▸►]+\s*/, '').trim();
      if (b.length > 3) entry.bullets.push(b);
      continue;
    }

    const dateM = line.match(DATE_RE);

    // Does this line look like a job header? (has a date AND a title keyword, or has pipe separator)
    const hasTitle = JOB_TITLE_RE.test(line);
    const hasPipe  = line.includes('|') && (hasTitle || dateM);

    if ((hasTitle && dateM) || hasPipe) {
      flush();
      entry = { title: '', company: '', location: '', startDate: '', endDate: '', current: false, bullets: [] };

      if (dateM) {
        entry.startDate = dateM[1];
        entry.endDate   = dateM[2];
        entry.current   = /present|current|now/i.test(dateM[2]);
      }

      const lineNoDates = line.replace(DATE_RE, '').trim();

      if (hasPipe) {
        const parts = lineNoDates.split('|').map(p => p.trim()).filter(Boolean);
        entry.title    = parts[0] || '';
        entry.company  = parts[1] || '';
        entry.location = parts[2] || '';
      } else {
        entry.title = lineNoDates;
        // Next non-bullet line might be company
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (!JOB_TITLE_RE.test(nextLine) && !/^[•\-\*]/.test(nextLine) && !DATE_RE.test(nextLine) && !SUBPROJECT_RE.test(nextLine) && nextLine.length < 100) {
            // Skip "Apps4Rent" type sub-lines (they're context, not company)
            if (!nextLine.startsWith('Apps4Rent') && !nextLine.startsWith('Research Project')) {
              entry.company = nextLine;
              i++;
            }
          }
        }
      }
      continue;
    }

    // Non-bullet line when we have an entry but it doesn't look like a new job
    // Could be continuation of context - skip silently
  }
  flush();

  return entries.filter(e => (e.title || e.company) && e.title.length > 1).slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills — handles bullet-prefixed category lines from ACTUAL PDF
// "• Programming languages: C, C++, Data Structure, MYSQL, HTML, Python, JAVA."
// "• Cloud-based Technology: AWS Cloud, Microsoft Azure, big-data techniques."
// ─────────────────────────────────────────────────────────────────────────────

const TECH_KEYWORDS = [
  'Python','Java','C++','C#','C','JavaScript','TypeScript','Go','Rust','Ruby','PHP','Swift','Kotlin','Scala','R','MATLAB','Bash','Shell','HTML','CSS',
  'React','Vue','Angular','Next.js','Node.js','Express','Django','FastAPI','Flask','Spring',
  'TensorFlow','PyTorch','Keras','NumPy','Pandas','Matplotlib','Scikit-learn',
  'Hugging Face','Transformers','LangChain','LlamaIndex','FAISS','Pinecone','Embeddings','RAG','LLM',
  'LLaMA','GPT','GPT-4','Claude','Gemini','Phi','LoRA','PEFT','Quantization','Autoencoder',
  'Machine Learning','Deep Learning','NLP','Computer Vision','CNN','LSTM','RNN','Transformer','GAN',
  'Prompt Engineering','LangGraph','LangSmith','SHAP','BM25','CLIP',
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','Ansible','Jenkins','Git','GitHub','GitLab','CI/CD','OpenShift',
  'SQL','PostgreSQL','MySQL','MongoDB','Redis','DynamoDB','Cassandra','Elasticsearch',
  'Linux','Windows Server','VMware','Nginx','Apache','Citrix','Veeam','IIS',
  'Prometheus','Grafana','Nagios','ELK','Power BI','Splunk',
  'Cybersecurity','Networking','Firewalls','VPN','TCP/IP','DNS','DHCP','AD','Group Policy',
  'Keystone TEE','RISC-V','RISC-V 64','SiFive','CUDA','Edge AI','Trusted Execution',
  'REST API','GraphQL','gRPC','Microservices','Kafka','Spark','Hadoop','Airflow',
  'Agile','Scrum','Jira','Confluence',
  'Excel','Tableau','SharePoint','Power BI',
];

function extractSkills(text) {
  if (!text) return [];
  const found = new Set();

  // Parse bullet-prefixed category lines: "• Category: skill1, skill2, skill3"
  const catRe = /^[•\-\*]?\s*[^:]{3,40}:\s*(.+)$/gm;
  let m;
  while ((m = catRe.exec(text)) !== null) {
    const skills = m[1];
    skills.split(/[,;]+/).map(s => s.trim().replace(/\.$/, '')).filter(s => s.length > 0 && s.length < 60)
      .forEach(s => {
        if (!/^(and|or|with|the|for|of|in|to|a|an|etc|including|such|as|big|data|techniques)$/i.test(s)) {
          found.add(s);
        }
      });
  }

  // Also match known keywords anywhere in text
  const ltext = text.toLowerCase();
  for (const kw of TECH_KEYWORDS) {
    if (ltext.includes(kw.toLowerCase())) found.add(kw);
  }

  return [...found].filter(s => s.length > 0 && s.length < 60).slice(0, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects — "ProjectName – Category\n• bullet\n• bullet"
// ─────────────────────────────────────────────────────────────────────────────

function parseProjects(text) {
  if (!text) return [];
  const projects = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let proj = null;

  const flush = () => {
    if (proj && (proj.name || proj.bullets.length)) {
      projects.push(proj);
      proj = null;
    }
  };

  for (const line of lines) {
    const isBullet = /^[•\-\*◦]/.test(line);
    if (isBullet) {
      if (!proj) proj = { name: '', link: '', bullets: [] };
      const b = line.replace(/^[•\-\*◦]+\s*/, '').trim();
      if (b.length > 3) proj.bullets.push(b);
    } else {
      // Non-bullet line = project title
      flush();
      const linkM = line.match(/(https?:\/\/[^\s|]+)/);
      const name  = line.replace(/(https?:\/\/[^\s|]+)/g, '').replace(/\s*[|–-]\s*$/, '').trim();
      proj = { name, link: linkM?.[1] || '', bullets: [] };
    }
  }
  flush();
  return projects.filter(p => p.name || p.bullets.length > 0).slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Publications
// ─────────────────────────────────────────────────────────────────────────────

function parsePublications(text) {
  if (!text) return [];
  return text.split('\n')
    .map(l => l.replace(/^[•\-\*\d.)\s]+/, '').trim())
    .filter(l => l.length > 10)
    .map(l => {
      const linkM = l.match(/(https?:\/\/[^\s]+)/);
      const title = l.replace(/(https?:\/\/[^\s]+)/g, '').replace(/\s*Link\b\s*/gi, '').trim();
      return { title, link: linkM?.[0] || '' };
    })
    .filter(p => p.title.length > 5)
    .slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Certifications
// "• Microsoft — Security, Compliance, and Identity Fundamentals (Jul 2022)"
// ─────────────────────────────────────────────────────────────────────────────

function parseCertifications(text) {
  if (!text) return [];
  return text.split('\n')
    .map(l => l.replace(/^[•\-\*\d.)\s]+/, '').trim())
    .filter(l => l.length > 3 && l.length < 250)
    .map(l => ({ name: l.replace(/(https?:\/\/[^\s]+)/g, '').trim(), link: l.match(/(https?:\/\/[^\s]+)/)?.[0] || '' }))
    .filter(c => c.name.length > 2)
    .slice(0, 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function parseResumeText(rawText) {
  const empty = { name:'', email:'', phone:'', linkedIn:'', github:'', portfolio:'', location:'', summary:'', skills:[], experience:[], education:[], projects:[], certifications:[], publications:[] };
  if (!rawText || rawText.length < 30) return empty;

  const text    = cleanText(rawText);
  const lines   = text.split('\n');
  const name    = parseName(lines);
  const contact = parseContact(text);
  const sections = splitSections(text);

  const skills         = extractSkills(sections.skills || text);
  const education      = parseEducation(sections.education || '');
  const experience     = parseExperience(sections.experience || '');
  const projects       = parseProjects(sections.projects || '');
  const publications   = parsePublications(sections.publications || '');
  const certifications = parseCertifications(sections.certifications || '');
  const summary        = (sections.summary || '').split('\n').filter(l => l.trim().length > 20).slice(0, 3).join(' ').trim();

  return { name, ...contact, summary, skills, experience, education, projects, certifications, publications };
}

module.exports = { parseResumeText };
