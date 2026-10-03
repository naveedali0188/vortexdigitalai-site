/* ============================================================
   PUBLIC CHATBOT CONFIGURATION
   This file is delivered to visitors. Never put secrets here.
============================================================= */
window.VX_CHATBOT_CONFIG = {
  enabled: true,
  maxMessageLength: 1600,
  maxHistoryMessages: 10,
  maxIndexedPages: 100,
  maxRetrievedChunks: 5,
  maxAnswerTokens: 180,

  // WebLLM and the small Apache-2.0 Qwen model are loaded only when chat opens.
  webLlmModuleUrl: "https://esm.run/@mlc-ai/web-llm@0.2.85",
  modelId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",

  contactEmail: "naveedali01888@gmail.com",

  welcomeMessage:
    "Hi! I'm the VortexDigitalAI website assistant. I use information from this website to answer questions. What can I help you find?",

  quickQuestions: [
    "What services do you offer?",
    "Tell me about your AI courses",
    "How can I contact support?",
    "Do you help with PrestaShop to Shopify migration?"
  ]
};
