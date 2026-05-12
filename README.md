# chattoweb.com — AI Chat Demo Platform

A production-ready platform for demonstrating Claude-powered chatbots across multiple client sectors. Built to be shown to clients and to have the chatbot widget extracted and deployed on any third-party site with a single script tag.

---

## What this is

chattoweb is a multi-tenant chatbot demo platform. It runs three sector-specific demo sites — legal, retail, and government — each with a Claude-powered chat widget trained on an editable knowledge base. It includes a management portal for maintaining that knowledge base without touching any code.

The platform is designed so the chatbot widget can be extracted and embedded on any third-party website in minutes.

---

## Architecture

```
Browser
  └── Express server (server.js)
        ├── Public routes: /, /login, /logout
        ├── Protected routes (require session auth)
        │     ├── /chatbot — hub listing all demos
        │     ├── /chatbot/legal  → sites/legal/
        │     ├── /chatbot/retail → sites/retail/
        │     ├── /chatbot/gov    → sites/gov/
        │     └── /admin          → admin/
        └── API routes (all require auth)
              ├── POST /api/chat  — streaming SSE to Claude
              ├── GET  /api/kb/:siteId — knowledge base entries
              ├── POST /api/kb — create entry
              ├── PUT  /api/kb/:id — update entry
              ├── DELETE /api/kb/:id — delete entry
              └── GET  /api/sites — list available sites
```

**Database:** SQLite via `better-sqlite3`. Single file (`chatbot.db`), seeded with demo data on first run.

**AI:** Claude API (claude-haiku-4-5) with streaming Server-Sent Events (SSE). Each chat request fetches the full knowledge base for the selected site and passes it as system context.

**Auth:** Express session with a single shared credential (DEMO_USER / DEMO_PASSWORD). 24-hour cookie, `httpOnly`. All API routes and protected pages require a valid session. Auth middleware is bypassed in test mode.

**Embedding:** A standalone `public/widget.js` script can be dropped onto any third-party site — see the embedding section below.

---

## Tech stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Server     | Node.js + Express                   |
| Database   | SQLite (better-sqlite3)             |
| AI         | Anthropic Claude API (Haiku model)  |
| Auth       | express-session                     |
| Streaming  | Server-Sent Events (SSE)            |
| Testing    | Jest + Supertest (database mocked)  |
| Hosting    | Render (Starter plan, always-on)    |
| Domain     | chattoweb.com (Squarespace DNS)     |

---

## File structure

```
/
├── server.js              — Express server, all routes and API logic
├── database.js            — SQLite setup, schema, seed data
├── package.json
├── jest.config.js
├── .env.example           — Environment variable reference
├── .node-version          — Pins Node 20 for Render deployment
│
├── public/
│   ├── landing.html       — Public homepage (chattoweb.com)
│   ├── login.html         — Login form
│   ├── hub.html           — Protected demo hub
│   └── widget.js          — Standalone embeddable chat widget
│
├── sites/
│   ├── legal/index.html   — Harrington & Associates demo
│   ├── retail/index.html  — Botanica Home demo
│   └── gov/index.html     — Northgate District Council demo
│
├── admin/
│   └── index.html         — Knowledge base management portal
│
├── tests/
│   ├── setup.js           — Test environment config
│   └── backend/
│       └── api.test.js    — Full backend test suite (28 tests)
│
├── stories/
│   ├── STORY-TEMPLATE.md
│   └── STORY-NNN-*.md     — One file per feature story
│
└── AGENTS.md              — Development workflow documentation
```

---

## Environment variables

Create a `.env` file from `.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...    # Required — your Anthropic API key
DEMO_USER=your-username          # Login username for the platform
DEMO_PASSWORD=your-password      # Login password for the platform
SESSION_SECRET=random-string     # Secret for signing session cookies
PORT=3000                        # Optional — defaults to 3000
MODEL=claude-haiku-4-5-20251001  # Optional — Claude model to use
CHAT_LIMIT=25                    # Optional — max chat requests (0 = unlimited)
```

---

## Local development

**Requirements:** Node.js 20+

```bash
git clone https://github.com/adrianchatto/ChatBot-Demo.git
cd ChatBot-Demo
npm install
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY, DEMO_USER, DEMO_PASSWORD, SESSION_SECRET
npm run dev
```

Open `http://localhost:3000`.

The database (`chatbot.db`) is created and seeded automatically on first run. To reset it, delete `chatbot.db` and restart.

---

## Running tests

```bash
npm test           # Run all tests once
npm run test:watch # Watch mode during development
```

Tests are fully platform-independent — the SQLite database is mocked with Jest, so there is no native binary dependency and tests run in any CI environment.

```
28 tests across:
  - Public pages (landing, login, logout)
  - Authentication (valid / invalid credentials)
  - Knowledge base CRUD (GET, POST, PUT, DELETE)
  - Sites list
  - Chat input validation
  - Demo rate limit (429 behaviour)
```

---

## Deployment (Render)

The platform is hosted on Render. On every push to `main`, Render rebuilds and redeploys automatically.

**Initial setup:**

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect the GitHub repo: `adrianchatto/ChatBot-Demo`
3. Set the following:
   - **Name:** chattoweb
   - **Branch:** main
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Instance type:** Starter ($7/month — required to avoid 15-minute spin-down)
4. Add environment variables (ANTHROPIC_API_KEY, DEMO_USER, DEMO_PASSWORD, SESSION_SECRET)
5. Deploy

The `.node-version` file pins Node 20, which ensures `better-sqlite3` uses a prebuilt binary rather than compiling from source.

---

## DNS (chattoweb.com)

The domain is registered via Squarespace (migrated from Google Domains, July 2024).

To point `chattoweb.com` at Render:

1. Log in at [account.squarespace.com/domains](https://account.squarespace.com/domains)
2. Select `chattoweb.com` → DNS
3. Add a **CNAME** record:
   - Name: `www`
   - Value: your Render service URL (e.g. `chatbot-demo-b742.onrender.com`)
4. For the apex domain (`chattoweb.com` without www), Render recommends using their IP addresses as A records — check the Render dashboard under Settings → Custom Domains for the current IPs.
5. In Render → Settings → Custom Domains, add `chattoweb.com` and `www.chattoweb.com`. Render provisions a free TLS certificate automatically.

DNS propagation typically takes 10–30 minutes.

---

## Admin knowledge base portal

The admin portal lives at `/admin`. It is protected by the same login as the rest of the platform.

**To use it:**

1. Sign in at `/login`
2. Navigate to `/admin`
3. Use the dropdown in the left sidebar to select a site (Legal, Retail, or Government)
4. The table shows all Q&A entries for that site

**Adding an entry:**
- Click **Add Entry** (top right)
- Fill in: Category (optional grouping label, e.g. "Delivery"), Question, Answer
- Save — the bot uses this answer immediately, no restart needed

**Editing an entry:**
- Click the pencil icon on any row
- Amend the fields and save

**Deleting an entry:**
- Click the bin icon on any row — this is immediate

**Categories** are a free-text label used to group related entries. They appear in the table but do not affect how the bot behaves — they are purely organisational.

The chatbot reads the complete knowledge base for the active site on every conversation. If something is not in the knowledge base, the bot will say so and suggest the user contact the team directly.

---

## Embedding the chatbot widget on any site

The widget is a single self-contained JavaScript file. No frameworks, no dependencies, no build step required on the client site.

### Quick start

Add one script tag to any HTML page — that is the entire integration:

```html
<script
  src="https://chatbot-demo-b742.onrender.com/widget.js"
  data-site="legal"
  data-api="https://chatbot-demo-b742.onrender.com"
></script>
```

Replace `chatbot-demo-b742.onrender.com` with your actual Render URL (or `chattoweb.com` once DNS is configured).

Place the script tag just before `</body>`. It injects its own styles and DOM — no CSS file or HTML markup needed.

### Configuration attributes

| Attribute     | Required | Description                                          | Default          |
|---------------|----------|------------------------------------------------------|------------------|
| `data-site`   | Yes      | Site ID — must match a site on your platform         | —                |
| `data-api`    | Yes      | Base URL of your chattoweb platform (no trailing /)  | —                |
| `data-title`  | No       | Text shown in the chat panel header                  | "Chat with us"   |
| `data-color`  | No       | Primary accent colour (any valid hex, e.g. `#c4a25a`)| `#1e40af`        |

### Full example with all options

```html
<script
  src="https://chatbot-demo-b742.onrender.com/widget.js"
  data-site="legal"
  data-api="https://chatbot-demo-b742.onrender.com"
  data-title="Speak to our legal team"
  data-color="#1B2B5E"
></script>
```

### CORS

The platform allows cross-origin requests (`cors()` middleware is enabled). The widget calls `/api/chat` from the third-party domain — this works without any additional configuration on the embedding site.

If you need to restrict origins in production, edit `server.js` and replace:

```javascript
app.use(cors());
```

with:

```javascript
app.use(cors({ origin: ['https://yourclientsite.com', 'https://chattoweb.com'] }));
```

### Authentication note

`/api/chat` currently requires a session cookie (the same login session used by the platform). For public widget embedding on a third-party site where users are not logged in to chattoweb, you need to either:

**Option A — Make `/api/chat` public (simplest for demo):**
Remove `requireAuth` from the chat route in `server.js`:

```javascript
// Before (protected):
app.post('/api/chat', requireAuth, async (req, res) => {

// After (public):
app.post('/api/chat', async (req, res) => {
```

**Option B — API key auth (recommended for production):**
Replace session auth on `/api/chat` with a per-client API key header, issued when a client signs up. This is a planned feature (Story 002).

For demo purposes, Option A is the fastest path.

### Matching the widget to a client's brand

The `data-color` attribute controls the accent colour (button, header, user message bubbles, input focus ring). The widget automatically calculates whether to use white or dark text on top of the colour based on luminance.

To fully white-label the widget (rename, custom logo, different position), the source is in `public/widget.js` and is readable, well-commented plain JavaScript.

### Testing the embedded widget locally

```html
<!DOCTYPE html>
<html>
<head><title>Widget test</title></head>
<body>
  <h1>My client site</h1>

  <script
    src="http://localhost:3000/widget.js"
    data-site="retail"
    data-api="http://localhost:3000"
    data-title="Botanica Home Support"
    data-color="#2D5016"
  ></script>
</body>
</html>
```

Open this file in a browser while `npm run dev` is running. The widget appears bottom-right.

---

## Development workflow

See [AGENTS.md](./AGENTS.md) for the full three-agent TDD workflow (PM → Backend Agent → Frontend Agent).

The short version: no code ships without a failing test written first. Stories are tracked in `stories/`. The PM coordinates; you interact only with the PM.

---

## Demo chat limit

The `CHAT_LIMIT` environment variable caps the total number of chat requests the platform will accept before returning a `429` response. This is a global counter that resets on server restart.

- Set to `25` on Render for controlled demos
- Set to `0` to disable entirely
- The widget handles the `429` gracefully — it shows a message and disables the input
- Increase or change via Render's Environment settings without redeploying

---

## Key decisions and constraints

**Single Express server** — all sites, the admin portal, and the API run from one process. Simple to deploy and reason about. If traffic grows, each site could be split into separate services.

**SQLite over PostgreSQL** — sufficient for demo volumes, zero infrastructure cost, trivial to seed. Render's persistent disk keeps the database alive across restarts on paid plans.

**SSE over WebSockets** — simpler, works over HTTP/1.1, and Claude's API streams naturally into SSE. No socket management or reconnection logic needed.

**Path-based routing over subdomains** — `/chatbot/legal` rather than `legal.chattoweb.com`. Avoids wildcard DNS and TLS complexity on the current hosting tier.

**Session auth over JWT** — stateful sessions are simpler for a demo with a single known user. JWT would be needed for a multi-tenant public deployment.
