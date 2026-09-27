# Environmental Impact Tracker — Setup Guide

File to add to your repo: `environmental-impact.html`

## 1. Add the file
Drop `environmental-impact.html` into your site's root (or wherever your other pages live), next to `index.html`, `about.html`, etc. Link to it from your nav/menu like any other page.

## 2. Edit 5 things (all marked "EDIT ME" in the file)

| # | What | Where | Notes |
|---|------|-------|-------|
| 1 | Brand colors | `<style>` → `:root { ... }` near the top | Swap the 6 hex values to match your site. Everything else re-themes automatically. |
| 2 | WhatsApp number | `<script>` → `const WHATSAPP_NUMBER` | Digits only, with country code, no `+` or spaces (e.g. `923001234567`). |
| 3 | Google Meet / booking link | `<script>` → `const MEETING_LINK` | Use a Google Calendar appointment link, Calendly, etc. |
| 4 | NASA FIRMS API key | `<script>` → `const FIRMS_MAP_KEY` | Free, instant. Get one at https://firms.modaps.eosdis.nasa.gov/api/map_key/ — without this, the wildfire card shows "Add API key" instead of live numbers. |
| 5 | Business name | Footer + `<title>` + `<meta>` tags + JSON-LD `Organization.name` | Also update `YOURDOMAIN.com` in the `<meta>` tags to your real domain. |

## 3. What's actually live vs. manual

- **Wildfires** — fully live, pulled directly from NASA FIRMS satellite data once you add your free API key.
- **Floods / disasters** — pulled from GDACS's public JSON feed. GDACS doesn't always send CORS headers to browsers, so if the flood card shows a dash instead of a number, that call is being blocked by the browser, not broken. Fix: proxy the GDACS request through a tiny endpoint on your own server (even a 5-line serverless function) and change the `url` inside `fetchDisasters()` to point at your proxy instead of gdacs.org directly.
- **Conflict / war-driven damage** — no free API gives a clean live "environmental impact" figure for this. It's built as a plain JavaScript array (`conflictData`) near the bottom of the file — edit that array whenever you want to update it. If you later want this automated too, that requires a backend that reads news sources and scores them (a separate project).

## 4. Auto-refresh
The page re-fetches live data every 5 minutes on its own — no reload needed. Change the `5 * 60 * 1000` near the bottom of the script to adjust the interval (value is in milliseconds).

## 5. SEO / AEO / GEO already included
- Meta title, description, keywords, canonical tag, Open Graph tags
- `Dataset` and `FAQPage` JSON-LD structured data, so AI answer engines (ChatGPT, Perplexity, Google AI Overviews) can understand and cite the page correctly
- Update the `FAQPage` questions/answers if you want different ones highlighted

## 6. Design notes
Dark, "night/alert" palette with three accent colors (fire = burnt orange, flood = teal, conflict = deep red), a scrolling live-incident ticker at the top, and a big composite "impact index" number in the hero. Swap the 6 CSS variables to fully match your existing site's branding — nothing else needs to change.
