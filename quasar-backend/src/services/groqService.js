/**
 * Shared Groq client (OpenAI-compatible) — used for JD parsing,
 * transcript evaluation, report generation, coach chat, and study plans.
 * Gemini remains in use for the real-time Live interview session (geminiService.js).
 */
const OpenAI = require('openai');
const config = require('../config/env');

const client = new OpenAI({
  apiKey: config.groqApiKey,
  baseURL: 'https://api.groq.com/openai/v1',
  timeout: 5 * 60 * 1000, // 5 minutes
});

/**
 * Run a chat completion against Groq and return the raw text.
 * @param {string} systemPrompt  – system message (role instructions)
 * @param {string} userPrompt    – user message (data / request)
 * @param {object} [opts]
 * @param {string} [opts.model]  – model id (default: llama-3.3-70b-versatile)
 * @param {number} [opts.temperature] – sampling temperature (default: 0.3)
 * @param {number} [opts.maxTokens]   – max tokens (default: 4096)
 * @returns {Promise<string>}
 */
async function chatCompletion(systemPrompt, userPrompt, opts = {}) {
  const {
    model = 'llama-3.3-70b-versatile',
    temperature = 0.3,
    maxTokens = 4096,
  } = opts;

  const completion = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? '';
}

module.exports = { client, chatCompletion };
