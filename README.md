# VortexDigitalAI — Website

Live site: **https://vortexdigitalai.com**
Hosted on **GitHub Pages**, custom domain via `CNAME`.

---

## 1. What's in this repo

| File | Purpose |
|---|---|
| `index.html` | Main website (homepage — services, courses, FAQ, contact, everything) |
| `environmental-impact.html` | **New page** — live Global Environmental Impact Tracker |
| `404.html` | Custom "page not found" page |
| `CNAME` | Tells GitHub Pages to serve the site on `vortexdigitalai.com` instead of the default `*.github.io` address |
| `robots.txt` | Tells search engines which pages they're allowed to crawl |
| `sitemap.xml` | Lists all pages for search engines (Google, Bing, etc.) |
| `naveed-ali.jpg` | Founder photo, used as the site logo/OG image |

> **Note:** GitHub requires the domain file to be named exactly `CNAME` (no extension). If yours is currently `CNAME.txt`, rename it to `CNAME` before uploading — see step 3 below.

---

## 2. What's new — Environmental Impact Tracker

`environmental-impact.html` is a **separate, standalone page**, fully built and configured:

- **Live wildfire data** — NASA FIRMS satellite feed (API key already added, working)
- **Live disaster/flood data** — GDACS global monitoring feed
- **Conflict-impact section** — manually curated (no free live API exists for this yet; edit the `conflictData` array in the file whenever you want to update it)
- **Auto-refreshes every 5 minutes** — no page reload needed
- **Matches your site's exact branding** — same dark theme, same cyan/violet/amber/rose accent colors, same fonts (Orbitron + Plus Jakarta Sans)
- **"Back to VortexDigitalAI" bar** at the top, linking to your homepage
- **"View Full Details" button** on each data card — opens a full list of incidents in an overlay, without leaving the page
- **Contact options**: WhatsApp (+92 312 528 2051), Google Meet booking, and email (naveedali01888@gmail.com)
- **Full SEO + AEO/GEO**: meta tags, Open Graph tags, and JSON-LD structured data (`Dataset` + `FAQPage`) so AI answer engines (ChatGPT, Perplexity, Google AI Overviews) and search engines can understand and cite the page correctly

Nothing left to configure — it works as soon as it's uploaded.

---

## 3. How to add this to GitHub

### If you already have the repo on GitHub (recommended path — no coding needed)

1. Go to your repository on **github.com** (the one connected to `vortexdigitalai.com`).
2. Click **Add file → Upload files**.
3. Drag in `environmental-impact.html` (and `sitemap.xml` if you're updating it — see step 5).
4. Scroll down, add a short commit message like `Add environmental impact tracker page`.
5. Click **Commit changes**.
6. Wait 1–2 minutes — GitHub Pages rebuilds automatically.
7. Visit `https://vortexdigitalai.com/environmental-impact.html` to confirm it's live.

That's it — no terminal, no git commands required.

### If you're starting the repo from scratch

1. Create a new repository on GitHub (e.g. `vortexdigitalai-website`).
2. Upload all your existing files (`index.html`, `404.html`, `robots.txt`, `sitemap.xml`, `naveed-ali.jpg`) plus the new `environmental-impact.html` and rename `CNAME.txt` → `CNAME`.
3. Go to **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Choose branch `main`, folder `/ (root)`, click **Save**.
6. Under **Custom domain**, enter `vortexdigitalai.com` and save (GitHub reads this from your `CNAME` file automatically, but confirming it here also sets up HTTPS).
7. Wait a few minutes for GitHub to issue an SSL certificate, then check **Enforce HTTPS**.

---

## 4. What you need to change (only 2 things)

1. **Rename `CNAME.txt` to `CNAME`** when uploading (GitHub Pages won't read the domain from a `.txt` file).
2. **Add one line to `index.html`** to link to the new page from your main navigation menu. Exact instructions and the line to add are in `nav-link-snippet.txt` in this same folder — it's a single `<a>` tag, copy-paste ready.

Everything else — colors, contact info, live data, SEO — is already done.

---

## 5. Optional but recommended

- **`sitemap.xml`** — I've included an updated version in this folder that adds `environmental-impact.html` to it, so search engines discover the new page faster. Upload it to replace your current one (same filename, so it overwrites automatically).
- **Social share preview** — the new page reuses `naveed-ali.jpg` as its preview image (same as your homepage). If you'd rather use a different image for this page specifically, update the `og:image` meta tag near the top of `environmental-impact.html`.

---

## 6. Ongoing maintenance

| Task | How often | Where |
|---|---|---|
| Update conflict-impact entries | As needed | `conflictData` array near the bottom of `environmental-impact.html` |
| Change WhatsApp number / Meet link / email | Rarely | `WHATSAPP_NUMBER`, `MEETING_LINK`, `CONTACT_EMAIL` constants in the same file |
| Rotate NASA FIRMS API key | Only if it stops working | `FIRMS_MAP_KEY` constant, get a new one free at https://firms.modaps.eosdis.nasa.gov/api/map_key/ |

No server, database, or hosting costs beyond GitHub Pages (which is free) — everything runs directly in the visitor's browser.

## 7. Website chatbot

The existing chat widget uses a free, browser-local language model and a lightweight text-retrieval index. The model is loaded only when a visitor opens chat; the first load may take a while and downloads model files from the public WebLLM/Hugging Face distribution. Subsequent visits can reuse the browser cache.

- **Model:** Qwen2.5-0.5B-Instruct, quantized for WebLLM and distributed under Apache-2.0.
- **Knowledge:** on first use (and then at most daily), the widget reads the same-origin `sitemap.xml`, extracts visible page text, splits it into small chunks, and retrieves only the most relevant chunks for each question. The index is cached in the browser and rebuilt when the sitemap URL list changes.
- **Privacy:** questions, retrieved website text, and chat messages stay in the visitor's browser. The only external downloads are the WebLLM module and model files. An unanswered question is sent to the existing contact form only when a visitor chooses to submit it.
- **Contact escalation:** the homepage reuses its configured Google Apps Script contact endpoint. On pages without that endpoint, the visitor can open a prefilled email to `naveedali01888@gmail.com`; the visitor must press Send in their email app. To change the recipient, edit `contactEmail` in `chatbot/chatbot-config.js`. That file is public configuration and must never contain secrets.
- **Deployment:** no build step, package install, backend, API key, or GitHub Actions workflow is required. Keep the `chatbot/` directory and `sitemap.xml` at the site root and deploy using the existing GitHub Pages branch/folder configuration.
- **Limitations:** local inference requires a secure page (HTTPS or localhost), a WebGPU-capable browser/device, available memory, and a network connection for the initial model download. The small model may be slower or less capable than a hosted large model. If WebGPU or model loading fails, the widget offers contact escalation instead of showing technical errors.
