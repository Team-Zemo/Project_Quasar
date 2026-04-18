/**
 * Study Plan Controller
 * - generatePlan: Stream a markdown plan via SSE (existing, enhanced to also produce structured JSON)
 * - savePlan: Save generated plan + structured schedule to DB
 * - getActivePlan: Retrieve the user's current plan
 * - startSchedule: Activate daily email reminders
 * - stopSchedule: Pause reminders
 * - toggleDay: Mark a schedule day as completed/incomplete
 */
const { chatCompletion } = require('../services/groqService');
const StudyPlan = require('../models/StudyPlan');
const logger = require('../utils/logger');

// ── System prompt for markdown plan generation (unchanged) ────────────

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

// ── System prompt for structured JSON schedule generation ──────────────

const SCHEDULE_SYSTEM_PROMPT = `You are a study plan scheduler. Given a markdown study plan, extract a structured JSON schedule.

## Output Rules — STRICT
- Output ONLY a valid JSON array. NO markdown, NO preamble, NO commentary.
- Each element is an object with these exact keys:
  { "week": <number>, "day": "<Mon|Tue|Wed|Thu|Fri|Sat|Sun>", "focus": "<topic/activity>", "resource": "<resource name or URL or '-'>" }
- Extract EVERY day from EVERY week's "Daily Breakdown" table.
- Preserve the exact focus text and resource from the table.
- The array must be ordered: week 1 Mon first, week 1 Tue second, etc.

Output the JSON array now:`;

/**
 * POST /api/study-plan/generate
 * Streams the markdown plan via SSE (existing flow, unchanged).
 */
async function generatePlan(req, res) {
  try {
    const { weeks, techStack, skillToLearn, currentLevel, dailyHours, goals } = req.body;

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

    const completion = await chatCompletion(
      SYSTEM_PROMPT,
      userPrompt,
      { model: 'llama-3.3-70b-versatile', temperature: 0.4, maxTokens: 8192 }
    );

    // Simulate streaming by flushing in small chunks
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

/**
 * POST /api/study-plan/save
 * Save a generated plan and parse its structured schedule.
 * Body: { markdownContent, skillToLearn, techStack, weeks, dailyHours, currentLevel }
 * If user already has a plan, it is replaced (override).
 */
async function savePlan(req, res) {
  try {
    const userId = req.user?.id;
    const { markdownContent, skillToLearn, techStack, weeks, dailyHours, currentLevel } = req.body;

    if (!markdownContent || !skillToLearn || !weeks) {
      return res.status(400).json({ success: false, message: 'markdownContent, skillToLearn, and weeks are required' });
    }

    // Use AI to extract structured schedule from the markdown
    let schedule = [];
    try {
      const scheduleJson = await chatCompletion(
        SCHEDULE_SYSTEM_PROMPT,
        markdownContent,
        { model: 'llama-3.3-70b-versatile', temperature: 0.1, maxTokens: 8192 }
      );

      // Clean up potential markdown code fences
      const cleaned = scheduleJson
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        // Assign calendar dates starting from tomorrow
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);

        let dayOffset = 0;
        schedule = parsed.map(item => {
          const date = new Date(startDate);
          date.setDate(date.getDate() + dayOffset);
          dayOffset++;
          return {
            date,
            week: item.week || 1,
            day: item.day || 'Mon',
            focus: item.focus || '',
            resource: item.resource || '-',
            completed: false,
          };
        });
      }
    } catch (parseErr) {
      logger.warn('Failed to parse structured schedule from AI', { err: parseErr.message });
      // Continue without schedule — plan still saves with markdown
    }

    // Upsert — replace any existing plan for this user
    const plan = await StudyPlan.findOneAndUpdate(
      { userId },
      {
        userId,
        skillToLearn: skillToLearn.trim(),
        techStack: techStack || [],
        weeks: Number(weeks),
        dailyHours: dailyHours || 2,
        currentLevel: currentLevel || '',
        markdownContent,
        schedule,
        status: 'saved',
        startedAt: null,
        lastEmailSentDate: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info('Study plan saved', { userId, planId: plan._id, scheduleDays: schedule.length });

    return res.json({
      success: true,
      message: `Study plan saved with ${schedule.length} scheduled days`,
      data: plan,
    });
  } catch (err) {
    logger.error('Save study plan error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to save study plan' });
  }
}

/**
 * GET /api/study-plan/active
 * Get the user's current study plan (if any).
 */
async function getActivePlan(req, res) {
  try {
    const userId = req.user?.id;
    const plan = await StudyPlan.findOne({ userId }).lean();

    if (!plan) {
      return res.json({ success: true, message: 'No study plan found', data: null });
    }

    return res.json({ success: true, message: 'Study plan retrieved', data: plan });
  } catch (err) {
    logger.error('Get active plan error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get study plan' });
  }
}

/**
 * POST /api/study-plan/start
 * Activate the schedule — emails will start firing from the cron job.
 * Recalculates schedule dates from today.
 */
async function startSchedule(req, res) {
  try {
    const userId = req.user?.id;
    const plan = await StudyPlan.findOne({ userId });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'No study plan found. Generate and save one first.' });
    }

    if (plan.schedule.length === 0) {
      return res.status(400).json({ success: false, message: 'Plan has no schedule. Please regenerate.' });
    }

    // Recalculate dates starting from tomorrow
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < plan.schedule.length; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      plan.schedule[i].date = date;
      plan.schedule[i].completed = false;
    }

    plan.status = 'active';
    plan.startedAt = new Date();
    plan.lastEmailSentDate = null;
    await plan.save();

    logger.info('Study plan schedule started', { userId, days: plan.schedule.length });

    return res.json({
      success: true,
      message: 'Schedule activated! You will receive daily study emails starting tomorrow.',
      data: plan,
    });
  } catch (err) {
    logger.error('Start schedule error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to start schedule' });
  }
}

/**
 * POST /api/study-plan/stop
 * Pause the schedule — cron will skip this plan.
 */
async function stopSchedule(req, res) {
  try {
    const userId = req.user?.id;
    const plan = await StudyPlan.findOneAndUpdate(
      { userId },
      { status: 'paused' },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({ success: false, message: 'No study plan found' });
    }

    logger.info('Study plan schedule paused', { userId });

    return res.json({
      success: true,
      message: 'Schedule paused. You will no longer receive daily emails.',
      data: plan,
    });
  } catch (err) {
    logger.error('Stop schedule error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to pause schedule' });
  }
}

/**
 * PUT /api/study-plan/toggle-day/:index
 * Mark a specific schedule day as completed or incomplete.
 */
async function toggleDay(req, res) {
  try {
    const userId = req.user?.id;
    const index = parseInt(req.params.index, 10);

    const plan = await StudyPlan.findOne({ userId });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'No study plan found' });
    }

    if (isNaN(index) || index < 0 || index >= plan.schedule.length) {
      return res.status(400).json({ success: false, message: 'Invalid day index' });
    }

    plan.schedule[index].completed = !plan.schedule[index].completed;

    // Check if all days are completed
    const allDone = plan.schedule.every(d => d.completed);
    if (allDone) {
      plan.status = 'completed';
    }

    await plan.save();

    return res.json({
      success: true,
      message: `Day ${index} toggled to ${plan.schedule[index].completed ? 'completed' : 'incomplete'}`,
      data: {
        index,
        completed: plan.schedule[index].completed,
        planStatus: plan.status,
      },
    });
  } catch (err) {
    logger.error('Toggle day error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to toggle day' });
  }
}

/**
 * DELETE /api/study-plan
 * Delete the user's study plan entirely.
 */
async function deletePlan(req, res) {
  try {
    const userId = req.user?.id;
    await StudyPlan.deleteOne({ userId });
    logger.info('Study plan deleted', { userId });
    return res.json({ success: true, message: 'Study plan deleted', data: null });
  } catch (err) {
    logger.error('Delete plan error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to delete study plan' });
  }
}

module.exports = {
  generatePlan,
  savePlan,
  getActivePlan,
  startSchedule,
  stopSchedule,
  toggleDay,
  deletePlan,
};
