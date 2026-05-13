/**
 * database.js — Data access layer
 *
 * Current adapter: SQLite via better-sqlite3 (synchronous).
 * Persistent storage: set DB_PATH to a mounted Render disk (e.g. /var/data/chatbot.db)
 * so the file survives deploys and container restarts.
 *
 * ── Migrating to Azure ────────────────────────────────────────────────────────
 * When you're ready to move to Azure Database for PostgreSQL or Azure SQL:
 *
 * 1. Add your async driver (e.g. `npm install pg` or `npm install mssql`)
 * 2. Replace the implementations below with async equivalents
 * 3. Add `await` in front of every db call in server.js
 * 4. Set DATABASE_URL in your environment instead of DB_PATH
 *
 * All SQL is centralised here — server.js stays clean throughout.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Database = require('better-sqlite3');
const path = require('path');

let db;

// ── Connection ────────────────────────────────────────────────────────────────

function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'chatbot.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// ── Schema ────────────────────────────────────────────────────────────────────

function seedDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id     TEXT    NOT NULL,
      category    TEXT    DEFAULT '',
      question    TEXT    NOT NULL,
      answer      TEXT    NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id      TEXT    NOT NULL,
      session_id   TEXT    DEFAULT '',
      user_message TEXT    NOT NULL,
      bot_response TEXT    NOT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS guardrails (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id          TEXT    NOT NULL UNIQUE,
      blocked_topics   TEXT    DEFAULT '',
      off_topic_reply  TEXT    DEFAULT '',
      strict_kb_mode   INTEGER DEFAULT 0,
      updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = database.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();
  if (count.count > 0) return;

  const insert = database.prepare(
    'INSERT INTO knowledge_base (site_id, category, question, answer) VALUES (?, ?, ?, ?)'
  );

  const seed = database.transaction(() => {
    // ── LEGAL: Harrington & Associates ────────────────────────────────────────
    insert.run('legal', 'Personal Injury', 'How do I make a personal injury claim?',
      'To make a personal injury claim with Harrington & Associates: first, seek medical treatment immediately and keep all records. Report the incident to the relevant party — your employer, the local council, or whoever is responsible. Gather evidence including photographs, witness contact details, and CCTV footage if available. Then contact us for a free initial consultation. Most personal injury claims are handled on a no-win, no-fee basis, meaning there are no upfront costs to you.');
    insert.run('legal', 'Personal Injury', 'What is no-win, no-fee?',
      'No-win, no-fee (formally a Conditional Fee Agreement, or CFA) means you only pay our legal fees if your case is successful. If you win, our fee is typically recovered from the other side. If you lose, you pay nothing. This arrangement makes legal representation accessible without upfront costs. We explain all costs clearly before you commit to anything — no surprises.');
    insert.run('legal', 'Personal Injury', 'How long do I have to make a claim?',
      'In most personal injury cases you have three years from the date of the accident to bring a claim. For medical negligence it is three years from when you became aware of the negligence. Claims involving children must be made within three years of their 18th birthday. We strongly recommend seeking advice promptly — early action preserves evidence and strengthens your case.');
    insert.run('legal', 'Employment Law', 'Can you help with employment disputes?',
      'Yes. Our employment law team handles unfair dismissal, redundancy, workplace discrimination, harassment, TUPE transfers, and settlement agreements. We offer a free 30-minute initial consultation. Employment tribunal claims generally must be filed within three months of the event, so prompt advice is important. Call 020 7946 0000 to book.');
    insert.run('legal', 'Conveyancing', 'Can you help with buying or selling a property?',
      'Yes. Our conveyancing team handles residential and commercial property transactions, both leasehold and freehold. We provide a fixed-fee quote upfront with no hidden charges. Our average completion time is 10–12 weeks for a straightforward purchase. Contact us for a no-obligation quote — we are happy to talk you through the process.');
    insert.run('legal', 'General', 'How do I book a consultation?',
      'You can book a consultation by calling us on 020 7946 0000, emailing info@harringtonlaw.co.uk, or using the contact form on our website. Initial consultations for personal injury and employment matters are free of charge. Our offices are open Monday to Friday, 9am–6pm, and Saturday by appointment.');

    // ── RETAIL: Botanica Home ─────────────────────────────────────────────────
    insert.run('retail', 'Orders & Delivery', 'What is your returns policy?',
      'You can return most items within 30 days of delivery for a full refund, provided they are unused and in original packaging. Sale items can be exchanged or returned for store credit only. To start a return, log into your account, go to Orders, and select Return Item. We will email you a prepaid returns label within 24 hours. Refunds are processed within 5–7 working days of us receiving the item.');
    insert.run('retail', 'Orders & Delivery', 'How long does delivery take?',
      'Standard delivery takes 3–5 working days and is free on orders over £50 (otherwise £3.99). Express delivery — next working day if ordered before 2pm — costs £5.99. Saturday delivery is available for £7.99. You will receive a tracking link by email as soon as your order is dispatched from our warehouse.');
    insert.run('retail', 'Orders & Delivery', 'How do I track my order?',
      'Once dispatched, you will receive an email with your tracking number and a link to the courier tracking page. You can also log into your Botanica account, go to My Orders, and click Track. If you ordered as a guest, use the tracking number from your dispatch email on the courier website directly. If your tracking shows no movement for more than 48 hours, please contact our team.');
    insert.run('retail', 'Products', 'Are your products sustainably sourced?',
      'Sustainability is central to everything we do. Over 80% of our range is made from natural, recycled, or sustainably certified materials. Every product page shows its sustainability credentials. We are a certified B Corp member and are working towards 100% sustainable sourcing by 2027. All our packaging is plastic-free across the entire range.');
    insert.run('retail', 'Products', 'Do you offer gift wrapping?',
      'Yes, gift wrapping is available for £3.95 per item, added during checkout. Include a personal message card at no extra charge. We use recycled kraft paper and natural ribbon — no plastic. Please note that gift-wrapped items cannot be returned for hygiene reasons unless faulty.');
    insert.run('retail', 'Account & Payments', 'What payment methods do you accept?',
      'We accept Visa, Mastercard, American Express, PayPal, Apple Pay, Google Pay, and Klarna (buy now, pay later in three interest-free instalments). All transactions are secured with 256-bit SSL encryption. We do not store card details on our servers.');

    // ── GOVERNMENT: Northgate District Council ────────────────────────────────
    insert.run('gov', 'Council Tax', 'How do I pay my council tax?',
      'You can pay council tax online via our website using a debit or credit card, set up a Direct Debit (the easiest option — we handle reminders automatically), pay by phone on 01632 960000 (24/7 automated service), or pay in person at any Post Office. Council tax is payable in 10 monthly instalments (April to January) as standard, or you can request 12 instalments by contacting us.');
    insert.run('gov', 'Council Tax', 'How do I challenge my council tax band?',
      'Council tax bands are set by the Valuation Office Agency (VOA), not the council. If you believe your band is wrong, contact the VOA directly at gov.uk/challenge-council-tax-band. You will need evidence that comparable properties in your street are banded lower. Successful appeals can go back to 1993, potentially resulting in a refund. Call our Council Tax team on 01632 960000 if you need guidance before contacting the VOA.');
    insert.run('gov', 'Planning', 'How do I apply for planning permission?',
      'Planning applications are submitted via the Planning Portal at planningportal.co.uk, or directly to us. You will need site plans, existing and proposed drawings, and the relevant application fee. Householder applications — extensions, loft conversions — cost £258. Decisions typically take 8 weeks. Pre-application advice from our planning team is strongly recommended for larger projects; call 01632 960200 to book.');
    insert.run('gov', 'Waste & Recycling', 'When is my bin collected?',
      'Collection days vary by area. Use the Bin Day Finder on our website — enter your postcode — to see your schedule and sign up for email reminders. General waste and recycling are collected weekly; garden waste is collected fortnightly from April to November. If your bin was missed, report it online within 24 hours and we will arrange a collection within 3 working days.');
    insert.run('gov', 'Roads & Environment', 'How do I report a pothole or road problem?',
      'Report potholes and road defects using the Report It tool on our website, or call 01632 961000. Include the exact location — postcode or nearest landmark — and a description of the problem. We aim to inspect all reports within 3 working days. Safety-critical defects are repaired within 24 hours. You will receive a reference number by email to track the status of your report online.');
    insert.run('gov', 'Housing & Benefits', 'How do I apply for housing benefit?',
      'If you are of working age, housing costs are covered through Universal Credit, administered by the DWP — not the council. Apply at gov.uk/universal-credit. If you are pension age, you may be eligible for Housing Benefit from us. Apply online via our website or call our Benefits team on 01632 960100, Monday to Friday 9am–5pm. Have proof of identity, your tenancy agreement, and income details to hand before calling.');
    // ── ACCOUNTING: Hadley Advisory ───────────────────────────────────────────
    insert.run('hadley', 'Services', 'What services does Hadley Advisory offer?',
      'Hadley Advisory provides a full range of accountancy services including: statutory accounts preparation, corporation tax and self-assessment returns, VAT registration and returns, bookkeeping and management accounts, payroll administration, business advisory and financial planning. We work with sole traders, partnerships, limited companies, and not-for-profit organisations. Book a free initial consultation to discuss what you need.');
    insert.run('hadley', 'Services', 'Do you work with small businesses and sole traders?',
      'Yes — the majority of our clients are small and medium-sized businesses, sole traders, and freelancers. We understand the pressures of running your own business and offer straightforward, jargon-free advice. We have fixed-fee packages designed specifically for smaller businesses, with no unexpected bills. Get in touch to find out which package suits you.');
    insert.run('hadley', 'Services', 'Can you help me set up a new limited company?',
      'Yes. We can handle Companies House incorporation, register you for Corporation Tax with HMRC, set up your bookkeeping software, and advise on the most tax-efficient structure from day one. Many clients find it saves significant money and time to get this right at the start. Call us on 020 3456 7890 or email hello@hadleyadvisory.co.uk to get started.');
    insert.run('hadley', 'Tax', 'When is my corporation tax due?',
      'Corporation tax is due nine months and one day after your company\'s accounting year end. For example, if your year ends 31 March, payment is due by 1 January the following year. Your tax return must be filed with HMRC within 12 months of the year end. We handle the calculation, filing, and can set up a payment reminder so you are never caught out.');
    insert.run('hadley', 'Tax', 'Do you complete self-assessment tax returns?',
      'Yes. We prepare and file self-assessment returns for directors, sole traders, landlords, and individuals with complex income (investments, overseas income, etc.). We gather your figures, prepare the return, check it for accuracy, and file it with HMRC — all you need to do is review and approve. Avoid the January rush by getting in touch early; we work on a first-come, first-served basis each year.');
    insert.run('hadley', 'Tax', 'What is Making Tax Digital and does it affect me?',
      'Making Tax Digital (MTD) is HMRC\'s programme to move tax records and submissions online. MTD for VAT is already mandatory for all VAT-registered businesses. MTD for Income Tax (MTD ITSA) will apply to sole traders and landlords with income over £50,000 from April 2026, and over £30,000 from April 2027. We can set you up with compliant software and handle submissions on your behalf — contact us if you\'re unsure whether you\'re affected.');
    insert.run('hadley', 'Tax', 'How can I reduce my tax bill legally?',
      'There are a number of legitimate ways to reduce your tax liability depending on your situation — pension contributions, allowable business expenses, timing of dividends, use of ISA allowances, and more. We review tax efficiency as a standard part of our annual accounts process. For tailored planning, book a tax advisory consultation. We never recommend schemes that carry HMRC risk — only straightforward, compliant planning.');
    insert.run('hadley', 'Bookkeeping', 'Do you offer bookkeeping services?',
      'Yes. We offer monthly and quarterly bookkeeping using cloud software including Xero, QuickBooks, and FreeAgent. Our bookkeeping service includes bank reconciliation, purchase and sales ledger maintenance, and management account preparation. We can work alongside your existing staff or take on the full function. Accurate, up-to-date books also mean your year-end accounts cost less to prepare.');
    insert.run('hadley', 'Bookkeeping', 'Which accounting software do you use?',
      'We work primarily with Xero, QuickBooks Online, and FreeAgent. All three are HMRC-recognised for Making Tax Digital. We can advise on the best fit for your business size and sector, handle the setup and migration, and provide training for you or your team. We are a Xero Certified Advisor and QuickBooks ProAdvisor.');
    insert.run('hadley', 'Fees', 'How much do you charge?',
      'We offer transparent fixed-fee packages rather than hourly billing, so you always know what to expect. Sole trader packages start from £75 per month; limited company packages from £150 per month. These typically include annual accounts, tax return, and quarterly check-ins. More complex requirements are priced individually. Book a free 30-minute consultation and we\'ll give you a written quote with no obligation.');
    insert.run('hadley', 'Fees', 'Is there a free initial consultation?',
      'Yes — we offer a free 30-minute introductory call for all new enquiries. This gives us a chance to understand your situation and for you to ask any questions before committing. There is no pressure and no obligation. You can book via our website or call 020 3456 7890 Monday to Friday, 9am–5:30pm.');
    insert.run('hadley', 'Switching', 'How do I switch to Hadley Advisory from my current accountant?',
      'Switching is straightforward and we handle the process for you. Once you instruct us, we contact your previous accountant professionally to request your records and obtain a clearance letter. There is nothing for you to do except sign an authority letter. The whole handover typically takes two to three weeks. Many clients are surprised by how easy it is — we do it every week.');
    insert.run('hadley', 'Records', 'What financial records do I need to keep and for how long?',
      'HMRC requires most businesses to keep financial records for at least six years from the end of the accounting period they relate to. This includes invoices, receipts, bank statements, payroll records, and VAT records. For companies, certain records must be kept for the company\'s lifetime. We recommend cloud-based storage — if you use our bookkeeping service, your records are automatically retained and organised.');
    insert.run('hadley', 'Payroll', 'Can you run my payroll?',
      'Yes. We offer a fully managed payroll service for businesses with one to 200 employees. This includes calculating PAYE and National Insurance, producing payslips, submitting Real Time Information (RTI) returns to HMRC, and administering pension contributions under auto-enrolment. We handle all the filing deadlines so you never face HMRC penalties. Contact us for a payroll-only quote.');
    insert.run('hadley', 'Contact', 'How do I contact Hadley Advisory?',
      'You can reach us by phone on 020 3456 7890, Monday to Friday 9am–5:30pm. Email us any time at hello@hadleyadvisory.co.uk. Our office is at 14 Finsbury Square, London, EC2A 1AQ. For new enquiries, the quickest route is our website contact form — we aim to respond within one working day. We also offer video meetings if you prefer not to come in person.');
  });

  seed();

  // Seed guardrails defaults (INSERT OR IGNORE so existing configs are preserved)
  const insertGuardrail = database.prepare(`
    INSERT OR IGNORE INTO guardrails (site_id, blocked_topics, off_topic_reply, strict_kb_mode)
    VALUES (?, ?, ?, ?)
  `);

  insertGuardrail.run(
    'legal',
    'medical advice, financial investment advice, competitor law firms, predictions on legal outcomes, immigration advice',
    "I'm only able to assist with legal enquiries for Harrington & Associates. For anything outside that scope, please call us on 020 7946 0000 or email info@harringtonlaw.co.uk.",
    0
  );
  insertGuardrail.run(
    'retail',
    'competitor brands and products, medical or health claims, cooking and recipes, political topics, anything unrelated to Botanica Home',
    "I can only help with questions about Botanica Home products, orders, delivery, and returns. Is there something I can help you with today?",
    0
  );
  insertGuardrail.run(
    'gov',
    'political party opinions, party politics, immigration advice, medical advice, legal advice, personal financial advice, benefit eligibility decisions',
    "I can only assist with Northgate District Council services. For other queries, please visit our website or call 01632 960000.",
    1
  );
  insertGuardrail.run(
    'hadley',
    'competitor accountancy firms, specific tax avoidance schemes, HMRC penalties already incurred (direct to HMRC or a tax specialist), legal disputes, medical advice, investment advice',
    "I can help with general accountancy and tax questions for Hadley Advisory. For anything specific to your situation, please book a free consultation — we are happy to help. Call 020 3456 7890 or email hello@hadleyadvisory.co.uk.",
    0
  );

  console.log('Database seeded with demo data.');
}

// ── Knowledge base ────────────────────────────────────────────────────────────

function getKbEntries(siteId) {
  return getDb()
    .prepare('SELECT * FROM knowledge_base WHERE site_id = ? ORDER BY category, id')
    .all(siteId);
}

function getKbForPrompt(siteId) {
  return getDb()
    .prepare('SELECT category, question, answer FROM knowledge_base WHERE site_id = ? ORDER BY category')
    .all(siteId);
}

function getKbQuestions(siteId) {
  return getDb()
    .prepare('SELECT question FROM knowledge_base WHERE site_id = ?')
    .all(siteId);
}

function insertKbEntry(siteId, category, question, answer) {
  const result = getDb()
    .prepare('INSERT INTO knowledge_base (site_id, category, question, answer) VALUES (?, ?, ?, ?)')
    .run(siteId, category || '', question, answer);
  return getDb().prepare('SELECT * FROM knowledge_base WHERE id = ?').get(result.lastInsertRowid);
}

function updateKbEntry(id, category, question, answer) {
  getDb()
    .prepare('UPDATE knowledge_base SET category = ?, question = ?, answer = ? WHERE id = ?')
    .run(category || '', question, answer, id);
  return getDb().prepare('SELECT * FROM knowledge_base WHERE id = ?').get(id);
}

function deleteKbEntry(id) {
  getDb().prepare('DELETE FROM knowledge_base WHERE id = ?').run(id);
}

// ── Chat logs ─────────────────────────────────────────────────────────────────

function insertChatLog(siteId, sessionId, userMessage, botResponse) {
  getDb()
    .prepare('INSERT INTO chat_logs (site_id, session_id, user_message, bot_response) VALUES (?, ?, ?, ?)')
    .run(siteId, sessionId || '', userMessage, botResponse);
}

function getChatLogs(siteId, limit = 100) {
  return getDb()
    .prepare('SELECT id, site_id, user_message, bot_response, created_at FROM chat_logs WHERE site_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(siteId, limit);
}

function getRecentConversations(siteId, limit = 50) {
  return getDb()
    .prepare('SELECT user_message, bot_response FROM chat_logs WHERE site_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(siteId, limit);
}

// ── Guardrails ────────────────────────────────────────────────────────────────

function getGuardrails(siteId) {
  return getDb()
    .prepare('SELECT * FROM guardrails WHERE site_id = ?')
    .get(siteId) || { site_id: siteId, blocked_topics: '', off_topic_reply: '', strict_kb_mode: 0 };
}

function upsertGuardrails(siteId, blockedTopics, offTopicReply, strictKbMode) {
  getDb().prepare(`
    INSERT INTO guardrails (site_id, blocked_topics, off_topic_reply, strict_kb_mode, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(site_id) DO UPDATE SET
      blocked_topics  = excluded.blocked_topics,
      off_topic_reply = excluded.off_topic_reply,
      strict_kb_mode  = excluded.strict_kb_mode,
      updated_at      = CURRENT_TIMESTAMP
  `).run(siteId, blockedTopics || '', offTopicReply || '', strictKbMode ? 1 : 0);
  return getGuardrails(siteId);
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function resetDb() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

module.exports = {
  getDb,
  seedDatabase,
  resetDb,
  // Knowledge base
  getKbEntries,
  getKbForPrompt,
  getKbQuestions,
  insertKbEntry,
  updateKbEntry,
  deleteKbEntry,
  // Chat logs
  insertChatLog,
  getChatLogs,
  getRecentConversations,
  // Guardrails
  getGuardrails,
  upsertGuardrails,
};
