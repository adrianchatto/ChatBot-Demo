const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'chatbot.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function seedDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      category TEXT DEFAULT '',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = database.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();
  if (count.count > 0) return;

  const insert = database.prepare(
    'INSERT INTO knowledge_base (site_id, category, question, answer) VALUES (?, ?, ?, ?)'
  );

  const seed = database.transaction(() => {
    // ── LEGAL: Harrington & Associates ────────────────────────────────────────
    insert.run(
      'legal', 'Personal Injury',
      'How do I make a personal injury claim?',
      'To make a personal injury claim with Harrington & Associates: first, seek medical treatment immediately and keep all records. Report the incident to the relevant party — your employer, the local council, or whoever is responsible. Gather evidence including photographs, witness contact details, and CCTV footage if available. Then contact us for a free initial consultation. Most personal injury claims are handled on a no-win, no-fee basis, meaning there are no upfront costs to you.'
    );
    insert.run(
      'legal', 'Personal Injury',
      'What is no-win, no-fee?',
      'No-win, no-fee (formally a Conditional Fee Agreement, or CFA) means you only pay our legal fees if your case is successful. If you win, our fee is typically recovered from the other side. If you lose, you pay nothing. This arrangement makes legal representation accessible without upfront costs. We explain all costs clearly before you commit to anything — no surprises.'
    );
    insert.run(
      'legal', 'Personal Injury',
      'How long do I have to make a claim?',
      'In most personal injury cases you have three years from the date of the accident to bring a claim. For medical negligence it is three years from when you became aware of the negligence. Claims involving children must be made within three years of their 18th birthday. We strongly recommend seeking advice promptly — early action preserves evidence and strengthens your case.'
    );
    insert.run(
      'legal', 'Employment Law',
      'Can you help with employment disputes?',
      'Yes. Our employment law team handles unfair dismissal, redundancy, workplace discrimination, harassment, TUPE transfers, and settlement agreements. We offer a free 30-minute initial consultation. Employment tribunal claims generally must be filed within three months of the event, so prompt advice is important. Call 020 7946 0000 to book.'
    );
    insert.run(
      'legal', 'Conveyancing',
      'Can you help with buying or selling a property?',
      'Yes. Our conveyancing team handles residential and commercial property transactions, both leasehold and freehold. We provide a fixed-fee quote upfront with no hidden charges. Our average completion time is 10–12 weeks for a straightforward purchase. Contact us for a no-obligation quote — we are happy to talk you through the process.'
    );
    insert.run(
      'legal', 'General',
      'How do I book a consultation?',
      'You can book a consultation by calling us on 020 7946 0000, emailing info@harringtonlaw.co.uk, or using the contact form on our website. Initial consultations for personal injury and employment matters are free of charge. Our offices are open Monday to Friday, 9am–6pm, and Saturday by appointment.'
    );

    // ── RETAIL: Botanica Home ─────────────────────────────────────────────────
    insert.run(
      'retail', 'Orders & Delivery',
      'What is your returns policy?',
      'You can return most items within 30 days of delivery for a full refund, provided they are unused and in original packaging. Sale items can be exchanged or returned for store credit only. To start a return, log into your account, go to Orders, and select Return Item. We will email you a prepaid returns label within 24 hours. Refunds are processed within 5–7 working days of us receiving the item.'
    );
    insert.run(
      'retail', 'Orders & Delivery',
      'How long does delivery take?',
      'Standard delivery takes 3–5 working days and is free on orders over £50 (otherwise £3.99). Express delivery — next working day if ordered before 2pm — costs £5.99. Saturday delivery is available for £7.99. You will receive a tracking link by email as soon as your order is dispatched from our warehouse.'
    );
    insert.run(
      'retail', 'Orders & Delivery',
      'How do I track my order?',
      'Once dispatched, you will receive an email with your tracking number and a link to the courier tracking page. You can also log into your Botanica account, go to My Orders, and click Track. If you ordered as a guest, use the tracking number from your dispatch email on the courier website directly. If your tracking shows no movement for more than 48 hours, please contact our team.'
    );
    insert.run(
      'retail', 'Products',
      'Are your products sustainably sourced?',
      'Sustainability is central to everything we do. Over 80% of our range is made from natural, recycled, or sustainably certified materials. Every product page shows its sustainability credentials. We are a certified B Corp member and are working towards 100% sustainable sourcing by 2027. All our packaging is plastic-free across the entire range.'
    );
    insert.run(
      'retail', 'Products',
      'Do you offer gift wrapping?',
      'Yes, gift wrapping is available for £3.95 per item, added during checkout. Include a personal message card at no extra charge. We use recycled kraft paper and natural ribbon — no plastic. Please note that gift-wrapped items cannot be returned for hygiene reasons unless faulty.'
    );
    insert.run(
      'retail', 'Account & Payments',
      'What payment methods do you accept?',
      'We accept Visa, Mastercard, American Express, PayPal, Apple Pay, Google Pay, and Klarna (buy now, pay later in three interest-free instalments). All transactions are secured with 256-bit SSL encryption. We do not store card details on our servers.'
    );

    // ── GOVERNMENT: Northgate District Council ────────────────────────────────
    insert.run(
      'gov', 'Council Tax',
      'How do I pay my council tax?',
      'You can pay council tax online via our website using a debit or credit card, set up a Direct Debit (the easiest option — we handle reminders automatically), pay by phone on 01632 960000 (24/7 automated service), or pay in person at any Post Office. Council tax is payable in 10 monthly instalments (April to January) as standard, or you can request 12 instalments by contacting us.'
    );
    insert.run(
      'gov', 'Council Tax',
      'How do I challenge my council tax band?',
      'Council tax bands are set by the Valuation Office Agency (VOA), not the council. If you believe your band is wrong, contact the VOA directly at gov.uk/challenge-council-tax-band. You will need evidence that comparable properties in your street are banded lower. Successful appeals can go back to 1993, potentially resulting in a refund. Call our Council Tax team on 01632 960000 if you need guidance before contacting the VOA.'
    );
    insert.run(
      'gov', 'Planning',
      'How do I apply for planning permission?',
      'Planning applications are submitted via the Planning Portal at planningportal.co.uk, or directly to us. You will need site plans, existing and proposed drawings, and the relevant application fee. Householder applications — extensions, loft conversions — cost £258. Decisions typically take 8 weeks. Pre-application advice from our planning team is strongly recommended for larger projects; call 01632 960200 to book.'
    );
    insert.run(
      'gov', 'Waste & Recycling',
      'When is my bin collected?',
      'Collection days vary by area. Use the Bin Day Finder on our website — enter your postcode — to see your schedule and sign up for email reminders. General waste and recycling are collected weekly; garden waste is collected fortnightly from April to November. If your bin was missed, report it online within 24 hours and we will arrange a collection within 3 working days.'
    );
    insert.run(
      'gov', 'Roads & Environment',
      'How do I report a pothole or road problem?',
      'Report potholes and road defects using the Report It tool on our website, or call 01632 961000. Include the exact location — postcode or nearest landmark — and a description of the problem. We aim to inspect all reports within 3 working days. Safety-critical defects are repaired within 24 hours. You will receive a reference number by email to track the status of your report online.'
    );
    insert.run(
      'gov', 'Housing & Benefits',
      'How do I apply for housing benefit?',
      'If you are of working age, housing costs are covered through Universal Credit, administered by the DWP — not the council. Apply at gov.uk/universal-credit. If you are pension age, you may be eligible for Housing Benefit from us. Apply online via our website or call our Benefits team on 01632 960100, Monday to Friday 9am–5pm. Have proof of identity, your tenancy agreement, and income details to hand before calling.'
    );
  });

  seed();
  console.log('Database seeded with demo data.');
}

// Used in tests to get a clean database instance
function resetDb() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

module.exports = { getDb, seedDatabase, resetDb };
