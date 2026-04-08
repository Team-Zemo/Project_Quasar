/**
 * Shared Groq client — used for JD parsing, transcript evaluation, and report generation.
 * Gemini remains in use for the real-time Live interview session (geminiService.js).
 */
const Groq = require('groq-sdk');
const config = require('../config/env');

const groq = new Groq({ apiKey: config.groqApiKey });

/**
 * Run a chat completion against Groq and return the raw text.
 * @param {string} systemPrompt  – system message (role instructions)
 * @param {string} userPrompt    – user message (data / request)
 * @param {object} [opts]
 * @param {string} [opts.model]  – Groq model id
 * @param {number} [opts.temperature] – sampling temperature (default: 0.3)
 * @param {number} [opts.maxTokens]   – max tokens (default: 4096)
 * @returns {Promise<string>}
 */
async function chatCompletion(systemPrompt, userPrompt, opts = {}) {
  const {
    model = 'openai/gpt-oss-120b',
    temperature = 0.3,
    maxTokens = 4096,
  } = opts;

  const completion = await groq.chat.completions.create({
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

module.exports = { groq, chatCompletion };
