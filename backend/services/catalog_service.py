"""
Loads services.json, courses.json and faqs.json (the site's real content —
see data/), and does simple keyword matching to pull relevant context into
the AI prompt. Deliberately simple: no vector DB, no embeddings — the
catalog is small enough that keyword overlap works fine. If the catalog
grows significantly, this is the place to swap in embeddings later.
"""
import json
import os
import re

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

_STOPWORDS = {
    "the", "a", "an", "is", "are", "what", "how", "do", "does", "can",
    "you", "your", "i", "me", "my", "of", "for", "to", "in", "on", "and",
    "or", "with", "about", "please", "tell",
}


def _tokenize(text: str) -> set:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


class CatalogService:
    def __init__(self):
        self.services = self._load("services.json")
        self.courses = self._load("courses.json")
        self.faqs = self._load("faqs.json")

    def _load(self, filename):
        path = os.path.join(DATA_DIR, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def search(self, query: str, max_results: int = 5) -> list[dict]:
        """Return the most relevant services/courses/FAQs for a user message,
        as plain-text snippets ready to drop into the system prompt."""
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        scored = []

        for s in self.services:
            haystack = _tokenize(f"{s['name']} {s.get('description','')} {s.get('category','')}")
            overlap = len(query_tokens & haystack)
            if overlap:
                scored.append((overlap, {
                    "type": "service",
                    "name": s["name"],
                    "description": s.get("description", ""),
                    "url": s.get("url", "/index.html#services"),
                }))

        for c in self.courses:
            haystack = _tokenize(f"{c['name']} {c.get('description','')}")
            overlap = len(query_tokens & haystack)
            if overlap:
                scored.append((overlap, {
                    "type": "course",
                    "name": c["name"],
                    "duration": c.get("duration", ""),
                    "description": c.get("description", ""),
                    "url": c.get("url", "/index.html#courses"),
                }))

        for f in self.faqs:
            haystack = _tokenize(f"{f['question']} {f.get('answer','')}")
            overlap = len(query_tokens & haystack)
            if overlap:
                scored.append((overlap, {
                    "type": "faq",
                    "question": f["question"],
                    "answer": f.get("answer", ""),
                }))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:max_results]]

    def all_service_names(self) -> list[str]:
        return [s["name"] for s in self.services]

    def all_course_names(self) -> list[str]:
        return [c["name"] for c in self.courses]
