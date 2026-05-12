require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { getDb, seedDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Anthropic client ──────────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// ── Site config ───────────────────────────────────────────────────────────────
const SITE_CONFIG = {
  legal: {
    name: 'Harrington & Associates',
    persona: 'a helpful and professional legal assistant for Harrington & Associates, a UK solicitors firm. Speak in a warm but authoritative tone. Always recommend booking a free consultation for complex matters.'
  },
  retail: {
    name: 'Botanica Home',
    persona: 'a friendly and knowledgeable customer service assistant for Botanica Home, a sustainable home and lifestyle brand. Be warm, helpful, and enthusiastic about the products.'
  },
  gov: {
    name: 'Northgate District Council',
    persona: 'a clear and helpful council services assistant for Northgate District Council. Be factual, concise, and direct. Always signpost to the correct team or phone number when relevant.'
  }
};

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  }
}));

// ── Auth ──────────────────────────────────────────────────────────────────────
const DEMO_USER = process.env.DEMO_USER || 'demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

function requireAuth(req, res, next) {
  // Allow bypass in test environment
  if (process.env.NODE_ENV === 'test') return next();
  if (req.session && req.session.authenticated) return next();
  // Store intended destination and redirect to login
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

// ── Public routes ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/landing.html'));
});

app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.post('/login', (req, res) => {
  if (!DEMO_PASSWORD) {
    return res.redirect('/login?error=config');
  }
  const { username, password } = req.body;
  if (username === DEMO_USER && password === DEMO_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    const returnTo = req.session.returnTo || '/chatbot';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── Protected static routes ───────────────────────────────────────────────────
// Individual demo sites — register BEFORE the /chatbot catch-all
app.use('/chatbot/legal',  requireAuth, express.static(path.join(__dirname, 'sites/legal')));
app.use('/chatbot/retail', requireAuth, express.static(path.join(__dirname, 'sites/retail')));
app.use('/chatbot/gov',    requireAuth, express.static(path.join(__dirname, 'sites/gov')));
app.use('/admin',          requireAuth, express.static(path.join(__dirname, 'admin')));

// Chatbot hub — lists the three demo sites
app.get('/chatbot', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/hub.html'));
});

// ── Protected API routes ──────────────────────────────────────────────────────

// Chat endpoint (streaming SSE)
app.post('/api/chat', requireAuth, async (req, res) => {
  const { siteId, messages } = req.body;

  if (!siteId || !messages || !SITE_CONFIG[siteId]) {
    return res.status(400).json({ error: 'Invalid request: siteId and messages are required.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Check your .env file.'
    });
  }

  const db = getDb();
  const kbEntries = db
    .prepare('SELECT category, question, answer FROM knowledge_base WHERE site_id = ? ORDER BY category')
    .all(siteId);

  const config = SITE_CONFIG[siteId];

  const kbText = kbEntries.length > 0
    ? kbEntries.map(e => `[${e.category}]\nQ: ${e.question}\nA: ${e.answer}`).join('\n\n')
    : 'No knowledge base entries available yet.';

  const systemPrompt = `You are ${config.persona}.

Answer questions based on the knowledge base below. If a question is not covered, say so politely and suggest the user contact the team directly. Keep responses concise — aim for 2–4 sentences unless more detail is genuinely needed.

KNOWLEDGE BASE:
${kbText}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const stream = anthropic.messages.stream({
      model: process.env.MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Sorry, I could not process that request. Please try again.' })}\n\n`);
    res.end();
  }
});

// Knowledge base — GET
app.get('/api/kb/:siteId', requireAuth, (req, res) => {
  const db = getDb();
  const entries = db
    .prepare('SELECT * FROM knowledge_base WHERE site_id = ? ORDER BY category, id')
    .all(req.params.siteId);
  res.json(entries);
});

// Knowledge base — POST
app.post('/api/kb', requireAuth, (req, res) => {
  const { site_id, category, question, answer } = req.body;
  if (!site_id || !question || !answer) {
    return res.status(400).json({ error: 'site_id, question and answer are required.' });
  }
  const db = getDb();
  const result = db
    .prepare('INSERT INTO knowledge_base (site_id, category, question, answer) VALUES (?, ?, ?, ?)')
    .run(site_id, category || '', question, answer);
  const entry = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(result.lastInsertRowid);
  res.json(entry);
});

// Knowledge base — PUT
app.put('/api/kb/:id', requireAuth, (req, res) => {
  const { category, question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer are required.' });
  }
  const db = getDb();
  db.prepare('UPDATE knowledge_base SET category = ?, question = ?, answer = ? WHERE id = ?')
    .run(category || '', question, answer, req.params.id);
  const entry = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(req.params.id);
  res.json(entry);
});

// Knowledge base — DELETE
app.delete('/api/kb/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Sites list
app.get('/api/sites', requireAuth, (req, res) => {
  res.json(
    Object.entries(SITE_CONFIG).map(([id, cfg]) => ({ id, name: cfg.name }))
  );
});

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  seedDatabase();
  app.listen(PORT, () => {
    console.log(`\n  chatoweb.com platform running on http://localhost:${PORT}`);
    console.log(`  Landing:  http://localhost:${PORT}/`);
    console.log(`  Login:    http://localhost:${PORT}/login`);
    console.log(`  Hub:      http://localhost:${PORT}/chatbot`);
    console.log(`  Legal:    http://localhost:${PORT}/chatbot/legal`);
    console.log(`  Retail:   http://localhost:${PORT}/chatbot/retail`);
    console.log(`  Gov:      http://localhost:${PORT}/chatbot/gov`);
    console.log(`  Admin:    http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
