const { exec, execSync, spawn } = require('child_process');
const axios = require('axios');

const OLLAMA_HOST  = process.env.OLLAMA_HOST  || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

let ollamaStatus = { installed: false, running: false, modelReady: false, error: null, model: OLLAMA_MODEL };

async function checkOllamaRunning() {
  try { await axios.get(`${OLLAMA_HOST}/api/tags`, { timeout: 3000 }); return true; }
  catch { return false; }
}

async function checkModelAvailable() {
  try {
    const res = await axios.get(`${OLLAMA_HOST}/api/tags`, { timeout: 3000 });
    const models = res.data.models || [];
    return models.some(m => m.name.startsWith(OLLAMA_MODEL.split(':')[0]));
  } catch { return false; }
}

function isOllamaInstalled() {
  try { execSync('which ollama', { stdio: 'pipe' }); return true; } catch { return false; }
}

function startOllamaService() {
  return new Promise((resolve) => {
    const proc = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
    proc.unref();
    setTimeout(resolve, 3000);
  });
}

function pullModel() {
  return new Promise((resolve) => {
    console.log(`📦 Pulling ${OLLAMA_MODEL}... (first run: ~4GB, takes 5-10 min)`);
    const proc = spawn('ollama', ['pull', OLLAMA_MODEL], { stdio: 'inherit' });
    proc.on('close', c => resolve(c === 0));
    proc.on('error', () => resolve(false));
  });
}

async function setupOllama() {
  if (process.env.AUTO_SETUP_OLLAMA !== 'true') return;

  console.log(`\n🤖 AI Setup (${OLLAMA_MODEL})...`);

  if (!isOllamaInstalled()) {
    console.log('⚠️  Ollama not installed. Run: brew install ollama');
    ollamaStatus.error = 'not_installed'; return;
  }
  ollamaStatus.installed = true;

  const running = await checkOllamaRunning();
  if (!running) {
    await startOllamaService();
    if (!await checkOllamaRunning()) {
      console.log('⚠️  Could not start Ollama. Using rule-based fallback.');
      ollamaStatus.error = 'cannot_start'; return;
    }
  }
  ollamaStatus.running = true;

  if (!await checkModelAvailable()) {
    const pulled = await pullModel();
    if (!pulled) {
      console.log(`⚠️  Could not pull ${OLLAMA_MODEL}. Using fallback.`);
      ollamaStatus.error = 'pull_failed'; return;
    }
  }
  ollamaStatus.modelReady = true;
  console.log(`✅ ${OLLAMA_MODEL} is ready — Full AI enabled!\n`);
}

// Generate (single-turn, for JSON tasks)
async function callOllamaDirectly(prompt, options = {}) {
  try {
    const res = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature:  options.temperature  || 0.3,
        num_predict:  options.maxTokens    || 2048,
        top_p:        0.9,
        repeat_penalty: 1.1,
      },
    }, { timeout: 120000 });
    return res.data.response || '';
  } catch { return null; }
}

// Chat (multi-turn, for counselor)
async function callOllamaChat(messages, options = {}) {
  try {
    const res = await axios.post(`${OLLAMA_HOST}/api/chat`, {
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature:  options.temperature  || 0.7,
        num_predict:  options.maxTokens    || 1024,
        top_p:        0.9,
      },
    }, { timeout: 120000 });
    return res.data.message?.content || '';
  } catch { return null; }
}

function getStatus() { return ollamaStatus; }
function isReady()   { return ollamaStatus.running && ollamaStatus.modelReady; }

module.exports = { setupOllama, callOllamaDirectly, callOllamaChat, getStatus, isReady };
