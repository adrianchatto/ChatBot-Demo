/**
 * chattoweb.com — Embeddable Chat Widget
 *
 * Drop one script tag on any page to add a fully functional AI chatbot.
 *
 * Usage:
 *   <script
 *     src="https://your-domain.com/widget.js"
 *     data-site="legal"
 *     data-api="https://your-domain.com"
 *     data-title="Ask us anything"
 *     data-color="#1e40af"
 *   ></script>
 *
 * Required attributes:
 *   data-site   — site ID matching your platform (legal | retail | gov)
 *   data-api    — base URL of your chattoweb platform
 *
 * Optional attributes:
 *   data-title  — header title in the chat panel (default: "Chat with us")
 *   data-color  — primary accent colour in hex (default: "#1e40af")
 */

(function () {
  'use strict';

  // ── Read config from script tag ─────────────────────────────────────────────
  const script = document.currentScript ||
    (function () {
      const scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  const SITE_ID   = script.getAttribute('data-site')  || 'legal';
  const API_BASE  = (script.getAttribute('data-api')   || '').replace(/\/$/, '');
  const TITLE     = script.getAttribute('data-title')  || 'Chat with us';
  const COLOR     = script.getAttribute('data-color')  || '#1e40af';

  if (!API_BASE) {
    console.warn('[chattoweb widget] data-api attribute is required.');
    return;
  }

  // ── Derive a readable colour for button text ────────────────────────────────
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function isDark(hex) {
    const { r, g, b } = hexToRgb(hex);
    // Perceived luminance
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  }

  const BUTTON_TEXT_COLOR = isDark(COLOR) ? '#ffffff' : '#0f172a';

  // ── Styles ──────────────────────────────────────────────────────────────────
  const css = `
    #cw-widget-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${COLOR};
      color: ${BUTTON_TEXT_COLOR};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      font-size: 1.4rem;
      line-height: 1;
    }

    #cw-widget-btn:hover {
      transform: scale(1.06);
      box-shadow: 0 6px 20px rgba(0,0,0,0.22);
    }

    #cw-panel {
      position: fixed;
      bottom: 92px;
      right: 24px;
      width: 360px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.16);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.92) translateY(12px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.2s ease, opacity 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      color: #0f172a;
    }

    #cw-panel.cw-open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }

    #cw-header {
      background: ${COLOR};
      color: ${BUTTON_TEXT_COLOR};
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    #cw-header-title {
      font-weight: 700;
      font-size: 0.9375rem;
      letter-spacing: -0.01em;
    }

    #cw-close {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: 1.1rem;
      line-height: 1;
      padding: 4px;
      opacity: 0.8;
      transition: opacity 0.15s;
    }

    #cw-close:hover { opacity: 1; }

    #cw-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8fafc;
    }

    #cw-messages::-webkit-scrollbar { width: 4px; }
    #cw-messages::-webkit-scrollbar-track { background: transparent; }
    #cw-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

    .cw-msg {
      max-width: 84%;
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.5;
      font-size: 0.875rem;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .cw-msg-user {
      background: ${COLOR};
      color: ${BUTTON_TEXT_COLOR};
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .cw-msg-bot {
      background: #ffffff;
      color: #0f172a;
      align-self: flex-start;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 4px;
    }

    .cw-msg-error {
      background: #fef2f2;
      color: #991b1b;
      align-self: flex-start;
      border: 1px solid #fecaca;
      border-bottom-left-radius: 4px;
    }

    .cw-typing {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 10px 14px;
    }

    .cw-typing span {
      width: 6px;
      height: 6px;
      background: #94a3b8;
      border-radius: 50%;
      animation: cw-bounce 1.2s infinite;
    }

    .cw-typing span:nth-child(2) { animation-delay: 0.2s; }
    .cw-typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes cw-bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40%           { transform: translateY(-6px); }
    }

    #cw-footer {
      padding: 12px 14px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    #cw-input {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 9px 13px;
      font-size: 0.875rem;
      font-family: inherit;
      outline: none;
      resize: none;
      line-height: 1.4;
      color: #0f172a;
      background: #f8fafc;
      transition: border-color 0.15s;
      max-height: 80px;
    }

    #cw-input:focus { border-color: ${COLOR}; background: #ffffff; }
    #cw-input::placeholder { color: #94a3b8; }

    #cw-send {
      background: ${COLOR};
      color: ${BUTTON_TEXT_COLOR};
      border: none;
      border-radius: 8px;
      width: 38px;
      height: 38px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s;
      font-size: 1rem;
      align-self: flex-end;
    }

    #cw-send:hover { opacity: 0.88; }
    #cw-send:disabled { opacity: 0.4; cursor: not-allowed; }

    #cw-limit-notice {
      text-align: center;
      padding: 10px 16px;
      background: #fffbeb;
      color: #92400e;
      font-size: 0.8125rem;
      border-top: 1px solid #fde68a;
    }
  `;

  // ── Inject styles ────────────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Build DOM ────────────────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'cw-widget-btn';
  btn.setAttribute('aria-label', 'Open chat');
  btn.innerHTML = '💬';

  const panel = document.createElement('div');
  panel.id = 'cw-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', TITLE);
  panel.innerHTML = `
    <div id="cw-header">
      <span id="cw-header-title">${TITLE}</span>
      <button id="cw-close" aria-label="Close chat">✕</button>
    </div>
    <div id="cw-messages" role="log" aria-live="polite"></div>
    <div id="cw-footer">
      <textarea id="cw-input" rows="1" placeholder="Type a message…" aria-label="Message input"></textarea>
      <button id="cw-send" aria-label="Send message">➤</button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // ── State ────────────────────────────────────────────────────────────────────
  const messages    = [];
  let   isOpen      = false;
  let   isStreaming = false;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const messagesEl = panel.querySelector('#cw-messages');
  const inputEl    = panel.querySelector('#cw-input');
  const sendBtn    = panel.querySelector('#cw-send');

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `cw-msg cw-msg-${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'cw-msg cw-msg-bot cw-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showLimitNotice() {
    const footer = panel.querySelector('#cw-footer');
    footer.innerHTML = `<div id="cw-limit-notice">This demo has reached its conversation limit. Please get in touch to find out more.</div>`;
  }

  function setStreaming(val) {
    isStreaming = val;
    sendBtn.disabled = val;
    inputEl.disabled = val;
  }

  // ── Send a message ───────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isStreaming) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';

    addMessage('user', text);
    messages.push({ role: 'user', content: text });

    const typing = addTypingIndicator();
    setStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: SITE_ID, messages })
      });

      if (response.status === 429) {
        typing.remove();
        showLimitNotice();
        return;
      }

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }

      typing.remove();
      const botDiv = document.createElement('div');
      botDiv.className = 'cw-msg cw-msg-bot';
      messagesEl.appendChild(botDiv);

      const reader    = response.body.getReader();
      const decoder  = new TextDecoder();
      let   botText  = '';
      let   buffer   = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const json = JSON.parse(payload);
            if (json.text) {
              botText += json.text;
              botDiv.textContent = botText;
              messagesEl.scrollTop = messagesEl.scrollHeight;
            }
            if (json.error) {
              botDiv.textContent = json.error;
              botDiv.className = 'cw-msg cw-msg-error';
            }
          } catch (_) { /* ignore malformed chunks */ }
        }
      }

      if (botText) {
        messages.push({ role: 'assistant', content: botText });
      }

    } catch (err) {
      typing.remove();
      const errDiv = document.createElement('div');
      errDiv.className = 'cw-msg cw-msg-error';
      errDiv.textContent = 'Something went wrong. Please try again.';
      messagesEl.appendChild(errDiv);
    } finally {
      setStreaming(false);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      inputEl.focus();
    }
  }

  // ── Toggle panel ─────────────────────────────────────────────────────────────
  function openPanel() {
    isOpen = true;
    panel.classList.add('cw-open');
    btn.innerHTML = '✕';
    btn.setAttribute('aria-label', 'Close chat');
    inputEl.focus();

    // Show greeting on first open
    if (messages.length === 0 && messagesEl.children.length === 0) {
      addMessage('bot', 'Hello! How can I help you today?');
    }
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('cw-open');
    btn.innerHTML = '💬';
    btn.setAttribute('aria-label', 'Open chat');
  }

  // ── Event listeners ──────────────────────────────────────────────────────────
  btn.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  panel.querySelector('#cw-close').addEventListener('click', closePanel);
  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

})();
