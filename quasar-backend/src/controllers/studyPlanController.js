/**
 * Study Plan Generator — streaming endpoint.
 * Takes user inputs (weeks, techStack, skillToLearn, optional fields)
 * and streams a rich Markdown weekly study plan via Groq.
 */
const { chatCompletion } = require('../services/groqService');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are an expert learning architect and curriculum designer. 
Your job is to create precise, actionable, week-by-week study plans.

## Output Rules — STRICT
- Output ONLY valid Markdown. No preamble, no "Here is your plan", no meta-commentary.
- Begin IMMEDIATELY with "# [Skill] Study Plan — [N]-Week Roadmap" as the first line.
- Structure EVERY plan exactly as:

  ## 📋 Overview
  Brief 2-3 sentence summary of the learning journey and what the user will be able to do by the end.

  ## 🗺️ Learning Path
  A visual progression: [Concept A] → [Concept B] → [Concept C] ...

  ---

  ## Week N: [Descriptive Theme Title]
  ### 🎯 Goal
  One sentence: what this week achieves.

  ### 📚 Topics
  - Topic 1
  - Topic 2
  - Topic 3

  ### 🗓️ Daily Breakdown
  | Day | Focus | Resource |
  |-----|-------|----------|
  | Mon | ... | [Resource Name](url) |
  | Tue | ... | ... |
  | Wed | ... | ... |
  | Thu | ... | ... |
  | Fri | ... | ... |
  | Sat | ... | ... |
  | Sun | Review & Rest | - |

  ### ✅ Week N Milestone Checklist
  - [ ] Milestone 1
  - [ ] Milestone 2
  - [ ] Milestone 3

  ---

  (repeat Week section for every week)

  ## 📦 Recommended Resources
  | Resource | Type | Link |
  |----------|------|------|
  | ... | Course/Book/Doc | [Link](url) |

  ## 💡 Tips for Success
  3-5 bullet points of study tips specific to this tech stack / skill.

## Resource Rules
- ONLY recommend real, widely-known resources (MDN, official docs, freeCodeCamp, The Odin Project, roadmap.sh, official YouTube channels, O'Reilly books, Coursera, Udemy top courses).
- ALWAYS format resource links as [Title](https://real-url.com).
- Tailor resources specifically to the tech stack provided.

## Tone
- Encouraging, precise, expert.
- Use emojis sparingly — only the section headers as shown above.
- Be specific: name actual concepts, not vague "learn X basics".`;

/**
 * POST /api/study-plan/generate
 * Body: { weeks, techStack, skillToLearn, currentLevel?, dailyHours?, goals? }
 * Streams response via SSE text/event-stream.
 */
async function generatePlan(req, res) {
  try {
    const { weeks, techStack, skillToLearn, currentLevel, dailyHours, goals } = req.body;

    // Validation
    if (!skillToLearn || typeof skillToLearn !== 'string' || !skillToLearn.trim()) {
      return res.status(400).json({ success: false, message: '`skillToLearn` is required' });
    }
    if (!weeks || isNaN(Number(weeks)) || Number(weeks) < 1 || Number(weeks) > 52) {
      return res.status(400).json({ success: false, message: '`weeks` must be a number between 1 and 52' });
    }
    if (!techStack || !Array.isArray(techStack) || techStack.length === 0) {
      return res.status(400).json({ success: false, message: '`techStack` must be a non-empty array' });
    }

    const stackStr = techStack.map(t => String(t).trim()).filter(Boolean).join(', ');
    const levelStr = currentLevel || 'Not specified';
    const hoursStr = dailyHours ? `${dailyHours} hours/day` : 'Not specified';
    const goalsStr = goals?.trim() || 'None provided';

    const userPrompt = `Generate a ${weeks}-week study plan with the following parameters:

**Skill to Learn:** ${skillToLearn.trim()}
**Tech Stack / Tools:** ${stackStr}
**Current Level:** ${levelStr}
**Daily Study Time Available:** ${hoursStr}
**Additional Goals / Context:** ${goalsStr}

Create a complete, detailed plan covering all ${weeks} weeks. 
${Number(weeks) <= 4 ? 'Be very granular with daily topics since the timeline is short.' : ''}
${Number(weeks) >= 8 ? 'Structure the plan in phases: Foundations, Core Concepts, Advanced Topics, and Project Work.' : ''}
Make the resource links real and specific to "${stackStr}".`;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    logger.info('Study plan generation started', {
      userId: req.user?.id,
      skillToLearn: skillToLearn.trim(),
      weeks,
      techStack: stackStr,
    });

    // Non-streaming completion (simulated streaming via chunked writes)
    const completion = await chatCompletion(
      SYSTEM_PROMPT,
      userPrompt,
      { model: 'llama-3.3-70b-versatile', temperature: 0.4, maxTokens: 8192 }
    );

    // Simulate streaming by flushing in small chunks for progressive UI rendering
    const CHUNK_SIZE = 80;
    for (let i = 0; i < completion.length; i += CHUNK_SIZE) {
      const chunk = completion.slice(i, i + CHUNK_SIZE);
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

    logger.info('Study plan generation completed', { userId: req.user?.id });
  } catch (err) {
    logger.error('Study plan generation error', { err: err.message });
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'An error occurred generating the plan' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ success: false, message: 'Study plan generation failed' });
    }
  }
}

module.exports = { generatePlan };
