"""
Lightweight, keyword-based tone/sentiment detection.

Deliberately simple — this is a heuristic to help the AI adjust its
*response style* (e.g. lead with empathy for a frustrated message), not a
clinical or psychological assessment of the user. No ML model, no
external API call, so it's free and instant.
"""
import re

TONE_CATEGORIES = ["positive", "neutral", "confused", "frustrated", "angry", "urgent"]

_URGENT_WORDS = {"urgent", "asap", "immediately", "right now", "emergency", "today"}
_ANGRY_WORDS = {"angry", "furious", "ridiculous", "unacceptable", "terrible", "worst", "scam"}
_FRUSTRATED_WORDS = {"frustrated", "annoyed", "still waiting", "no one", "nobody", "again", "still not"}
_CONFUSED_WORDS = {"confused", "don't understand", "not sure", "unclear", "what does", "how does"}
_POSITIVE_WORDS = {"thanks", "thank you", "great", "awesome", "love", "perfect", "appreciate"}


def detect_tone(message: str) -> str:
    text = message.lower()
    exclamations = text.count("!")
    caps_ratio = sum(1 for c in message if c.isupper()) / max(len(message), 1)

    def has_any(words):
        return any(w in text for w in words)

    is_urgent = has_any(_URGENT_WORDS) or exclamations >= 2
    is_angry = has_any(_ANGRY_WORDS) or (caps_ratio > 0.5 and len(message) > 8)
    is_frustrated = has_any(_FRUSTRATED_WORDS)
    is_confused = has_any(_CONFUSED_WORDS)
    is_positive = has_any(_POSITIVE_WORDS)

    # Priority order matters: urgent/angry override softer signals
    if is_angry:
        return "angry"
    if is_urgent and is_frustrated:
        return "urgent"
    if is_frustrated:
        return "frustrated"
    if is_urgent:
        return "urgent"
    if is_confused:
        return "confused"
    if is_positive:
        return "positive"
    return "neutral"
