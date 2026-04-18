/**
 * AI Career Coach — chat endpoint with job search tool.
 * Scoped to: interview prep, time management, course planning, career advice, job discovery.
 * Context-aware: injects user's progress, skill vector, gamification stats, and profile data.
 * Tool-augmented: can search the platform's active job postings when the user asks about opportunities.
 */
const { chatCompletion, chatCompletionStream } = require('../services/groqService');
const { Session, UserStats } = require('../models');
const SkillVector = require('../models/SkillVector');
const User = require('../models/User');
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are **Quasar Coach**, an expert AI career coach built into the Interview Quasar platform.

## Your Role
You help users with:
- **Interview preparation**: behavioral questions, STAR method, technical interview strategies, mock interview tips, company-specific prep (FAANG, startups, etc.)
- **Time management**: study schedules, balancing work and prep, Pomodoro techniques, realistic timelines
- **Course planning**: recommending learning paths, certifications, project ideas for skill gaps
- **Career advice**: resume tips, LinkedIn optimization, salary negotiation, career transitions
- **Analyzing their interview performance**: if provided with their stats, give specific actionable advice
- **Finding jobs**: When the user asks about job opportunities, openings, vacancies, or "find me jobs", you will receive search results from the platform's database. Present them in a clear, organized way.

## Rules
1. NEVER generate code, write programs, debug code, or help with coding problems. You are NOT a coding assistant. If asked to code, politely redirect: "I'm your career coach! For coding practice, try the Interview module where you can practice with an AI interviewer."
2. NEVER help with topics unrelated to careers, interviews, learning, or professional development. Politely decline.
3. Always give **specific, actionable advice** — not generic platitudes.
4. Use **markdown formatting** liberally: headers, bullet points, numbered lists, bold text, tables for schedules.
5. Keep responses focused and concise but thorough. Use sections with headers for longer responses.
6. When you have the user's performance context, ALWAYS reference their specific strengths and weaknesses.
7. Be encouraging but honest. If scores are low, frame it as growth opportunity with concrete steps.

## Job Results Formatting
When presenting job search results, use this format for EACH job:
- Use **bold** for job titles
- Show company name, location, employment type
- Show salary range if available
- Add a brief snippet of the job description (first 2-3 lines)
- End each job card with a clickable link: [View & Apply →](/jobs/<id>) — the frontend will render this as a button
- Add your own analysis of how well the job matches the user's profile/skills
- Offer to help them prepare for any specific role

## Formatting
- Use ## for section headers
- Use **bold** for emphasis
- Use bullet lists and numbered lists
- Use tables for schedules or comparisons
- Use > blockquotes for tips or key takeaways
`;

// ── Intent detection prompt ─────────────────────────────────────────

const INTENT_PROMPT = `You are a classifier. Given the user's last message in a conversation, determine if they are asking about job opportunities, job openings, vacancies, or want to find/browse/search for jobs on the platform.

Respond with ONLY a JSON object, nothing else:
- If it IS a job search request: {"intent": "job_search", "keywords": ["keyword1", "keyword2"], "location": null or "location string", "type": null or "full-time|part-time|contract|internship"}
- If it is NOT a job search request: {"intent": "other"}

Extract search keywords from the user's message (e.g., "React developer" → ["React", "developer"], "ML jobs in Bangalore" → ["ML"], location: "Bangalore").
Be generous in detecting job-related intent — if the user says "find me work", "any openings", "show me jobs", "what roles are available", "opportunities for me", etc., treat it as job_search.
If the user just says "jobs" or "find jobs" without specifics, use their profile skills as keywords.`;

/**
 * Build a context block from the user's profile, interview history, and applications.
 */
async function buildUserContext(userId) {
  try {
    const [user, sessions, stats, skillVectors, applications] = await Promise.all([
      User.findById(userId).select('name headline skills experience resumeParsed location role platformContext leetcodeStats projects githubUsername leetcodeUsername').lean(),
      Session.find({ userId, overallScore: { $exists: true } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      UserStats.findOne({ userId }).lean(),
      SkillVector.find({ userId }).lean(),
      Application.find({ candidateId: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('jobPostingId', 'title company')
        .lean(),
    ]);

    if (!user && !sessions.length && !stats) return '';

    const parts = [`\n## USER CONTEXT (use this to personalize advice)\n`];

    // Profile info
    if (user) {
      if (user.headline) parts.push(`- **Current Role/Title**: ${user.headline}`);
      if (user.location) parts.push(`- **Location**: ${user.location}`);
      if (user.experience != null) parts.push(`- **Experience**: ${user.experience} years`);
      if (user.skills?.length > 0) parts.push(`- **Skills**: ${user.skills.join(', ')}`);

      // Resume parsed data
      if (user.resumeParsed) {
        const rp = user.resumeParsed;
        if (rp.education) parts.push(`- **Education**: ${Array.isArray(rp.education) ? rp.education.join('; ') : rp.education}`);
        if (rp.certifications) parts.push(`- **Certifications**: ${Array.isArray(rp.certifications) ? rp.certifications.join(', ') : rp.certifications}`);
        if (rp.projects && Array.isArray(rp.projects)) parts.push(`- **Projects**: ${rp.projects.slice(0, 3).join(', ')}`);
      }
    }

    // Job applications
    if (applications.length > 0) {
      parts.push(`\n### Active Job Applications`);
      parts.push(`- **Applied to ${applications.length} jobs** recently`);
      applications.slice(0, 3).forEach(app => {
        const job = app.jobPostingId;
        const title = job?.title || 'Unknown role';
        const company = job?.company || '';
        parts.push(`  - ${title}${company ? ` at ${company}` : ''} — Status: **${app.status?.replace(/_/g, ' ')}**`);
      });
    }

    if (stats) {
      parts.push(`\n### Platform Activity`);
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

    // ── Platform context (GitHub + LeetCode detailed data) ──
    if (user?.platformContext) {
      parts.push(user.platformContext);
    }

    return parts.join('\n');
  } catch (err) {
    logger.warn('Failed to build user context for coach', { err: err.message });
    return '';
  }
}

// ── Job search helper ──────────────────────────────────────────────

/**
 * Detect if the user's last message is a job search request using AI classification.
 * Returns { intent, keywords, location, type } or { intent: 'other' }.
 */
async function detectJobIntent(lastMessage, userSkills = []) {
  try {
    const response = await chatCompletion(
      INTENT_PROMPT,
      `User's profile skills: ${userSkills.join(', ') || 'none'}\n\nUser's message: "${lastMessage}"`,
      { model: 'llama-3.3-70b-versatile', temperature: 0, maxTokens: 200 }
    );

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { intent: 'other' };

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    logger.warn('Intent detection failed, defaulting to "other"', { err: err.message });
    return { intent: 'other' };
  }
}

/**
 * Search active job postings from the database.
 * Uses MongoDB text index + regex fallback for flexible matching.
 */
async function searchJobs({ keywords = [], location = null, type = null, userSkills = [] }) {
  try {
    const query = { status: 'published' };

    // Employment type filter
    if (type && ['full-time', 'part-time', 'contract', 'internship'].includes(type)) {
      query.employmentType = type;
    }

    // Location filter (case-insensitive partial match)
    if (location) {
      query.location = { $regex: location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    // Combine user skills + extracted keywords for search
    const allKeywords = [...new Set([...keywords, ...userSkills])].filter(Boolean);

    let jobs = [];

    if (allKeywords.length > 0) {
      // Strategy 1: MongoDB text search
      const textQuery = allKeywords.join(' ');
      const textSearchQuery = { ...query, $text: { $search: textQuery } };

      jobs = await JobPosting.find(textSearchQuery, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .select('title company location employmentType salaryRange jobDescription applicantCount createdAt')
        .lean();

      // Strategy 2: If text search yields < 3 results, try regex fallback
      if (jobs.length < 3) {
        const regexOr = allKeywords.map(kw => ({
          $or: [
            { title: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
            { jobDescription: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
            { company: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          ],
        }));

        const existingIds = jobs.map(j => j._id);
        const regexQuery = {
          ...query,
          _id: { $nin: existingIds },
          $or: regexOr.flatMap(r => r.$or),
        };

        const regexJobs = await JobPosting.find(regexQuery)
          .sort({ createdAt: -1 })
          .limit(10 - jobs.length)
          .select('title company location employmentType salaryRange jobDescription applicantCount createdAt')
          .lean();

        jobs = [...jobs, ...regexJobs];
      }
    } else {
      // No keywords — return latest published jobs
      jobs = await JobPosting.find(query)
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title company location employmentType salaryRange jobDescription applicantCount createdAt')
        .lean();
    }

    return jobs;
  } catch (err) {
    logger.error('Job search failed', { err: err.message });
    return [];
  }
}

/**
 * Format job results into a context block for the AI to use.
 */
function formatJobResults(jobs, searchMeta) {
  if (jobs.length === 0) {
    return `\n## JOB SEARCH RESULTS\nNo active job postings found matching "${searchMeta}". Let the user know and suggest they broaden their search or check back later.\n`;
  }

  const parts = [
    `\n## JOB SEARCH RESULTS (${jobs.length} matching openings found)`,
    `Search: "${searchMeta}"\n`,
    `Present these results clearly to the user and analyze how each matches their profile.\n`,
  ];

  jobs.forEach((job, i) => {
    const salary = job.salaryRange
      ? `${job.salaryRange.currency || 'INR'} ${job.salaryRange.min ? job.salaryRange.min.toLocaleString() : '?'} - ${job.salaryRange.max ? job.salaryRange.max.toLocaleString() : '?'}`
      : 'Not disclosed';

    const desc = (job.jobDescription || '')
      .replace(/\n+/g, ' ')
      .slice(0, 300);

    parts.push(`### Job ${i + 1}`);
    parts.push(`- **Title**: ${job.title}`);
    parts.push(`- **Company**: ${job.company}`);
    parts.push(`- **Location**: ${job.location || 'Not specified'}`);
    parts.push(`- **Type**: ${job.employmentType || 'full-time'}`);
    parts.push(`- **Salary**: ${salary}`);
    parts.push(`- **Applicants so far**: ${job.applicantCount || 0}`);
    parts.push(`- **Posted**: ${new Date(job.createdAt).toLocaleDateString()}`);
    parts.push(`- **Description snippet**: ${desc}…`);
    parts.push(`- [View & Apply →](/jobs/${job._id})`);
    parts.push('');
  });

  parts.push(`IMPORTANT: Present these jobs to the user. Each job has a clickable "View & Apply" link. DO NOT add your own Job ID text — just use the link provided above. Give a brief match analysis per job.`);

  return parts.join('\n');
}

// ── Main chat endpoint ──────────────────────────────────────────────

/**
 * POST /api/coach/chat
 * Body: { messages: [{role, content}] }
 * Streams response via SSE-style chunked text/event-stream.
 *
 * Flow:
 * 1. Classify user's last message for job search intent
 * 2. If job search → query DB → inject results into context
 * 3. Generate response with full context
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
    const userId = req.user.id;
    const userContext = await buildUserContext(userId);

    // Detect job search intent
    const lastMessage = sanitized[sanitized.length - 1].content;
    const user = await User.findById(userId).select('skills').lean();
    const userSkills = user?.skills || [];

    const intent = await detectJobIntent(lastMessage, userSkills);
    let jobContext = '';

    if (intent.intent === 'job_search') {
      logger.info('Job search intent detected', { userId, keywords: intent.keywords, location: intent.location });

      const jobs = await searchJobs({
        keywords: intent.keywords || [],
        location: intent.location || null,
        type: intent.type || null,
        userSkills,
      });

      const searchMeta = [
        ...(intent.keywords || []),
        intent.location ? `in ${intent.location}` : '',
        intent.type || '',
      ].filter(Boolean).join(' ');

      jobContext = formatJobResults(jobs, searchMeta || 'all available jobs');
    }

    const fullSystemPrompt = SYSTEM_PROMPT + userContext + jobContext;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Real token-by-token streaming from Groq
    try {
      const groqStream = chatCompletionStream(
        fullSystemPrompt,
        sanitized,
        { model: 'llama-3.3-70b-versatile', temperature: 0.5, maxTokens: 4096 }
      );

      for await (const delta of groqStream) {
        if (res.writableEnded) break;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    } catch (streamErr) {
      logger.error('Groq coach stream error', { err: streamErr.message });
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
      }
    }

    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    logger.error('Coach chat error', { err: err.message });
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'An error occurred' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ success: false, message: 'Coach chat failed' });
    }
  }
}

module.exports = { chat };
