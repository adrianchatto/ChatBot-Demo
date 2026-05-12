/**
 * Backend API tests — chatoweb.com platform
 *
 * The database layer is mocked so these tests are platform-independent
 * (no native binary required). They test HTTP behaviour: routing, validation,
 * auth, and correct interaction with the data layer.
 *
 * Run with: npm test
 */

// ── Database mock — declared before any require() that loads server.js ────────

let mockEntries = [];
let mockChatLogs = [];
let nextId = 100;

function makeMockStatement(sql) {
  if (sql.includes('chat_logs')) {
    return {
      all: jest.fn((siteId) => mockChatLogs.filter(l => l.site_id === siteId)),
      get: jest.fn(() => null),
      run: jest.fn((...args) => {
        if (sql.includes('INSERT')) {
          const id = ++nextId;
          const [site_id, session_id, user_message, bot_response] = args;
          mockChatLogs.push({ id, site_id, session_id: session_id || '', user_message, bot_response, created_at: new Date().toISOString() });
          return { lastInsertRowid: id };
        }
        return { changes: 0 };
      })
    };
  }
  return {
    all: jest.fn((siteId) =>
      mockEntries.filter(e => e.site_id === siteId)
    ),
    get: jest.fn((id) =>
      mockEntries.find(e => e.id === Number(id)) || null
    ),
    run: jest.fn((...args) => {
      if (sql.includes('INSERT')) {
        const id = ++nextId;
        const [site_id, category, question, answer] = args;
        mockEntries.push({ id, site_id, category: category || '', question, answer, created_at: new Date().toISOString() });
        return { lastInsertRowid: id };
      }
      if (sql.includes('UPDATE')) {
        const [category, question, answer, id] = args;
        const idx = mockEntries.findIndex(e => e.id === Number(id));
        if (idx >= 0) mockEntries[idx] = { ...mockEntries[idx], category, question, answer };
        return { changes: 1 };
      }
      if (sql.includes('DELETE')) {
        mockEntries = mockEntries.filter(e => e.id !== Number(args[0]));
        return { changes: 1 };
      }
      return { changes: 0 };
    })
  };
}

const mockDb = { prepare: jest.fn((sql) => makeMockStatement(sql)) };

jest.mock('../../database', () => ({
  getDb: jest.fn(() => mockDb),
  seedDatabase: jest.fn(),
  resetDb: jest.fn()
}));

// ── Load app after mock is registered ─────────────────────────────────────────
const request = require('supertest');
const app = require('../../server');

// ── Test lifecycle ────────────────────────────────────────────────────────────
beforeEach(() => {
  mockEntries = [
    { id: 1, site_id: 'legal',  category: 'Personal Injury', question: 'How do I claim?',   answer: 'Contact us for a free consultation.',  created_at: '2025-01-01' },
    { id: 2, site_id: 'legal',  category: 'Employment',      question: 'Unfair dismissal?', answer: 'We handle employment disputes.',         created_at: '2025-01-01' },
    { id: 3, site_id: 'retail', category: 'Delivery',        question: 'Delivery time?',    answer: '3–5 working days.',                     created_at: '2025-01-01' },
    { id: 4, site_id: 'gov',    category: 'Council Tax',     question: 'How do I pay?',     answer: 'Online, phone, or post office.',         created_at: '2025-01-01' }
  ];
  mockChatLogs = [];
  nextId = 100;
  mockDb.prepare.mockImplementation((sql) => makeMockStatement(sql));
});

// ── Public pages ──────────────────────────────────────────────────────────────
describe('Public pages', () => {
  test('GET / returns the landing page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('chattoweb');
  });

  test('GET /login returns the login page', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Sign in');
  });

  test('GET /logout redirects to /', async () => {
    const res = await request(app).get('/logout');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
describe('Authentication', () => {
  test('POST /login with wrong credentials redirects with error', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'wrong', password: 'wrong' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=1');
  });

  test('POST /login with correct credentials redirects to /chatbot', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'testuser', password: 'testpassword' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/chatbot');
  });
});

// ── Knowledge base — GET ──────────────────────────────────────────────────────
describe('GET /api/kb/:siteId', () => {
  test('returns entries for the legal site', async () => {
    const res = await request(app).get('/api/kb/legal');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body.every(e => e.site_id === 'legal')).toBe(true);
  });

  test('returns entries for the retail site', async () => {
    const res = await request(app).get('/api/kb/retail');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].site_id).toBe('retail');
  });

  test('returns entries for the gov site', async () => {
    const res = await request(app).get('/api/kb/gov');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('returns empty array for a site with no entries', async () => {
    const res = await request(app).get('/api/kb/unknown');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('each entry has required fields', async () => {
    const res = await request(app).get('/api/kb/legal');
    const entry = res.body[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('site_id');
    expect(entry).toHaveProperty('question');
    expect(entry).toHaveProperty('answer');
  });
});

// ── Knowledge base — POST ─────────────────────────────────────────────────────
describe('POST /api/kb', () => {
  test('creates a new entry and returns it with an id', async () => {
    const res = await request(app)
      .post('/api/kb')
      .send({ site_id: 'legal', category: 'Wills', question: 'Do I need a will?', answer: 'Yes, highly recommended.' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.question).toBe('Do I need a will?');
    expect(res.body.site_id).toBe('legal');
  });

  test('uses empty string for category if not provided', async () => {
    const res = await request(app)
      .post('/api/kb')
      .send({ site_id: 'retail', question: 'No category?', answer: 'Fine.' });
    expect(res.status).toBe(200);
    expect(res.body.category).toBe('');
  });

  test('returns 400 if question is missing', async () => {
    const res = await request(app)
      .post('/api/kb')
      .send({ site_id: 'legal', answer: 'Answer without question.' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 if answer is missing', async () => {
    const res = await request(app)
      .post('/api/kb')
      .send({ site_id: 'legal', question: 'Question without answer?' });
    expect(res.status).toBe(400);
  });

  test('returns 400 if site_id is missing', async () => {
    const res = await request(app)
      .post('/api/kb')
      .send({ question: 'Question?', answer: 'Answer.' });
    expect(res.status).toBe(400);
  });
});

// ── Knowledge base — PUT ──────────────────────────────────────────────────────
describe('PUT /api/kb/:id', () => {
  test('updates an existing entry', async () => {
    const res = await request(app)
      .put('/api/kb/1')
      .send({ category: 'Updated Cat', question: 'Updated Q?', answer: 'Updated A.' });
    expect(res.status).toBe(200);
    expect(res.body.question).toBe('Updated Q?');
    expect(res.body.category).toBe('Updated Cat');
  });

  test('returns 400 if question is missing', async () => {
    const res = await request(app)
      .put('/api/kb/1')
      .send({ answer: 'Answer only.' });
    expect(res.status).toBe(400);
  });

  test('returns 400 if answer is missing', async () => {
    const res = await request(app)
      .put('/api/kb/1')
      .send({ question: 'Question only?' });
    expect(res.status).toBe(400);
  });
});

// ── Knowledge base — DELETE ───────────────────────────────────────────────────
describe('DELETE /api/kb/:id', () => {
  test('deletes an entry and returns success', async () => {
    const res = await request(app).delete('/api/kb/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

// ── Sites list ────────────────────────────────────────────────────────────────
describe('GET /api/sites', () => {
  test('returns exactly three sites', async () => {
    const res = await request(app).get('/api/sites');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
  });

  test('each site has id and name', async () => {
    const res = await request(app).get('/api/sites');
    res.body.forEach(site => {
      expect(site).toHaveProperty('id');
      expect(site).toHaveProperty('name');
    });
  });

  test('includes legal, retail, and gov', async () => {
    const res = await request(app).get('/api/sites');
    const ids = res.body.map(s => s.id);
    expect(ids).toContain('legal');
    expect(ids).toContain('retail');
    expect(ids).toContain('gov');
  });
});

// ── Chat endpoint — demo rate limit ──────────────────────────────────────────
describe('POST /api/chat — demo rate limit', () => {
  afterEach(() => {
    app._resetChatCount();
    process.env.CHAT_LIMIT = '0';
  });

  test('returns 429 when the chat limit is reached', async () => {
    process.env.CHAT_LIMIT = '5';
    app._setChatCount(5); // already at the limit
    const res = await request(app)
      .post('/api/chat')
      .send({ siteId: 'legal', messages: [{ role: 'user', content: 'Hello' }] });
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('error');
  });

  test('does not rate-limit when CHAT_LIMIT is 0 (disabled)', async () => {
    process.env.CHAT_LIMIT = '0';
    app._setChatCount(9999);
    const res = await request(app)
      .post('/api/chat')
      .send({ siteId: 'legal', messages: [{ role: 'user', content: 'Hello' }] });
    // Should NOT be 429 — will be 500 (no API key in test env) instead
    expect(res.status).not.toBe(429);
  });
});

// ── Chat endpoint — validation (no live Claude API call in tests) ─────────────
describe('POST /api/chat — input validation', () => {
  test('returns 400 if siteId is missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'Hello' }] });
    expect(res.status).toBe(400);
  });

  test('returns 400 if siteId is not a known site', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ siteId: 'unknown', messages: [{ role: 'user', content: 'Hello' }] });
    expect(res.status).toBe(400);
  });

  test('returns 400 if messages array is missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ siteId: 'legal' });
    expect(res.status).toBe(400);
  });

  test('returns 500 if ANTHROPIC_API_KEY is not configured', async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request(app)
      .post('/api/chat')
      .send({ siteId: 'legal', messages: [{ role: 'user', content: 'Hello' }] });
    expect(res.status).toBe(500);
    if (key) process.env.ANTHROPIC_API_KEY = key;
  });
});

// ── Chat logs ─────────────────────────────────────────────────────────────────
describe('GET /api/logs/:siteId', () => {
  test('returns 200 with an array for a known site', async () => {
    const res = await request(app).get('/api/logs/legal');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns 200 with empty array for a site with no logs', async () => {
    const res = await request(app).get('/api/logs/unknown');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── Recommendations ───────────────────────────────────────────────────────────
describe('GET /api/recommendations/:siteId', () => {
  test('returns 200 with empty recommendations when no chat history exists', async () => {
    const res = await request(app).get('/api/recommendations/legal');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recommendations');
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBe(0);
    expect(res.body).toHaveProperty('message');
  });

  test('returns 500 when logs exist but ANTHROPIC_API_KEY is not set', async () => {
    // Add a log entry
    mockChatLogs.push({
      id: 200, site_id: 'legal', session_id: '', user_message: 'What is your fee?',
      bot_response: 'Our fees vary.', created_at: new Date().toISOString()
    });
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request(app).get('/api/recommendations/legal');
    expect(res.status).toBe(500);
    if (key) process.env.ANTHROPIC_API_KEY = key;
    mockChatLogs = [];
  });
});
