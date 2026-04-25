const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// ── Curated events database ────────────────────────────────────────────────
// Real recurring events with registration links, updated URLs
const EVENTS_DB = [
  // Career Fairs
  { id:'ef1', type:'Career Fair', title:'National Career Fair', org:'National Career Fairs', location:'Multiple US Cities', virtual:false, registration:'Required', free:true, h1bFriendly:true, url:'https://www.nationalcareerfairs.com/register/', description:'Free career fairs held in major cities nationwide. Meet 50+ employers actively hiring. Bring resumes.', tags:['All Fields','Entry Level','Internship'], audience:'Students,New Grads', date:'Rolling', nextDate:'Monthly', icon:'🎪' },
  { id:'ef2', type:'Career Fair', title:'Handshake Virtual Career Fair', org:'Handshake', location:'Virtual', virtual:true, registration:'Required', free:true, h1bFriendly:true, url:'https://joinhandshake.com/campaigns/virtual-fairs/', description:'University-focused virtual career fairs. Connect with thousands of employers hiring students and recent graduates.', tags:['Tech','Business','All Fields'], audience:'Students', date:'Monthly', nextDate:'Monthly', icon:'🎪' },
  { id:'ef3', type:'Career Fair', title:'Grace Hopper Celebration', org:'AnitaB.org', location:'Various Cities + Virtual', virtual:false, registration:'Required', free:false, h1bFriendly:true, url:'https://ghc.anitab.org/attend/register/', description:'World\'s largest gathering of women technologists. 30,000+ attendees, massive tech recruitment event.', tags:['Tech','Diversity','Women in Tech'], audience:'All', date:'Annual','nextDate':'Oct 2025', icon:'🎪' },

  // Conferences
  { id:'ec1', type:'Conference', title:'CES — Consumer Electronics Show', org:'CTA', location:'Las Vegas, NV', virtual:false, registration:'Required', free:false, h1bFriendly:true, url:'https://www.ces.tech/attend/registration.aspx', description:'World\'s most influential technology event. 175,000+ attendees, 4,000+ exhibitors. Huge networking for tech professionals.', tags:['Technology','Hardware','AI','IoT'], audience:'Industry Professionals', date:'Annual', nextDate:'Jan 2026', icon:'🏛️' },
  { id:'ec2', type:'Conference', title:'SXSW — South by Southwest', org:'SXSW', location:'Austin, TX', virtual:false, registration:'Required', free:false, h1bFriendly:true, url:'https://www.sxsw.com/attend/register/', description:'Convergence of tech, music, and culture. Premier networking event for startups, tech, and creative industries.', tags:['Tech','Startups','Innovation','Media'], audience:'All', date:'Annual', nextDate:'Mar 2026', icon:'🏛️' },
  { id:'ec3', type:'Conference', title:'AWS re:Invent', org:'Amazon Web Services', location:'Las Vegas, NV + Virtual', virtual:true, registration:'Required', free:false, h1bFriendly:true, url:'https://reinvent.awsevents.com/register/', description:'AWS\'s annual conference. 60,000+ cloud professionals, massive networking, job opportunities at Amazon and AWS partners.', tags:['Cloud','AWS','DevOps','ML'], audience:'Tech Professionals', date:'Annual', nextDate:'Dec 2025', icon:'🏛️' },
  { id:'ec4', type:'Conference', title:'Google I/O', org:'Google', location:'Mountain View, CA + Virtual', virtual:true, registration:'Required', free:true, h1bFriendly:true, url:'https://io.google/2025/intl/en/apply/', description:'Google\'s annual developer conference. Free virtual attendance. Networking with Google engineers and ecosystem partners.', tags:['AI','Android','Cloud','Web'], audience:'Developers', date:'Annual', nextDate:'May 2025', icon:'🏛️' },
  { id:'ec5', type:'Conference', title:'NeurIPS — Neural Information Processing Systems', org:'NeurIPS Foundation', location:'Various', virtual:true, registration:'Required', free:false, h1bFriendly:true, url:'https://neurips.cc/Register/view-registration', description:'Top AI/ML research conference. Recruiters from DeepMind, OpenAI, Meta AI attend. Essential for ML researchers.', tags:['AI','Machine Learning','Research','Deep Learning'], audience:'Researchers,ML Engineers', date:'Annual', nextDate:'Dec 2025', icon:'🏛️' },
  { id:'ec6', type:'Conference', title:'KubeCon + CloudNativeCon', org:'CNCF', location:'Various US Cities', virtual:true, registration:'Required', free:false, h1bFriendly:true, url:'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/register/', description:'Premier Kubernetes and cloud-native conference. Hiring heavily for DevOps, Platform Engineering, SRE roles.', tags:['Kubernetes','DevOps','Cloud','Infrastructure'], audience:'DevOps,Cloud Engineers', date:'Annual', nextDate:'Nov 2025', icon:'🏛️' },

  // Workshops & Seminars
  { id:'ew1', type:'Workshop', title:'MLOps World Summit', org:'MLOps Community', location:'Virtual', virtual:true, registration:'Required', free:true, h1bFriendly:true, url:'https://mlops.community/mlops-world/#register', description:'Free virtual summit for MLOps practitioners. Live sessions, networking rooms, Q&A with practitioners.', tags:['MLOps','Machine Learning','DevOps','AI'], audience:'ML Engineers,Data Scientists', date:'Quarterly', nextDate:'Rolling', icon:'🎓' },
  { id:'ew2', type:'Workshop', title:'AI Engineer Summit', org:'AI Engineer Foundation', location:'San Francisco + Virtual', virtual:true, registration:'Required', free:false, h1bFriendly:true, url:'https://www.ai.engineer/summit/tickets', description:'Focused on applied AI engineering. Real practitioners share how to build AI products in production.', tags:['AI','LLM','Engineering','Production AI'], audience:'AI Engineers', date:'Annual', nextDate:'2025', icon:'🎓' },
  { id:'ew3', type:'Workshop', title:'AWS Free Online Workshops', org:'Amazon Web Services', location:'Virtual', virtual:true, registration:'Required', free:true, h1bFriendly:true, url:'https://workshops.aws/', description:'Free hands-on AWS workshops covering cloud, ML, security, and serverless. Self-paced or instructor-led.', tags:['AWS','Cloud','Serverless','ML'], audience:'All', date:'Rolling', nextDate:'Always available', icon:'🎓' },

  // Meetups
  { id:'em1', type:'Meetup', title:'PyData Meetups', org:'NumFOCUS', location:'Multiple US Cities + Virtual', virtual:true, registration:'RSVP', free:true, h1bFriendly:true, url:'https://www.meetup.com/pro/pydata/#chapters', description:'Monthly meetups for Python data professionals. Local chapters in 100+ cities. Great for networking with data scientists.', tags:['Python','Data Science','ML','Analytics'], audience:'Data Professionals', date:'Monthly', nextDate:'Monthly', icon:'☕' },
  { id:'em2', type:'Meetup', title:'MLOps Community Meetups', org:'MLOps Community', location:'Virtual', virtual:true, registration:'RSVP', free:true, h1bFriendly:true, url:'https://mlops.community/meet/#upcoming', description:'Regular online meetups focused on deploying ML models in production. Great networking for ML engineers.', tags:['MLOps','Machine Learning','Deployment'], audience:'ML Engineers', date:'Monthly', nextDate:'Monthly', icon:'☕' },
  { id:'em3', type:'Meetup', title:'AWS User Group Meetups', org:'AWS Community', location:'Multiple Cities', virtual:true, registration:'RSVP', free:true, h1bFriendly:true, url:'https://aws.amazon.com/developer/community/usergroups/#find', description:'Local AWS user groups meeting monthly. Network with AWS professionals and cloud engineers in your city.', tags:['AWS','Cloud','DevOps'], audience:'Cloud Engineers', date:'Monthly', nextDate:'Monthly', icon:'☕' },
  { id:'em4', type:'Meetup', title:'React & JavaScript Meetups', org:'Various Local Groups', location:'Multiple US Cities + Virtual', virtual:true, registration:'RSVP', free:true, h1bFriendly:true, url:'https://www.meetup.com/find/?keywords=reactjs&source=EVENTS', description:'Local React/JS communities. Mix of tech talks and networking. Great for frontend and full-stack developers.', tags:['React','JavaScript','Frontend','Node.js'], audience:'Developers', date:'Monthly', nextDate:'Monthly', icon:'☕' },

  // Professional Associations
  { id:'ea1', type:'Association Event', title:'IEEE Spectrum Events', org:'IEEE', location:'Various + Virtual', virtual:true, registration:'Required', free:false, h1bFriendly:true, url:'https://www.ieee.org/membership_services/membership/join/index.html', description:'World\'s largest technical professional organization. Conferences, networking events, career resources for engineers.', tags:['Engineering','AI','Electronics','Systems'], audience:'Engineers', date:'Various', nextDate:'Rolling', icon:'🏢' },
  { id:'ea2', type:'Association Event', title:'ACM Events & Networking', org:'ACM', location:'Various + Virtual', virtual:true, registration:'Required', free:false, h1bFriendly:true, url:'https://services.acm.org/public/qj/login/qjlogin.cfm?promo=EP1&origin=membership', description:'Association for Computing Machinery. CS-focused events, research presentations, industry networking.', tags:['Computer Science','AI','Algorithms','Research'], audience:'CS Professionals', date:'Various', nextDate:'Rolling', icon:'🏢' },
  { id:'ea3', type:'Association Event', title:'AAAI Conference on AI', org:'AAAI', location:'Various US Cities', virtual:false, registration:'Required', free:false, h1bFriendly:true, url:'https://aaai.org/conference/aaai/aaai-26/registration/', description:'Top AI research conference. Recruiters from OpenAI, Google DeepMind, Meta AI attend actively.', tags:['AI','Research','NLP','Computer Vision'], audience:'AI Researchers,Engineers', date:'Annual', nextDate:'Feb 2026', icon:'🏢' },

  // Hackathons
  { id:'eh1', type:'Hackathon', title:'MLH (Major League Hacking) Hackathons', org:'MLH', location:'Various US Cities + Virtual', virtual:true, registration:'Required', free:true, h1bFriendly:true, url:'https://mlh.io/seasons/2025/events#find', description:'300+ official hackathons per year. Win prizes, get recruited by sponsors, build your portfolio. F1 visa participants welcome.', tags:['Hacking','Software','AI','Hardware'], audience:'Students', date:'Weekly', nextDate:'Weekly', icon:'💻' },
  { id:'eh2', type:'Hackathon', title:'Devpost Hackathons', org:'Devpost', location:'Virtual', virtual:true, registration:'Required', free:true, h1bFriendly:true, url:'https://devpost.com/hackathons?open-to=public&status=upcoming', description:'Directory of hundreds of online and in-person hackathons. Many sponsored by Google, AWS, Microsoft. All skill levels.', tags:['AI','Web3','Social Impact','Cloud'], audience:'All Developers', date:'Rolling', nextDate:'Always available', icon:'💻' },
  { id:'eh3', type:'Hackathon', title:'HackMIT', org:'MIT', location:'Cambridge, MA', virtual:false, registration:'Required', free:true, h1bFriendly:true, url:'https://hackmit.org/#apply', description:'MIT\'s flagship hackathon. 1,000+ hackers, top sponsors, huge networking opportunity with MIT community.', tags:['AI','Robotics','Fintech','Healthcare'], audience:'Students', date:'Annual', nextDate:'Fall 2025', icon:'💻' },

  // Startup Events
  { id:'es1', type:'Startup Event', title:'Y Combinator Demo Day', org:'Y Combinator', location:'San Francisco, CA', virtual:false, registration:'Required', free:false, h1bFriendly:true, url:'https://www.ycombinator.com/apply', description:'Top startup demo event. Network with YC founders, investors, and tech leaders. Great for startup job seekers.', tags:['Startups','Entrepreneurship','VC','Tech'], audience:'Entrepreneurs,Investors,Tech Pros', date:'Biannual', nextDate:'Spring/Fall 2025', icon:'🚀' },
  { id:'es2', type:'Startup Event', title:'TechCrunch Disrupt', org:'TechCrunch', location:'San Francisco, CA', virtual:false, registration:'Required', free:false, h1bFriendly:true, url:'https://techcrunch.com/events/tc-disrupt-2025/tickets/', description:'Premier startup conference. 10,000+ attendees, startup battle, massive networking. Many companies hiring at the event.', tags:['Startups','Tech','Innovation','VC'], audience:'All', date:'Annual', nextDate:'Oct 2025', icon:'🚀' },

  // Alumni Events
  { id:'eal1', type:'Alumni Event', title:'LinkedIn Local Networking Events', org:'LinkedIn', location:'Multiple Cities', virtual:false, registration:'RSVP', free:true, h1bFriendly:true, url:'https://www.linkedin.com/search/results/events/?eventType=inPerson', description:'Professional networking meetups organized by LinkedIn members worldwide. Mix of in-person and virtual.', tags:['Networking','All Fields','Professional Development'], audience:'All Professionals', date:'Rolling', nextDate:'Rolling', icon:'🎓' },
  { id:'eal2', type:'Alumni Event', title:'Texas A&M Alumni Events', org:'TAMU Alumni Association', location:'Multiple Cities + Virtual', virtual:true, registration:'RSVP', free:true, h1bFriendly:true, url:'https://alumni.tamu.edu/programs-events/upcoming-events/', description:'TAMU alumni networking events, career panels, and mentorship programs across the US.', tags:['TAMU','Networking','Career Development'], audience:'TAMU Alumni & Students', date:'Various', nextDate:'Rolling', icon:'🎓' },

  // Informal Networking
  { id:'en1', type:'Networking', title:'Lunchclub AI Matching', org:'Lunchclub', location:'Virtual', virtual:true, registration:'Required', free:true, h1bFriendly:true, url:'https://lunchclub.com/register', description:'AI-powered 1:1 networking matching. Get introduced to relevant professionals in tech and business weekly.', tags:['Networking','Tech','Business','All Fields'], audience:'All Professionals', date:'Weekly', nextDate:'Ongoing', icon:'☕' },
  { id:'en2', type:'Networking', title:'Eventbrite Tech Networking Events', org:'Various Organizers', location:'Multiple US Cities', virtual:true, registration:'RSVP', free:true, h1bFriendly:true, url:'https://www.eventbrite.com/d/online/tech-networking/?sort=date', description:'Thousands of tech networking events. Filter by location, topic, and date. Many are free and open-entry.', tags:['Networking','Tech','Startups','All Fields'], audience:'All', date:'Daily', nextDate:'Always', icon:'☕' },
];

// GET /api/events — returns filtered events
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { type, virtual, free, h1b, search, tags } = req.query;
    let events = [...EVENTS_DB];

    if (type && type !== 'All')     events = events.filter(e => e.type === type);
    if (virtual === 'true')         events = events.filter(e => e.virtual);
    if (virtual === 'false')        events = events.filter(e => !e.virtual);
    if (free === 'true')            events = events.filter(e => e.free);
    if (h1b === 'true')             events = events.filter(e => e.h1bFriendly);
    if (search) {
      const q = search.toLowerCase();
      events = events.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.org.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase());
      events = events.filter(e => e.tags.some(t => tagList.some(tl => t.toLowerCase().includes(tl))));
    }

    res.json({
      events,
      total: events.length,
      types: [...new Set(EVENTS_DB.map(e => e.type))],
    });
  } catch (err) { next(err); }
});

module.exports = router;
