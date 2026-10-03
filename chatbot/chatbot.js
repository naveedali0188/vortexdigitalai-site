/* ============================================================
   SITE-CONTENT CHAT
   Searches the existing sitemap pages and JSON catalog locally.
   Answers are copied from matching website content; no LLM,
   external AI API, plugin, or model download is used.
============================================================= */
(function () {
  var config = window.VX_CHATBOT_CONFIG || {};
  if (config.enabled === false) return;

  var CACHE_KEY = "vxc_site_content_v3";
  var CACHE_AGE = 60 * 60 * 1000;
  var UNKNOWN_ANSWER = "I couldn't find a reliable answer to that on our website. Please contact our team for assistance.";
  var state = { open: false, busy: false, index: null, indexPromise: null, history: [] };

  var launcher = document.createElement("button");
  launcher.id = "vxc-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open customer support chat");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML =
    '<span class="vxc-badge" aria-hidden="true"></span>' +
    '<svg class="vxc-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
    '<svg class="vxc-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var chatWindow = document.createElement("div");
  chatWindow.id = "vxc-window";
  chatWindow.setAttribute("role", "dialog");
  chatWindow.setAttribute("aria-label", "Website customer support chat");
  chatWindow.innerHTML =
    '<div id="vxc-header">' +
    '  <div><div class="vxc-title">Vortex Assistant</div>' +
    '  <div class="vxc-subtitle">Answers from our website</div>' +
    '  <div class="vxc-status" id="vxc-status" role="status">Ready</div></div>' +
    '  <div id="vxc-header-actions">' +
    '    <button id="vxc-clear" type="button" aria-label="Clear conversation" title="Clear conversation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg></button>' +
    '    <button id="vxc-minimize" type="button" aria-label="Close chat" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg></button>' +
    "  </div></div>" +
    '<div id="vxc-messages" aria-live="polite"></div>' +
    '<div id="vxc-quick"></div>' +
    '<div id="vxc-fallback" aria-live="polite"></div>' +
    '<div id="vxc-inputbar"><textarea id="vxc-input" rows="1" maxlength="1600" placeholder="Ask a question..." aria-label="Type your message"></textarea>' +
    '  <button id="vxc-send" type="button" aria-label="Send message"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg></button>' +
    "</div>";

  document.body.appendChild(launcher);
  document.body.appendChild(chatWindow);

  var messages = chatWindow.querySelector("#vxc-messages");
  var quickQuestions = chatWindow.querySelector("#vxc-quick");
  var fallback = chatWindow.querySelector("#vxc-fallback");
  var input = chatWindow.querySelector("#vxc-input");
  var sendButton = chatWindow.querySelector("#vxc-send");
  var status = chatWindow.querySelector("#vxc-status");

  function addMessage(role, text) {
    var element = document.createElement("div");
    element.className = "vxc-msg " + (role === "user" ? "vxc-msg-user" : "vxc-msg-bot");
    element.textContent = text;
    messages.appendChild(element);
    messages.scrollTop = messages.scrollHeight;
    return element;
  }

  function addSourceLinks(docs) {
    var wrapper = document.createElement("div");
    wrapper.className = "vxc-sources";
    wrapper.appendChild(document.createTextNode("From: "));
    docs.forEach(function (doc, index) {
      if (index) wrapper.appendChild(document.createTextNode(" · "));
      var link = document.createElement("a");
      link.href = doc.url;
      link.textContent = doc.title;
      wrapper.appendChild(link);
    });
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  }

  function showContactAction() {
    fallback.innerHTML = "";
    var link = document.createElement("a");
    link.className = "vxc-contact-open";
    link.href = new URL("/index.html#get-in-touch", window.location.origin).href;
    link.textContent = "Contact Team";
    fallback.appendChild(link);
    fallback.classList.add("vxc-show");
  }

  function showTyping() {
    var element = document.createElement("div");
    element.id = "vxc-typing-indicator";
    element.className = "vxc-typing";
    element.setAttribute("aria-label", "Searching website content");
    element.innerHTML = "<span></span><span></span><span></span><span class=\"vxc-typing-label\">Searching our website</span>";
    messages.appendChild(element);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    var indicator = document.getElementById("vxc-typing-indicator");
    if (indicator) indicator.remove();
  }

  function renderWelcome() {
    messages.innerHTML = "";
    state.history.forEach(function (turn) {
      addMessage(turn.role, turn.content);
    });
    if (!state.history.length) {
      addMessage("assistant", config.welcomeMessage || "Hi! Ask me a question about our services, courses, or website.");
    }
  }

  function renderQuickQuestions() {
    quickQuestions.innerHTML = "";
    (config.quickQuestions || []).forEach(function (question) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "vxc-quick-btn";
      button.textContent = question;
      button.addEventListener("click", function () { sendMessage(question); });
      quickQuestions.appendChild(button);
    });
  }

  // Strip page chrome and scripts so only visible, customer-facing text is indexed.
  function extractPage(markup, url) {
    var parsed = new DOMParser().parseFromString(markup, "text/html");
    var title = parsed.querySelector("title");
    var body = parsed.body ? parsed.body.cloneNode(true) : parsed.documentElement.cloneNode(true);
    var faqs = [];
    Array.prototype.forEach.call(parsed.querySelectorAll('script[type="application/ld+json"]'), function (script) {
      try {
        collectFaqs(JSON.parse(script.textContent), faqs);
      } catch (error) {
        console.warn("Structured FAQ content could not be read.", error);
      }
    });
    Array.prototype.forEach.call(body.querySelectorAll(
      "script,style,noscript,svg,iframe,nav,header,#vxc-window,#vxc-launcher"
    ), function (node) { node.remove(); });
    var text = (body.innerText || body.textContent || "").replace(/\s+/g, " ").trim();
    return { title: title ? title.textContent.trim() : url, url: url, text: text, faqs: faqs };
  }

  function collectFaqs(value, output) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(function (item) { collectFaqs(item, output); });
      return;
    }
    var type = value["@type"];
    if ((type === "FAQPage" || Array.isArray(type) && type.indexOf("FAQPage") !== -1) &&
        Array.isArray(value.mainEntity)) {
      value.mainEntity.forEach(function (item) {
        var answer = item.acceptedAnswer;
        var answerText = Array.isArray(answer)
          ? answer.map(function (entry) { return entry.text || ""; }).join(" ")
          : answer && answer.text;
        if (item.name && answerText) output.push({ question: item.name, answer: answerText });
      });
    }
    Object.keys(value).forEach(function (key) {
      if (key !== "mainEntity") collectFaqs(value[key], output);
    });
  }

  function splitPage(page) {
    var sentences = page.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    var chunks = [];
    var current = "";
    sentences.forEach(function (sentence) {
      sentence = sentence.trim();
      if (!sentence) return;
      if (current && current.length + sentence.length > 600) {
        chunks.push(makeChunk(page, current));
        current = "";
      }
      current += (current ? " " : "") + sentence;
    });
    if (current) chunks.push(makeChunk(page, current));
    return chunks;
  }

  function makeChunk(page, text, kind, answer) {
    var terms = tokenize(text);
    var frequencies = {};
    terms.forEach(function (term) {
      frequencies[term] = (frequencies[term] || 0) + 1;
    });
    return {
      title: page.title,
      url: page.url,
      text: text,
      terms: terms,
      frequencies: frequencies,
      titleTerms: tokenize(page.title),
      kind: kind || "page",
      answer: answer || "",
    };
  }

  function tokenize(text) {
    var aliases = {
      services: "service", courses: "course", prices: "price", pricing: "price",
      costs: "cost", fees: "fee", charges: "charge", shopify: "shopify",
    };
    return text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim().split(/\s+/)
      .filter(function (word) { return word.length > 1 && !STOP_WORDS[word]; })
      .map(function (word) { return aliases[word] || word; });
  }

  var STOP_WORDS = {
    a: 1, about: 1, an: 1, and: 1, are: 1, as: 1, at: 1, be: 1, can: 1, do: 1,
    does: 1, for: 1, from: 1, have: 1, how: 1, i: 1, in: 1, is: 1, it: 1, me: 1,
    of: 1, on: 1, or: 1, our: 1, please: 1, tell: 1, that: 1, the: 1, their: 1,
    them: 1, this: 1, to: 1, us: 1, was: 1, we: 1, what: 1, when: 1, where: 1,
    which: 1, who: 1, why: 1, with: 1, you: 1, your: 1, vortexdigitalai: 1,
    list: 1, offer: 1, offered: 1, provide: 1, provides: 1,
  };

  function addJsonContent(chunks, filename, records) {
    records.forEach(function (record) {
      var text;
      if (filename === "faqs.json") {
        if (!record.question || !record.answer) return;
        var faqUrl = record.url
          ? new URL(record.url, window.location.origin).href
          : new URL("/index.html#faq", window.location.origin).href;
        chunks.push(makeChunk({
          title: record.question,
          url: faqUrl,
        }, record.question + " " + record.answer, "faq", record.answer));
        return;
      } else {
        text = [record.name, record.category, record.duration, record.description]
          .concat(record.features || []).filter(Boolean).join(". ");
      }
      if (!text) return;
      var base = window.location.origin;
      var pageUrl = record.url ? new URL(record.url, base).href : base + "/";
      chunks.push(makeChunk({
        title: record.name || record.question || filename,
        url: pageUrl,
      }, text));
    });
  }

  function loadJsonCatalog(filename) {
    return fetch("/data/" + filename).then(function (response) {
      if (!response.ok) throw new Error("Could not read site catalog: " + filename);
      return response.json();
    }).then(function (records) { return records; });
  }

  // Build a temporary browser index from sitemap HTML and the existing JSON catalogs.
  function buildIndex() {
    if (state.index) return Promise.resolve(state.index);
    if (state.indexPromise) return state.indexPromise;

    state.indexPromise = Promise.all([
      fetch("/sitemap.xml").then(function (response) {
        if (!response.ok) throw new Error("Website sitemap is unavailable.");
        return response.text();
      }),
      loadJsonCatalog("services.json"),
      loadJsonCatalog("courses.json"),
      loadJsonCatalog("faqs.json"),
    ]).then(function (results) {
      var sitemap = new DOMParser().parseFromString(results[0], "application/xml");
      var urls = Array.prototype.map.call(sitemap.getElementsByTagName("loc"), function (loc) {
        try {
          var listedPage = new URL(loc.textContent.trim());
          if (listedPage.protocol !== "http:" && listedPage.protocol !== "https:") return null;
          return new URL(listedPage.pathname + listedPage.search, window.location.origin).href;
        } catch (error) {
          return null;
        }
      }).filter(Boolean);
      if (!urls.length) throw new Error("The sitemap contains no same-origin pages.");

      var signature = urls.join("|");
      var cached = null;
      try {
        cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      } catch (error) {
        console.warn("The saved site search index could not be read.", error);
      }
      if (cached && cached.signature === signature && Date.now() - cached.createdAt < CACHE_AGE &&
          Array.isArray(cached.chunks) && cached.chunks.length) {
        state.index = cached.chunks.map(function (doc) {
          return doc.frequencies ? doc : makeChunk(doc, doc.text);
        });
        return state.index;
      }

      var pages = [];
      var cursor = 0;
      function fetchNextBatch() {
        if (cursor >= urls.length) return Promise.resolve();
        var batch = urls.slice(cursor, cursor + 8);
        cursor += batch.length;
        return Promise.all(batch.map(function (url) {
          return fetch(url).then(function (response) {
            if (!response.ok) throw new Error("Page not available: " + url);
            return response.text();
          }).then(function (markup) {
            pages.push(extractPage(markup, url));
          }).catch(function (error) {
            console.warn("A website page could not be indexed.", error);
          });
        })).then(fetchNextBatch);
      }

      return fetchNextBatch().then(function () {
        var chunks = [];
        pages.forEach(function (page) {
          chunks = chunks.concat(splitPage(page));
          (page.faqs || []).forEach(function (faq) {
            chunks.push(makeChunk({
              title: faq.question,
              url: page.url,
            }, faq.question + " " + faq.answer, "faq", faq.answer));
          });
        });
        addJsonContent(chunks, "services.json", results[1]);
        addJsonContent(chunks, "courses.json", results[2]);
        addJsonContent(chunks, "faqs.json", results[3]);
        if (!chunks.length) throw new Error("No website content could be indexed.");
        state.index = chunks;
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            createdAt: Date.now(),
            signature: signature,
            chunks: chunks,
          }));
        } catch (error) {
          console.warn("The website search index could not be cached.", error);
        }
        return state.index;
      });
    }).catch(function (error) {
      state.indexPromise = null;
      throw error;
    });
    return state.indexPromise;
  }

  function search(question) {
    var queryTerms = tokenize(question);
    var terms = queryTerms.filter(function (term, index) { return queryTerms.indexOf(term) === index; });
    if (!terms.length) return [];
    var docs = state.index || [];
    var averageLength = docs.reduce(function (sum, doc) { return sum + doc.terms.length; }, 0) / Math.max(1, docs.length);
    var frequencies = {};
    terms.forEach(function (term) {
      frequencies[term] = docs.filter(function (doc) {
        return doc.frequencies[term] || doc.titleTerms.indexOf(term) !== -1;
      }).length;
    });
    var currentPath = window.location.pathname;
    var scored = docs.map(function (doc) {
      var matchedTerms = 0;
      var score = 0;
      terms.forEach(function (term) {
        var count = (doc.frequencies[term] || 0) +
          (doc.titleTerms.indexOf(term) !== -1 ? 3 : 0);
        if (!count) return;
        matchedTerms += 1;
        var frequency = frequencies[term];
        var inverseFrequency = Math.log(1 + (docs.length - frequency + 0.5) / (frequency + 0.5));
        score += inverseFrequency * count * 2.2 /
          (count + 1.2 * (0.25 + 0.75 * doc.terms.length / Math.max(1, averageLength)));
      });
      if (new URL(doc.url).pathname === currentPath) score *= 1.3;
      return { doc: doc, score: score, coverage: matchedTerms / terms.length };
    }).sort(function (a, b) { return b.score - a.score; });

    if (isPriceQuestion(question)) {
      var pricePattern = /(?:\$\s?\d|(?:USD|EUR|GBP)\s?\d|\d[\d,.]*\s?(?:USD|EUR|GBP)|(?:starts?|starting)\s+(?:at|from)\s+\$?\d)/i;
      var subjectTerms = terms.filter(function (term) {
        return ["price", "cost", "fee", "charge", "budget", "much"].indexOf(term) === -1;
      });
      if (!subjectTerms.length) {
        var generalWebsitePrice = docs.filter(function (doc) {
          return doc.kind === "faq" &&
            /\bwebsite\b/i.test(doc.title) &&
            /\b(price|cost|pricing)\b/i.test(doc.title) &&
            pricePattern.test(doc.text);
        })[0];
        if (generalWebsitePrice) return [generalWebsitePrice];
      }
      scored = scored.filter(function (item) {
        if (!pricePattern.test(item.doc.text)) return false;
        if (!subjectTerms.length) return true;
        var matchedSubjects = subjectTerms.filter(function (term) {
          return item.doc.frequencies[term] || item.doc.titleTerms.indexOf(term) !== -1;
        }).length;
        return matchedSubjects / subjectTerms.length >= 0.5;
      });
    }

    if (!isPriceQuestion(question) && terms.length <= 3 && /\bservices?\b/i.test(question)) {
      var servicesFaq = docs.filter(function (doc) {
        return doc.kind === "faq" && /^what services does /i.test(doc.title);
      })[0];
      if (servicesFaq) return [servicesFaq];
    }
    if (!isPriceQuestion(question) && terms.length <= 3 && /\bcourses?\b/i.test(question)) {
      var coursesFaq = docs.filter(function (doc) {
        return doc.kind === "faq" && /^what courses does /i.test(doc.title);
      })[0];
      if (coursesFaq) return [coursesFaq];
    }

    var best = scored[0];
    var minimumCoverage = Math.min(0.5, Math.max(0.4, 2 / terms.length));
    if (!best || best.score < 0.55 || best.coverage < minimumCoverage) return [];

    var results = scored.filter(function (item) {
      return item.score >= best.score * 0.45 &&
        item.coverage >= Math.max(minimumCoverage, best.coverage * 0.7) &&
        (best.doc.kind !== "faq" || item.doc.kind === "faq");
    }).slice(0, 2).map(function (item) { return item.doc; });

    return results;
  }

  function isPriceQuestion(question) {
    return /\b(price|prices|pricing|cost|costs|fee|fees|charge|charges|how much|budget)\b/i.test(question);
  }

  function formatAnswer(docs, question) {
    var terms = tokenize(question);
    return docs.map(function (doc) {
      if (doc.kind === "faq") return doc.answer;
      var sentences = doc.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [doc.text];
      var relevant = sentences.map(function (sentence) {
        var sentenceTerms = tokenize(sentence);
        return {
          text: sentence.trim(),
          score: terms.reduce(function (score, term) {
            return score + (sentenceTerms.indexOf(term) !== -1 ? 1 : 0);
          }, 0),
        };
      }).filter(function (sentence) {
        return sentence.score > 0;
      }).sort(function (a, b) { return b.score - a.score; }).slice(0, 2);
      var answer = relevant.map(function (sentence) { return sentence.text; }).join(" ");
      if (answer.length > 500) answer = answer.slice(0, 497).replace(/\s+\S*$/, "") + "...";
      return answer;
    }).filter(Boolean).join("\n\n");
  }

  function setBusy(busy) {
    state.busy = busy;
    sendButton.disabled = busy;
    input.disabled = busy;
  }

  function sendMessage(rawText) {
    var text = (rawText || input.value).trim();
    if (!text || state.busy) return;
    if (text.length > 1600) {
      addMessage("assistant", "Please keep your question under 1,600 characters.");
      return;
    }

    input.value = "";
    input.style.height = "auto";
    fallback.innerHTML = "";
    fallback.classList.remove("vxc-show");
    addMessage("user", text);
    state.history.push({ role: "user", content: text });
    setBusy(true);
    status.textContent = "Searching website content...";
    showTyping();

    buildIndex().then(function () {
      var matches = search(text);
      hideTyping();
      if (!matches.length) {
        addMessage("assistant", UNKNOWN_ANSWER);
        showContactAction();
        state.history.push({ role: "assistant", content: UNKNOWN_ANSWER });
      } else {
        var answer = formatAnswer(matches, text);
        addMessage("assistant", answer);
        addSourceLinks(matches);
        state.history.push({ role: "assistant", content: answer });
      }
    }).catch(function (error) {
      console.error("Website content search is unavailable.", error);
      hideTyping();
      addMessage("assistant", "I couldn't search the website just now. Please contact our team for assistance.");
      showContactAction();
    }).finally(function () {
      setBusy(false);
      status.textContent = "Ready";
      if (state.open) input.focus();
    });
  }

  function openChat() {
    state.open = true;
    chatWindow.classList.add("vxc-open");
    launcher.classList.add("vxc-open");
    launcher.setAttribute("aria-expanded", "true");
    input.focus();
    if (!state.index && !state.indexPromise) {
      status.textContent = "Ready";
    }
  }

  function closeChat() {
    state.open = false;
    chatWindow.classList.remove("vxc-open");
    launcher.classList.remove("vxc-open");
    launcher.setAttribute("aria-expanded", "false");
  }

  launcher.addEventListener("click", function () {
    state.open ? closeChat() : openChat();
  });
  chatWindow.querySelector("#vxc-minimize").addEventListener("click", closeChat);
  chatWindow.querySelector("#vxc-clear").addEventListener("click", function () {
    state.history = [];
    renderWelcome();
    fallback.innerHTML = "";
    fallback.classList.remove("vxc-show");
  });
  sendButton.addEventListener("click", function () { sendMessage(); });
  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 90) + "px";
  });
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.open) closeChat();
  });

  renderWelcome();
  renderQuickQuestions();
})();
