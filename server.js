require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const {
  seedDatabase,
  getKbForPrompt,
  getKbEntries,
  getKbQuestions,
  insertKbEntry,
  updateKbEntry,
  deleteKbEntry,
  insertChatLog,
  getChatLogs,
  getRecentConversations,
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Demo chat limit ───────────────────────────────────────────────────────────
// Counts successful chat requests. Reset on server restart.
// Set CHAT_LIMIT=0 in env to disable (used in tests).
let chatRequestCount = 0;
app._setChatCount   = (n) => { chatRequestCount = n; };
app._resetChatCount = ()  => { chatRequestCount = 0; };

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

  // Demo rate limit — set CHAT_LIMIT=0 to disable
  const chatLimit = parseInt(process.env.CHAT_LIMIT || '25', 10);
  if (chatLimit > 0 && chatRequestCount >= chatLimit) {
    return res.status(429).json({
      error: 'This demo has reached its conversation limit. Please get in touch to discuss a full deployment.'
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Check your .env file.'
    });
  }

  chatRequestCount++;

  const kbEntries = getKbForPrompt(siteId);
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

  let fullBotResponse = '';

  try {
    const stream = anthropic.messages.stream({
      model: process.env.MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullBotResponse += chunk.delta.text;
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    // Log the conversation (non-fatal)
    try {
      const userMessage = Array.isArray(messages) ? (messages[messages.length - 1]?.content || '') : '';
      insertChatLog(siteId, req.session?.id || '', userMessage, fullBotResponse);
    } catch (logErr) {
      console.error('Chat log error:', logErr.message);
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
  res.json(getKbEntries(req.params.siteId));
});

// Knowledge base — POST
app.post('/api/kb', requireAuth, (req, res) => {
  const { site_id, category, question, answer } = req.body;
  if (!site_id || !question || !answer) {
    return res.status(400).json({ error: 'site_id, question and answer are required.' });
  }
  res.json(insertKbEntry(site_id, category, question, answer));
});

// Knowledge base — PUT
app.put('/api/kb/:id', requireAuth, (req, res) => {
  const { category, question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer are required.' });
  }
  res.json(updateKbEntry(req.params.id, category, question, answer));
});

// Knowledge base — DELETE
app.delete('/api/kb/:id', requireAuth, (req, res) => {
  deleteKbEntry(req.params.id);
  res.json({ success: true });
});

// Chat logs — GET
app.get('/api/logs/:siteId', requireAuth, (req, res) => {
  res.json(getChatLogs(req.params.siteId));
});

// Recommendations — GET
app.get('/api/recommendations/:siteId', requireAuth, async (req, res) => {
  const logs = getRecentConversations(req.params.siteId);

  if (logs.length === 0) {
    return res.json({ recommendations: [], message: 'No chat history yet. Recommendations appear once users have started chatting.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set.' });
  }

  const kb = getKbQuestions(req.params.siteId);

  const logsText = logs.map(l => `User: ${l.user_message}\nBot: ${l.bot_response}`).join('\n---\n');
  const kbText = kb.map(e => `- ${e.question}`).join('\n');

  try {
    const response = await anthropic.messages.create({
      model: process.env.MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a knowledge base improvement assistant. Analyse these recent chat conversations and suggest new knowledge base entries that would help the bot answer users better.

EXISTING KNOWLEDGE BASE QUESTIONS (do not suggest duplicates):
${kbText || '(none yet)'}

RECENT CONVERSATIONS:
${logsText}

Return a JSON array of 3–6 suggested new entries. Each must have: category (string), question (string), answer (string).
Only suggest entries NOT already in the existing knowledge base.
Return ONLY valid JSON array, no other text. Example format:
[{"category":"Delivery","question":"Can I change my delivery address?","answer":"Yes, you can update your delivery address..."}]`
      }]
    });

    let recommendations = [];
    try {
      let text = response.content[0].text.trim();
      // Strip markdown code fences if Claude wraps the JSON (e.g. ```json ... ```)
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '');
      // Extract the JSON array in case there is surrounding prose
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        recommendations = JSON.parse(arrayMatch[0]);
      }
      if (!Array.isArray(recommendations)) recommendations = [];
    } catch (parseErr) {
      console.error('Recommendations parse error:', parseErr.message);
      recommendations = [];
    }
    res.json({ recommendations });
  } catch (err) {
    console.error('Recommendations error:', err.message);
    res.status(500).json({ error: 'Failed to generate recommendations. Please try again.' });
  }
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
    console.log(`\n  chattoweb.com platform running on http://localhost:${PORT}`);
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
