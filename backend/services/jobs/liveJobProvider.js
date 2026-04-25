/**
 * liveJobProvider.js — fetches REAL, CURRENT job postings directly from company ATS systems
 * 
 * Sources used (all free, no API key, public APIs):
 * - Greenhouse ATS: 500+ tech companies, returns actual job postings with direct apply URLs
 * - Lever ATS: 200+ companies, full job data with direct URLs
 * 
 * All jobs are filtered to < 14 days old.
 * Each job has a DIRECT apply URL to the specific posting (not a homepage).
 */

const axios = require('axios');

const TIMEOUT = 12000;
const MAX_AGE_DAYS = 14; // Only scrape jobs posted within last 14 days

// Companies on Greenhouse (official career portal ATS)
const GREENHOUSE_COMPANIES = [
  // AI / ML
  { slug: 'anthropic',      name: 'Anthropic'        },
  { slug: 'databricks',     name: 'Databricks'       },
  { slug: 'elastic',        name: 'Elastic'          },
  { slug: 'confluent',      name: 'Confluent'        },
  { slug: 'cockroachlabs',  name: 'CockroachDB'      },
  { slug: 'grafana',        name: 'Grafana Labs'     },
  { slug: 'weaviate',       name: 'Weaviate'         },
  // Cloud / Infra
  { slug: 'cloudflare',     name: 'Cloudflare'       },
  { slug: 'hashicorp',      name: 'HashiCorp'        },
  { slug: 'mongodb',        name: 'MongoDB'          },
  { slug: 'vercel',         name: 'Vercel'           },
  { slug: 'netlify',        name: 'Netlify'          },
  // Fintech
  { slug: 'stripe',         name: 'Stripe'           },
  { slug: 'brex',           name: 'Brex'             },
  { slug: 'rippling',       name: 'Rippling'         },
  { slug: 'deel',           name: 'Deel'             },
  { slug: 'gusto',          name: 'Gusto'            },
  { slug: 'plaid',          name: 'Plaid'            },
  { slug: 'chime',          name: 'Chime'            },
  { slug: 'robinhood',      name: 'Robinhood'        },
  // Consumer / SaaS
  { slug: 'airbnb',         name: 'Airbnb'           },
  { slug: 'shopify',        name: 'Shopify'          },
  { slug: 'figma',          name: 'Figma'            },
  { slug: 'notion',         name: 'Notion'           },
  { slug: 'airtable',       name: 'Airtable'         },
  { slug: 'discord',        name: 'Discord'          },
  { slug: 'canva',          name: 'Canva'            },
  { slug: 'reddit',         name: 'Reddit'           },
  { slug: 'twilio',         name: 'Twilio'           },
  { slug: 'retool',         name: 'Retool'           },
  { slug: 'linear',         name: 'Linear'           },
  // Enterprise
  { slug: 'zendesk',        name: 'Zendesk'          },
  { slug: 'asana',          name: 'Asana'            },
  { slug: 'greenhouse',     name: 'Greenhouse'       },
  { slug: 'gem',            name: 'Gem'              },
  { slug: 'benchling',      name: 'Benchling'        },
  { slug: 'lattice',        name: 'Lattice'          },
  { slug: 'carta',          name: 'Carta'            },
  { slug: 'rippling',       name: 'Rippling'         },
  { slug: 'clearbit',       name: 'Clearbit'         },
  { slug: 'gong',           name: 'Gong'             },
  { slug: 'mixpanel',       name: 'Mixpanel'         },
  { slug: 'amplitude',      name: 'Amplitude'        },
  { slug: 'segment',        name: 'Segment'          },
  { slug: 'mparticle',      name: 'mParticle'        },
  { slug: 'braze',          name: 'Braze'            },
  { slug: 'klaviyo',        name: 'Klaviyo'          },
  { slug: 'iterable',       name: 'Iterable'         },
  // Security
  { slug: 'snyk',           name: 'Snyk'             },
  { slug: 'lacework',       name: 'Lacework'         },
  { slug: 'wiz',            name: 'Wiz'              },
  { slug: 'orca',           name: 'Orca Security'    },
  // Health / Bio
  { slug: 'nuna',           name: 'Nuna'             },
  { slug: 'color',          name: 'Color Health'     },
  { slug: 'tempus',         name: 'Tempus'           },
  // Data / Analytics
  { slug: 'dbt-labs',       name: 'dbt Labs'         },
  { slug: 'fivetran',       name: 'Fivetran'         },
  { slug: 'airbyte',        name: 'Airbyte'          },
  { slug: 'preset',         name: 'Preset'           },
  { slug: 'hex',            name: 'Hex'              },
];

// Companies on Lever ATS
const LEVER_COMPANIES = [
  // AI Labs
  { slug: 'openai',         name: 'OpenAI'           },
  { slug: 'scale-ai',       name: 'Scale AI'         },
  { slug: 'cohere',         name: 'Cohere'           },
  { slug: 'mistral',        name: 'Mistral AI'       },
  { slug: 'perplexity',     name: 'Perplexity'       },
  { slug: 'huggingface',    name: 'Hugging Face'     },
  { slug: 'together',       name: 'Together AI'      },
  { slug: 'anyscale',       name: 'Anyscale'         },
  { slug: 'modal',          name: 'Modal'            },
  { slug: 'replicate',      name: 'Replicate'        },
  { slug: 'qdrant',         name: 'Qdrant'           },
  { slug: 'langchain',      name: 'LangChain'        },
  { slug: 'llamaindex',     name: 'LlamaIndex'       },
  { slug: 'weights-biases', name: 'Weights & Biases' },
  { slug: 'determined-ai',  name: 'Determined AI'    },
  { slug: 'lightning-ai',   name: 'Lightning AI'     },
  { slug: 'vllm-project',   name: 'vLLM'             },
  // Cloud / Infra
  { slug: 'coreweave',      name: 'CoreWeave'        },
  { slug: 'tigera',         name: 'Tigera'           },
  { slug: 'tailscale',      name: 'Tailscale'        },
  { slug: 'ngrok',          name: 'ngrok'            },
  { slug: 'fly',            name: 'Fly.io'           },
  { slug: 'render',         name: 'Render'           },
  { slug: 'railway',        name: 'Railway'          },
  // Fintech
  { slug: 'mercury',        name: 'Mercury'          },
  { slug: 'ramp',           name: 'Ramp'             },
  { slug: 'puzzle',         name: 'Puzzle'           },
  // Developer Tools
  { slug: 'sourcegraph',    name: 'Sourcegraph'      },
  { slug: 'codeium',        name: 'Codeium'          },
  { slug: 'cursor',         name: 'Cursor'           },
  { slug: 'replit',         name: 'Replit'           },
  { slug: 'gitpod',         name: 'Gitpod'           },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
};

// Map Greenhouse slug → company's actual career page URL template
// This gives users the REAL company career site URL, not the Greenhouse board URL
const GH_CAREER_URLS = {
  anthropic:    'https://www.anthropic.com/careers',
  stripe:       'https://stripe.com/jobs/listing',
  airbnb:       'https://careers.airbnb.com',
  shopify:      'https://www.shopify.com/careers',
  databricks:   'https://www.databricks.com/company/careers/open-positions',
  figma:        'https://www.figma.com/careers/',
  notion:       'https://www.notion.so/careers',
  airtable:     'https://airtable.com/careers',
  discord:      'https://discord.com/jobs',
  canva:        'https://www.canva.com/careers/',
  reddit:       'https://www.redditinc.com/careers',
  twilio:       'https://www.twilio.com/en-us/company/jobs',
  cloudflare:   'https://www.cloudflare.com/careers/jobs/',
  hashicorp:    'https://www.hashicorp.com/careers',
  mongodb:      'https://www.mongodb.com/company/careers',
  elastic:      'https://www.elastic.co/about/careers',
  confluent:    'https://www.confluent.io/careers/',
  cockroachlabs:'https://www.cockroachlabs.com/careers/',
  grafana:      'https://grafana.com/about/careers/',
  vercel:       'https://vercel.com/careers',
  netlify:      'https://www.netlify.com/careers/',
  planetscale:  'https://planetscale.com/careers',
  linear:       'https://linear.app/careers',
  retool:       'https://retool.com/careers',
  brex:         'https://www.brex.com/careers',
  rippling:     'https://www.rippling.com/careers',
  deel:         'https://www.deel.com/careers',
  gusto:        'https://gusto.com/about/careers',
  plaid:        'https://plaid.com/careers/',
  chime:        'https://careers.chime.com',
  robinhood:    'https://careers.robinhood.com',
};

const LEVER_CAREER_URLS = {
  openai:       'https://openai.com/careers',
  'scale-ai':   'https://scale.com/careers',
  cohere:       'https://cohere.com/careers',
  mistral:      'https://mistral.ai/careers/',
  perplexity:   'https://www.perplexity.ai/hub/careers',
  huggingface:  'https://huggingface.co/jobs',
  together:     'https://www.together.ai/careers',
  anyscale:     'https://www.anyscale.com/careers',
  modal:        'https://modal.com/careers',
  replicate:    'https://replicate.com/careers',
  weaviate:     'https://weaviate.io/company/careers',
  qdrant:       'https://qdrant.tech/careers/',
  langchain:    'https://www.langchain.com/careers',
};

// Tech keywords for tag extraction
const TECH_TAGS = [
  // Languages
  'python','javascript','typescript','java','golang','go','rust','c++','c#','ruby',
  'swift','kotlin','scala','r','matlab','bash','shell','php','perl','haskell','elixir',
  // Frontend
  'react','vue','angular','next.js','svelte','html','css','tailwind','webpack','vite',
  'redux','graphql','rest api','grpc','websocket',
  // Backend
  'node.js','fastapi','django','flask','spring','rails','express','gin','fiber',
  'microservices','distributed systems','event-driven','message queue',
  // AI / ML
  'tensorflow','pytorch','keras','scikit-learn','xgboost','lightgbm','catboost',
  'nlp','llm','rag','langchain','llamaindex','transformers','hugging face',
  'machine learning','deep learning','computer vision','generative ai','mlops',
  'reinforcement learning','fine-tuning','rlhf','prompt engineering','embeddings',
  'vector database','semantic search','diffusion models','stable diffusion',
  'cuda','gpu','tpu','triton','onnx','tensorrt','model serving','model deployment',
  'openai','anthropic','gemini','mistral','llama','gpt','bert','t5',
  'pandas','numpy','scipy','matplotlib','seaborn','plotly','jupyter',
  'data science','analytics','statistics','a/b testing','experimentation',
  // Cloud / Infra
  'aws','azure','gcp','docker','kubernetes','terraform','ansible','helm',
  'linux','ci/cd','devops','sre','platform engineering','infrastructure',
  'serverless','lambda','cloud functions','cloudflare','cdn',
  'datadog','prometheus','grafana','elk','splunk','observability','monitoring',
  'kafka','spark','flink','airflow','dbt','dagster','prefect',
  // Data
  'sql','postgresql','mysql','mongodb','redis','elasticsearch','cassandra',
  'snowflake','databricks','bigquery','redshift','duckdb','clickhouse',
  'data engineering','data pipeline','etl','data warehouse','data lake',
  'data modeling','data quality','streaming','batch processing',
  // Security
  'cybersecurity','networking','firewall','penetration testing','soc','siem',
  'zero trust','oauth','jwt','encryption','vulnerability','threat modeling',
  // Mobile
  'ios','android','react native','flutter','swift','kotlin','mobile',
  // Tools
  'git','github','gitlab','jira','agile','scrum','figma',
];

function extractTags(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return [...new Set(TECH_TAGS.filter(t => lower.includes(t)))]
    .map(t => t.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '))
    .slice(0, 10);
}

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, ' ').trim().slice(0, 3000);
}

function isRecent(dateStr) {
  if (!dateStr) return false; // no date = exclude (likely stale/removed posting)
  const posted = new Date(dateStr);
  const ageDays = (Date.now() - posted.getTime()) / (1000 * 86400);
  return ageDays <= MAX_AGE_DAYS;
}

function inferCategory(title, tags) {
  const t = (title + ' ' + tags.join(' ')).toLowerCase();
  if (/machine.?learning|deep.?learning|nlp|llm|ai.?engineer|ml.?engineer/.test(t)) return 'AI & Machine Learning';
  if (/data.?engineer|data.?pipeline|etl|spark|kafka/.test(t)) return 'Data Engineering';
  if (/data.?scientist|analytics|statistician/.test(t)) return 'Data Science';
  if (/devops|sre|platform|infrastructure|cloud|kubernetes|terraform/.test(t)) return 'Cloud & Infrastructure';
  if (/security|cyber|penetration|soc.?analyst/.test(t)) return 'Cybersecurity';
  if (/frontend|react|vue|angular|ui.?engineer/.test(t)) return 'Frontend';
  if (/backend|api|microservice/.test(t)) return 'Backend';
  if (/fullstack|full.?stack/.test(t)) return 'Full Stack';
  if (/mobile|ios|android|swift|kotlin/.test(t)) return 'Mobile';
  if (/product.?manager|pm\b/.test(t)) return 'Product';
  if (/design|ux|ui.?design|figma/.test(t)) return 'Design';
  return 'Software Engineering';
}

// ── Greenhouse fetcher ────────────────────────────────────────────────────────
async function fetchGreenhouse(company) {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`;
    const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
    const jobs = res.data?.jobs || [];

    return jobs
      .filter(j => isRecent(j.updated_at || j.created_at))
      .filter(j => {
        // US jobs only - filter out non-US locations
        const loc = (j.location?.name || '').toLowerCase();
        if (!loc) return true; // no location = assume US (remote)
        const nonUS = /(india|uk|london|berlin|germany|paris|france|toronto|canada|sydney|australia|singapore|ireland|dublin|spain|remote.*emea|emea|europe|asia|latam|latin america|brazil|mexico|seoul|korea|japan|china|remote.*world|worldwide)/i;
        return !nonUS.test(loc);
      })
      .map(j => {
        const title = j.title || '';
        const desc  = stripHtml(j.content || j.description || '');
        const tags  = extractTags(title + ' ' + desc);
        const loc   = j.location?.name || 'Remote';
        const locType = /remote/i.test(loc) ? 'Remote' : /hybrid/i.test(loc) ? 'Hybrid' : 'Onsite';
        const posted = new Date(j.updated_at || j.created_at || Date.now());

        return {
          id:              `greenhouse_${j.id}`,
          source:          'Greenhouse',
          // Use absolute_url from Greenhouse API — this is the real direct job URL
          // It's either the company's own career page with gh_jid param, or boards.greenhouse.io
          // Both formats take the user directly to the specific job posting
          sourceUrl:       j.absolute_url || `https://boards.greenhouse.io/${company.slug}/jobs/${j.id}`,
          applyUrl:        j.absolute_url || `https://boards.greenhouse.io/${company.slug}/jobs/${j.id}`,
          careerPageUrl:   GH_CAREER_URLS[company.slug] || `https://boards.greenhouse.io/${company.slug}`,
          title,
          company:         company.name,
          companyLogo:     company.logo || '',
          location:        loc,
          locationType:    locType,
          jobType:         'Full-time',
          category:        inferCategory(title, tags),
          salary:          '',
          description:     desc,
          tags,
          publicationDate: posted.toISOString(),
          postedHoursAgo:  Math.round((Date.now() - posted.getTime()) / 3600000),
          h1bSponsor:      /h-?1b|visa.?sponsor|work.?authoriz/i.test(desc),
          earlyApplicant:  (Date.now() - posted.getTime()) < 48 * 3600000,
          applicants:      0,
        };
      });
  } catch {
    return [];
  }
}

// ── Lever fetcher ─────────────────────────────────────────────────────────────
async function fetchLever(company) {
  try {
    const url = `https://api.lever.co/v0/postings/${company.slug}?mode=json&limit=100`;
    const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
    const jobs = Array.isArray(res.data) ? res.data : [];

    return jobs
      .filter(j => isRecent(j.createdAt ? new Date(j.createdAt) : null))
      .filter(j => {
        const loc = (j.categories?.location || j.workplaceType || '').toLowerCase();
        if (!loc || /remote/i.test(loc)) return true;
        const nonUS = /(india|uk|london|berlin|germany|paris|france|toronto|canada|sydney|australia|singapore|ireland|dublin|spain|emea|europe|asia|latam|brazil|mexico|seoul|korea|japan|china|worldwide)/i;
        return !nonUS.test(loc);
      })
      .map(j => {
        const title = j.text || '';
        const desc  = stripHtml(
          (j.descriptionBody?.descriptionHtml || j.description || '') +
          (j.lists?.map(l => l.content).join(' ') || '')
        );
        const tags  = extractTags(title + ' ' + desc);
        const loc   = j.categories?.location || j.workplaceType || 'Remote';
        const locType = /remote/i.test(loc) ? 'Remote' : /hybrid/i.test(loc) ? 'Hybrid' : 'Onsite';
        const posted = j.createdAt ? new Date(j.createdAt) : new Date();

        return {
          id:              `lever_${j.id}`,
          source:          'Lever',
          // Use hostedUrl from Lever API — this is the real direct job posting URL
          sourceUrl:       j.hostedUrl || `https://jobs.lever.co/${company.slug}/${j.id}`,
          applyUrl:        j.applyUrl  || j.hostedUrl || `https://jobs.lever.co/${company.slug}/${j.id}`,
          careerPageUrl:   LEVER_CAREER_URLS[company.slug] || `https://jobs.lever.co/${company.slug}`,
          title,
          company:         company.name,
          companyLogo:     company.logo || '',
          location:        loc,
          locationType:    locType,
          jobType:         j.categories?.commitment || 'Full-time',
          category:        inferCategory(title, tags),
          salary:          j.salaryRange ? `$${j.salaryRange.min/1000}K–$${j.salaryRange.max/1000}K/yr` : '',
          description:     desc,
          tags,
          publicationDate: posted.toISOString(),
          postedHoursAgo:  Math.round((Date.now() - posted.getTime()) / 3600000),
          h1bSponsor:      /h-?1b|visa.?sponsor|work.?authoriz/i.test(desc),
          earlyApplicant:  (Date.now() - posted.getTime()) < 48 * 3600000,
          applicants:      0,
        };
      });
  } catch {
    return [];
  }
}

// ── Main fetch function ───────────────────────────────────────────────────────
async function fetchAllLiveJobs(searchQuery = null) {
  const results = [];
  
  // Batch fetch - 5 companies at a time to avoid overwhelming
  const ghBatches = [];
  for (let i = 0; i < GREENHOUSE_COMPANIES.length; i += 5) {
    ghBatches.push(GREENHOUSE_COMPANIES.slice(i, i + 5));
  }
  for (const batch of ghBatches) {
    const batchResults = await Promise.allSettled(batch.map(fetchGreenhouse));
    batchResults.forEach(r => { if (r.status === 'fulfilled') results.push(...r.value); });
  }

  const lvBatches = [];
  for (let i = 0; i < LEVER_COMPANIES.length; i += 5) {
    lvBatches.push(LEVER_COMPANIES.slice(i, i + 5));
  }
  for (const batch of lvBatches) {
    const batchResults = await Promise.allSettled(batch.map(fetchLever));
    batchResults.forEach(r => { if (r.status === 'fulfilled') results.push(...r.value); });
  }

  // Filter by search if provided
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    return results.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q) ||
      j.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Deduplicate by id
  const seen = new Set();
  return results.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
}

// Fetch from a specific company (for live search)
async function fetchCompanyJobs(companyName) {
  const name = companyName.toLowerCase().replace(/\s+/g, '');
  
  // Try Greenhouse
  const ghJob = GREENHOUSE_COMPANIES.find(c => c.slug === name || c.name.toLowerCase() === name);
  if (ghJob) return fetchGreenhouse(ghJob);
  
  // Try Lever
  const lvJob = LEVER_COMPANIES.find(c => c.slug === name || c.name.toLowerCase() === name);
  if (lvJob) return fetchLever(lvJob);

  // Try both with the company name as slug
  const [ghResults, lvResults] = await Promise.allSettled([
    fetchGreenhouse({ slug: name, name: companyName, logo: '' }),
    fetchLever({ slug: name, name: companyName, logo: '' }),
  ]);
  
  return [
    ...(ghResults.status === 'fulfilled' ? ghResults.value : []),
    ...(lvResults.status === 'fulfilled' ? lvResults.value : []),
  ];
}

module.exports = { fetchAllLiveJobs, fetchCompanyJobs, GREENHOUSE_COMPANIES, LEVER_COMPANIES };
