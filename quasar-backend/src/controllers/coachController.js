/**
 * AI Career Coach — streaming chat endpoint (Groq).
 * Scoped to: interview prep, time management, course planning, career advice.
 * Context-aware: injects user's progress, skill vector, and gamification stats.
 */
const { chatCompletion } = require('../services/groqService');
const { Session, UserStats } = require('../models');
const SkillVector = require('../models/SkillVector');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are **Quasar Coach**, an expert AI career coach built into the Interview Quasar platform.

## Your Role
You help users with:
- **Interview preparation**: behavioral questions, STAR method, technical interview strategies, mock interview tips, company-specific prep (FAANG, startups, etc.)
- **Time management**: study schedules, balancing work and prep, Pomodoro techniques, realistic timelines
- **Course planning**: recommending learning paths, certifications, project ideas for skill gaps
- **Career advice**: resume tips, LinkedIn optimization, salary negotiation, career transitions
- **Analyzing their interview performance**: if provided with their stats, give specific actionable advice

## Rules
1. NEVER generate code, write programs, debug code, or help with coding problems. You are NOT a coding assistant. If asked to code, politely redirect: "I'm your career coach! For coding practice, try the Interview module where you can practice with an AI interviewer."
2. NEVER help with topics unrelated to careers, interviews, learning, or professional development. Politely decline.
3. Always give **specific, actionable advice** — not generic platitudes.
4. Use **markdown formatting** liberally: headers, bullet points, numbered lists, bold text, tables for schedules.
5. Keep responses focused and concise but thorough. Use sections with headers for longer responses.
6. When you have the user's performance context, ALWAYS reference their specific strengths and weaknesses.
7. Be encouraging but honest. If scores are low, frame it as growth opportunity with concrete steps.

## Formatting
- Use ## for section headers
- Use **bold** for emphasis
- Use bullet lists and numbered lists
- Use tables for schedules or comparisons
- Use > blockquotes for tips or key takeaways
`;

/**
 * Build a context block from the user's interview history.
 */
async function buildUserContext(userId) {
  try {
    const [sessions, stats, skillVectors] = await Promise.all([
      Session.find({ userId, overallScore: { $exists: true } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      UserStats.findOne({ userId }).lean(),
      SkillVector.find({ userId }).lean(),
    ]);

    if (!sessions.length && !stats) return '';

    const parts = [`\n## USER CONTEXT (use this to personalize advice)\n`];

    if (stats) {
      parts.push(`- **Level**: ${stats.level} | **XP**: ${stats.xp}`);
      parts.push(`- **Total sessions**: ${stats.totalSessions}`);
      parts.push(`- **Current streak**: ${stats.currentStreak} days (longest: ${stats.longestStreak})`);
      parts.push(`- **Domains practiced**: ${stats.domainsPlayed?.join(', ') || 'none yet'}`);
      parts.push(`- **Personas used**: ${stats.personasUsed?.join(', ') || 'none yet'}`);
      parts.push(`- **JDs parsed**: ${stats.jdsParsed || 0} | **Resume checks**: ${stats.resumeComparesRun || 0}`);
      const badgeCount = stats.badges?.length || 0;
      parts.push(`- **Badges unlocked**: ${badgeCount}/25`);
    }

    if (sessions.length > 0) {
      const avgScore = (sessions.reduce((s, x) => s + (x.overallScore || 0), 0) / sessions.length).toFixed(1);
      const passRate = ((sessions.filter(s => s.passed).length / sessions.length) * 100).toFixed(0);
      parts.push(`\n### Recent Performance (last ${sessions.length} sessions)`);
      parts.push(`- **Average score**: ${avgScore}/10`);
      parts.push(`- **Pass rate**: ${passRate}%`);

      // Find strongest/weakest from last session
      const last = sessions[0];
      if (last.starScores) {
        const starEntries = Object.entries(last.starScores).filter(([, v]) => typeof v === 'number');
        if (starEntries.length > 0) {
          starEntries.sort((a, b) => b[1] - a[1]);
          parts.push(`- **Strongest STAR dimension**: ${starEntries[0][0]} (${starEntries[0][1]}/10)`);
          parts.push(`- **Weakest STAR dimension**: ${starEntries[starEntries.length - 1][0]} (${starEntries[starEntries.length - 1][1]}/10)`);
        }
      }
    }

    if (skillVectors.length > 0) {
      parts.push(`\n### Skill Vector`);
      skillVectors
        .sort((a, b) => a.score - b.score)
        .forEach(sv => {
          parts.push(`- ${sv.skill.replace(/_/g, ' ')}: **${parseFloat(sv.score).toFixed(1)}/10** (${sv.attempt_count} attempts)`);
        });
    }

    return parts.join('\n');
  } catch (err) {
    logger.warn('Failed to build user context for coach', { err: err.message });
    return '';
  }
}

/**
 * POST /api/coach/chat
 * Body: { messages: [{role, content}] }
 * Streams response via SSE-style chunked text/event-stream.
 */
async function chat(req, res) {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    // Validate all messages are user/assistant only
    const sanitized = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== 'user') {
      return res.status(400).json({ success: false, message: 'Last message must be from user' });
    }

    // Build context-aware system prompt
    const userContext = await buildUserContext(req.user.id);
    const fullSystemPrompt = SYSTEM_PROMPT + userContext;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Non-streaming completion (NeevCloud does not support streaming)
    const completion = await chatCompletion(
      fullSystemPrompt,
      sanitized.map(m => `${m.role}: ${m.content}`).join('\n'),
      { model: 'llama-3.3-70b-versatile', temperature: 0.5, maxTokens: 4096 }
    );

    // Simulate streaming by flushing in small chunks for progressive UI rendering
    const CHUNK_SIZE = 80;
    for (let i = 0; i < completion.length; i += CHUNK_SIZE) {
      const chunk = completion.slice(i, i + CHUNK_SIZE);
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    logger.error('Coach chat error', { err: err.message });
    // If headers already sent, just end
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'An error occurred' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ success: false, message: 'Coach chat failed' });
    }
  }
}

module.exports = { chat };
