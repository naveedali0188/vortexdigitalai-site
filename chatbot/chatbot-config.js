/* ============================================================
   CHATBOT CONFIG — edit this file to configure the widget.
   No secrets go here — this file is public/served to every visitor.
============================================================= */
window.VX_CHATBOT_CONFIG = {
  // EDIT ME: point this at your deployed backend (see backend/README.md).
  // Leave as-is during local testing with `flask run` on port 8000.
  apiUrl: "http://localhost:8000/api/chat",

  enabled: true,
  maxMessageLength: 1000,
  maxHistoryMessages: 10,

  welcomeMessage:
    "Hi! \ud83d\udc4b I'm your AI customer support assistant. I can help you find services, " +
    "explain courses, and guide you around the site. What can I help you with?",

  quickQuestions: [
    "What services do you offer?",
    "Tell me about your AI courses",
    "How can I contact support?",
    "Do you help with PrestaShop to Shopify migration?"
  ],

  // Shown if the backend is unreachable (see FALLBACK MODE in the spec)
  fallbackLinks: [
    { label: "Browse Services", url: "/index.html#services" },
    { label: "Browse Courses", url: "/index.html#courses" },
    { label: "Read FAQs", url: "/index.html#faq" },
    { label: "WhatsApp Us", url: "https://wa.me/923125282051" }
  ]
};
