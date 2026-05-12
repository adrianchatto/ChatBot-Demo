# Agent Workflow — chatoweb.com

## Overview

All development on this project follows a three-agent model with test-driven development.
You interact only with the **Product Manager (PM)**. The PM spawns Frontend and Backend agents as needed.

---

## The three agents

### Product Manager (PM)
**You talk to this agent.** The PM owns the full development cycle:
- Receives stories (from GitHub Issues or directly in conversation)
- Writes acceptance criteria and test specifications before any code is written
- Spawns Frontend and Backend agents for implementation
- Verifies all tests pass before closing a story
- Reports status back to you

### Backend Agent
Owns everything server-side: Express routes, database operations, API contracts, auth.
- Always writes tests first (Jest + Supertest)
- Implements to make those tests pass
- Never ships code with failing tests

### Frontend Agent
Owns everything client-side: HTML, CSS, JavaScript in the browser.
- Writes tests first where applicable (UI behaviour, widget integration)
- Implements to make those tests pass
- Responsible for visual fidelity and accessibility

---

## TDD workflow (Red → Green → Done)

```
1. INTAKE     You give a story to the PM
2. ANALYSE    PM writes acceptance criteria + test specifications
3. RED        Backend/Frontend agent writes failing tests
4. CONFIRM    PM verifies tests fail (not a false green)
5. GREEN      Agent implements until all tests pass
6. REVIEW     PM verifies 100% pass, no regressions
7. DONE       PM reports back to you
```

No story is complete until all tests for it are green. No exceptions.

---

## Story format

Stories can be delivered:
- **Via GitHub Issues** on https://github.com/adrianchatto/ChatBot-Demo (preferred)
- **Directly in conversation** using the format below

```
## Story: [Short title]

**As a** [who]
**I want** [what]
**So that** [why]

### Acceptance criteria
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]
- [ ] ...

### Notes
[Any context, edge cases, or constraints]
```

---

## File structure for tests and stories

```
tests/
  backend/         ← Jest + Supertest API tests
  e2e/             ← Playwright end-to-end tests (future)
  setup.js         ← Global test environment config

stories/
  STORY-TEMPLATE.md
  STORY-NNN-[slug].md   ← One file per story
```

---

## Coding rules

1. **Tests before implementation.** Always. No code ships without a test for it.
2. **No regressions.** `npm test` must be fully green before any PR is merged.
3. **One story per branch.** Branch naming: `story/NNN-short-slug`
4. **Chatbot widget stays embeddable.** The widget in `sites/` must remain self-contained — no external dependencies beyond the shared API endpoint.
5. **Auth is always on.** Never add a route that bypasses `requireAuth` without explicit approval.

---

## Current test command

```bash
npm test         # Run all tests once
npm run test:watch  # Watch mode during development
```

Tests are platform-independent (database is mocked). They run in CI on Railway automatically on push to `main`.
