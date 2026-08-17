/* ============================================================
   CHATBOT WIDGET — logic
   Requires chatbot-config.js to be loaded first (window.VX_CHATBOT_CONFIG).
   No secrets live in this file — it only talks to your backend's
   public /api/chat endpoint over HTTPS.
============================================================= */
(function () {
  var cfg = window.VX_CHATBOT_CONFIG || {};
  if (cfg.enabled === false) return;

  var STORAGE_KEY = "vxc_conversation_v1";
  var state = {
    open: false,
    sending: false,
    history: [], // [{role, content}]
  };

  // ---------- Build DOM ----------
  var launcher = document.createElement("button");
  launcher.id = "vxc-launcher";
  launcher.setAttribute("aria-label", "Open AI customer support chat");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML =
    '<span class="vxc-badge" aria-hidden="true"></span>' +
    '<svg class="vxc-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
    '<svg class="vxc-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var win = document.createElement("div");
  win.id = "vxc-window";
  win.setAttribute("role", "dialog");
  win.setAttribute("aria-label", "AI Customer Support chat window");
  win.innerHTML =
    '<div id="vxc-header">' +
    '  <div>' +
    '    <div class="vxc-title">AI Customer Support</div>' +
    '    <div class="vxc-subtitle">Ask me anything about our products</div>' +
    '    <div class="vxc-status"><span class="vxc-status-dot" aria-hidden="true"></span> Online</div>' +
    "  </div>" +
    '  <div id="vxc-header-actions">' +
    '    <button id="vxc-clear" aria-label="Clear conversation" title="Clear conversation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg></button>' +
    '    <button id="vxc-minimize" aria-label="Minimize chat" title="Minimize"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg></button>' +
    "  </div>" +
    "</div>" +
    '<div id="vxc-messages" aria-live="polite"></div>' +
    '<div id="vxc-quick"></div>' +
    '<div id="vxc-fallback"></div>' +
    '<div id="vxc-inputbar">' +
    '  <textarea id="vxc-input" rows="1" placeholder="Ask a question..." aria-label="Type your message"></textarea>' +
    '  <button id="vxc-send" aria-label="Send message"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg></button>' +
    "</div>";

  document.body.appendChild(launcher);
  document.body.appendChild(win);

  var messagesEl = win.querySelector("#vxc-messages");
  var quickEl = win.querySelector("#vxc-quick");
  var fallbackEl = win.querySelector("#vxc-fallback");
  var inputEl = win.querySelector("#vxc-input");
  var sendBtn = win.querySelector("#vxc-send");
  var clearBtn = win.querySelector("#vxc-clear");
  var minimizeBtn = win.querySelector("#vxc-minimize");

  // ---------- Persistence (session only — no personal data stored long-term) ----------
  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      state.history = raw ? JSON.parse(raw) : [];
    } catch (e) {
      state.history = [];
    }
  }
  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.history.slice(-(cfg.maxHistoryMessages || 10))));
    } catch (e) {}
  }

  // ---------- Rendering ----------
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  function linkify(text) {
    // Turn bare URLs and site-relative paths mentioned by the AI into clickable links
    return text.replace(/(https?:\/\/[^\s)]+)|(\/[a-zA-Z0-9\-\/]+\.html)/g, function (m) {
      var href = m.indexOf("http") === 0 ? m : m;
      return '<a href="' + href + '" target="_blank" rel="noopener">' + m + "</a>";
    });
  }

  function addMessage(role, text, isError) {
    var el = document.createElement("div");
    el.className = "vxc-msg " + (role === "user" ? "vxc-msg-user" : "vxc-msg-bot") + (isError ? " vxc-error" : "");
    el.innerHTML = role === "user" ? escapeHtml(text) : linkify(escapeHtml(text));
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderHistory() {
    messagesEl.innerHTML = "";
    if (state.history.length === 0) {
      addMessage("assistant", cfg.welcomeMessage || "Hi! I'm your AI assistant. How can I help?");
    } else {
      state.history.forEach(function (m) {
        addMessage(m.role, m.content);
      });
    }
  }

  function renderQuickQuestions() {
    quickEl.innerHTML = "";
    (cfg.quickQuestions || []).forEach(function (q) {
      var btn = document.createElement("button");
      btn.className = "vxc-quick-btn";
      btn.type = "button";
      btn.textContent = q;
      btn.addEventListener("click", function () {
        sendMessage(q);
      });
      quickEl.appendChild(btn);
    });
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "vxc-typing";
    el.id = "vxc-typing-indicator";
    el.setAttribute("aria-label", "AI is typing");
    el.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() {
    var el = document.getElementById("vxc-typing-indicator");
    if (el) el.remove();
  }

  function showFallback() {
    var links = (cfg.fallbackLinks || [])
      .map(function (l) {
        return '<a href="' + l.url + '" target="_blank" rel="noopener">' + escapeHtml(l.label) + "</a>";
      })
      .join("");
    fallbackEl.innerHTML =
      "<strong>I'm temporarily unable to connect to the AI assistant.</strong><br>You can still:<br>" + links;
    fallbackEl.classList.add("vxc-show");
  }

  // ---------- Page context (spec section 20) ----------
  function getPageContext() {
    return { title: document.title, url: window.location.href };
  }

  // ---------- Sending ----------
  function setSending(sending) {
    state.sending = sending;
    sendBtn.disabled = sending;
    inputEl.disabled = sending;
  }

  function sendMessage(text) {
    text = (text || inputEl.value).trim();
    if (!text || state.sending) return;

    var maxLen = cfg.maxMessageLength || 1000;
    if (text.length > maxLen) {
      addMessage("assistant", "That message is a bit long — please keep it under " + maxLen + " characters.", true);
      return;
    }

    inputEl.value = "";
    autoGrow();
    addMessage("user", text);
    state.history.push({ role: "user", content: text });
    saveHistory();
    setSending(true);
    showTyping();

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = setTimeout(function () {
      if (controller) controller.abort();
    }, 20000);

    fetch(cfg.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        conversation: state.history.slice(-(cfg.maxHistoryMessages || 10)),
        pageContext: getPageContext(),
      }),
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        clearTimeout(timeoutId);
        hideTyping();
        if (result.ok && result.data.success) {
          addMessage("assistant", result.data.message);
          state.history.push({ role: "assistant", content: result.data.message });
          saveHistory();
        } else {
          var msg = (result.data && result.data.message) || "Sorry, something went wrong. Please try again.";
          addMessage("assistant", msg, true);
          if (result.data && result.data.success === false) showFallback();
        }
      })
      .catch(function () {
        clearTimeout(timeoutId);
        hideTyping();
        addMessage(
          "assistant",
          "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
          true
        );
        showFallback();
      })
      .finally(function () {
        setSending(false);
        inputEl.focus();
      });
  }

  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + "px";
  }

  // ---------- Open / close ----------
  function openChat() {
    state.open = true;
    win.classList.add("vxc-open");
    launcher.classList.add("vxc-open");
    launcher.setAttribute("aria-expanded", "true");
    inputEl.focus();
  }
  function closeChat() {
    state.open = false;
    win.classList.remove("vxc-open");
    launcher.classList.remove("vxc-open");
    launcher.setAttribute("aria-expanded", "false");
  }

  launcher.addEventListener("click", function () {
    state.open ? closeChat() : openChat();
  });
  minimizeBtn.addEventListener("click", closeChat);
  clearBtn.addEventListener("click", function () {
    state.history = [];
    saveHistory();
    fallbackEl.classList.remove("vxc-show");
    renderHistory();
  });

  sendBtn.addEventListener("click", function () {
    sendMessage();
  });
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  inputEl.addEventListener("input", autoGrow);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state.open) closeChat();
  });

  // ---------- Init ----------
  loadHistory();
  renderHistory();
  renderQuickQuestions();
})();
