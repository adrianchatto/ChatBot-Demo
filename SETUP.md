# Chatbot Demo — Setup Guide

Three demo sites + admin portal powered by Claude. Runs locally in one command.

---

## Prerequisites

- Node.js 18+ (check with `node --version`)
- An Anthropic API key — get one from https://console.anthropic.com → API Keys → Create Key

---

## First-time setup

```bash
# 1. Go into the project folder
cd "Web Site Chat bot"

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env

# 4. Open .env and paste your Anthropic API key
#    ANTHROPIC_API_KEY=sk-ant-...

# 5. Start the server
npm start
```

The server seeds the database with demo data on first run.

---

## URLs

| Site | URL |
|---|---|
| Legal — Harrington & Associates | http://localhost:3000/legal |
| Retail — Botanica Home | http://localhost:3000/retail |
| Government — Northgate Council | http://localhost:3000/gov |
| Admin portal | http://localhost:3000/admin |

---

## During development

```bash
npm run dev   # auto-restarts on file save (Node 18+)
```

---

## How it works

1. Each demo site has a floating chat widget (bottom-right corner).
2. The widget sends messages to `/api/chat` with the site ID and conversation history.
3. The server fetches the relevant knowledge base entries for that site, builds a Claude system prompt, and streams the response back using Server-Sent Events.
4. The admin portal at `/admin` lets you view, add, edit, and delete knowledge base entries for any site. Changes take effect on the next chat message — no restart needed.

---

## Hosting for the Dubai demo

### Option 1 — Render (recommended, free)

1. Push this folder to a GitHub repo.
2. Go to https://render.com → New → Web Service → connect your repo.
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variable: `ANTHROPIC_API_KEY = your-key`
6. Deploy. Add a custom domain in Settings → Custom Domains.

**Note:** Render's free tier spins down after 15 minutes of inactivity. Hit the URL 5 minutes before your demo to warm it up.

### Option 2 — Railway (~£3–5/month, no cold starts)

1. Go to https://railway.app → New Project → Deploy from GitHub.
2. Add environment variable: `ANTHROPIC_API_KEY`
3. Railway auto-detects Node and deploys. Add a custom domain in Settings.

### Option 3 — AWS (if you have credits)

Deploy to Elastic Beanstalk or App Runner. Set `ANTHROPIC_API_KEY` as an environment variable in the service config. Both support custom domains via Route 53.

---

## Adding a custom domain

Wherever you host it:
1. Buy a domain (Namecheap — ~£8/year).
2. Point the domain's DNS to the hosting provider (each provider gives you a CNAME or A record to add).
3. Done — your three sites will be at `yourdomain.com/legal`, `/retail`, `/gov`, and `/admin`.

---

## Knowledge base

- Stored in `chatbot.db` (SQLite, created automatically on first run).
- Manage it via the admin portal at `/admin` — no database tools needed.
- The chatbot only knows what's in the knowledge base. Add entries to improve its answers.
