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

/**
 * Run a streaming chat completion against Groq.
 * Yields each content delta string as it arrives from the API.
 * @param {string} systemPrompt  – system message
 * @param {Array<{role: string, content: string}>} messages – full conversation history
 * @param {object} [opts]
 * @param {string} [opts.model]
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @returns {AsyncGenerator<string>}
 */
async function* chatCompletionStream(systemPrompt, messages, opts = {}) {
  const {
    model = 'llama-3.3-70b-versatile',
    temperature = 0.5,
    maxTokens = 4096,
  } = opts;

  const stream = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

module.exports = { client, chatCompletion, chatCompletionStream };
