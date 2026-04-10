/**
 * Platform Sync Service
 * Fetches rich, structured context from GitHub (REST API) and LeetCode
 * (alfa-leetcode-api proxy). Stores raw structured data in the User model and
 * builds a plain-text platformContext block that is injected verbatim into the
 * Gemini system prompt for every interview and the Coach chat.
 *
 * GitHub endpoints used:
 *   GET /users/:username                    – profile bio, followers, company
 *   GET /users/:username/repos?per_page=100 – repos list (primary language, stars, topics)
 *   GET /repos/:owner/:repo/languages       – byte-level language breakdown per repo
 *
 * LeetCode endpoints used (alfa-leetcode-api):
 *   GET /:username                  – total solved counts, ranking, reputation
 *   GET /:username/contest          – contest rating, attended, global ranking
 *   GET /:username/language         – languages used, problems solved per language
 *   GET /:username/skill            – skill tags (advanced / intermediate / fundamental)
 *   GET /:username/solved           – solved problem breakdown (Easy / Medium / Hard)
 */

const User = require('../models/User');
const logger = require('../utils/logger');

const LEETCODE_BASE = 'https://alfa-leetcode-api.onrender.com';

// ── URL helpers ─────────────────────────────────────────────────────

function extractGithubUsername(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length > 0) return parts[0];
  } catch (_) {
    const match = url.match(/github\.com\/([^/?#]+)/i);
    if (match) return match[1];
  }
  return null;
}

function extractLeetCodeUsername(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const parts = parsed.pathname.split('/').filter(Boolean);
    // handles /u/username and /username
    if (parts[0] === 'u' && parts.length > 1) return parts[1];
    if (parts.length > 0) return parts[0];
  } catch (_) {
    const match = url.match(/leetcode\.com\/(?:u\/)?([^/?#]+)/i);
    if (match) return match[1];
  }
  return null;
}

// ── Generic fetch with error capture ───────────────────────────────

async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} at ${url}`);
  }
  return res.json();
}

// ── GitHub ──────────────────────────────────────────────────────────

function buildGithubHeaders() {
  const headers = { 'User-Agent': 'quasar-backend' };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchGithubUserProfile(username) {
  const headers = buildGithubHeaders();
  return safeFetch(`https://api.github.com/users/${username}`, { headers });
}

async function fetchGithubRepos(username) {
  const headers = buildGithubHeaders();
  return safeFetch(
    `https://api.github.com/users/${username}/repos?sort=updated&per_page=100`,
    { headers }
  );
}

async function fetchRepoLanguages(owner, repoName) {
  const headers = buildGithubHeaders();
  try {
    return await safeFetch(
      `https://api.github.com/repos/${owner}/${repoName}/languages`,
      { headers }
    );
  } catch (_) {
    return {};
  }
}

/**
 * Aggregates full GitHub context for a user:
 * - User bio, company, followers, public repos count
 * - All non-forked repos with name, description, stars, topics, per-repo language bytes
 * - Global language byte tally → top languages by actual LOC
 */
async function fetchGithubData(username) {
  const [profile, repos] = await Promise.all([
    fetchGithubUserProfile(username),
    fetchGithubRepos(username),
  ]);

  // Fetch per-repo language breakdown in parallel — cap at 30 own repos to stay
  // well within GitHub rate limits even without a token (60 req/hr).
  const ownRepos = repos.filter(r => !r.fork);
  const reposToExpand = ownRepos.slice(0, 30);

  const languageResults = await Promise.all(
    reposToExpand.map(r => fetchRepoLanguages(username, r.name))
  );

  const globalLanguageBytes = {};
  const projects = [];

  reposToExpand.forEach((repo, idx) => {
    const langBytes = languageResults[idx] || {};

    // Accumulate global bytes
    for (const [lang, bytes] of Object.entries(langBytes)) {
      globalLanguageBytes[lang] = (globalLanguageBytes[lang] || 0) + bytes;
    }

    projects.push({
      name: repo.name,
      description: repo.description || null,
      url: repo.html_url,
      language: repo.language || null,
      stars: repo.stargazers_count || 0,
      topics: repo.topics || [],
      languages: langBytes,
      isForked: false,
    });
  });

  // Sort global languages by byte count → top 10
  const topLanguages = Object.entries(globalLanguageBytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lang]) => lang);

  return {
    profile: {
      bio: profile.bio || null,
      company: profile.company || null,
      blog: profile.blog || null,
      location: profile.location || null,
      publicRepos: profile.public_repos || 0,
      followers: profile.followers || 0,
      following: profile.following || 0,
    },
    projects,
    topLanguages,
    globalLanguageBytes,
  };
}

// ── LeetCode ────────────────────────────────────────────────────────

async function fetchLeetCodeData(username) {
  // Fire all endpoints in parallel; capture individual failures without aborting
  const [mainResult, solvedResult, contestResult, languageResult, skillResult] =
    await Promise.allSettled([
      safeFetch(`${LEETCODE_BASE}/${username}`),
      safeFetch(`${LEETCODE_BASE}/${username}/solved`),
      safeFetch(`${LEETCODE_BASE}/${username}/contest`),
      safeFetch(`${LEETCODE_BASE}/${username}/language`),
      safeFetch(`${LEETCODE_BASE}/${username}/skill`),
    ]);

  const getValue = result => (result.status === 'fulfilled' ? result.value : null);

  const main = getValue(mainResult);
  const solved = getValue(solvedResult);
  const contest = getValue(contestResult);
  const language = getValue(languageResult);
  const skill = getValue(skillResult);

  // ── Solved counts ──
  const totalSolved = main?.totalSolved ?? solved?.solvedProblem ?? null;
  const easySolved  = main?.easySolved  ?? solved?.easySolved   ?? null;
  const mediumSolved= main?.mediumSolved?? solved?.mediumSolved ?? null;
  const hardSolved  = main?.hardSolved  ?? solved?.hardSolved   ?? null;
  const ranking     = main?.ranking     ?? null;

  // ── Contest ──
  const contestRating    = contest?.contestRating    ?? null;
  const contestRanking   = contest?.contestGlobalRanking ?? null;
  const contestAttended  = contest?.contestAttend ?? 
    (Array.isArray(contest?.contestParticipation) ? contest.contestParticipation.length : null);

  // ── Languages (top solved by language) ──
  const langItems = language?.matchedUser?.languageProblemCount
    ?? language?.languageProblemCount
    ?? [];
  const topLanguages = langItems
    .sort((a, b) => b.problemsSolved - a.problemsSolved)
    .slice(0, 8)
    .map(l => l.languageName);

  // ── Skills ──
  const tagCounts =
    skill?.data?.matchedUser?.tagProblemCounts ??
    skill?.matchedUser?.tagProblemCounts ??
    {};

  const extractTags = (arr) =>
    Array.isArray(arr) ? arr.filter(t => t.problemsSolved > 0).map(t => t.tagName) : [];

  const advancedSkills     = extractTags(tagCounts.advanced);
  const intermediateSkills = extractTags(tagCounts.intermediate);
  const fundamentalSkills  = extractTags(tagCounts.fundamental);

  return {
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    ranking,
    contestRating,
    contestRanking,
    contestAttended,
    topLanguages,
    advancedSkills,
    intermediateSkills,
    fundamentalSkills,
  };
}

// ── Context block builder ───────────────────────────────────────────

/**
 * Builds a plain-text context block from fetched GitHub + LeetCode data.
 * This is stored in User.platformContext and directly injected into AI prompts.
 */
function buildPlatformContextBlock(githubData, leetcodeData, githubUsername, leetcodeUsername) {
  const lines = ['\n## Candidate External Platform Context\n'];

  // ── GitHub section ──
  if (githubData) {
    lines.push('### GitHub Profile');
    lines.push(`- **Username**: ${githubUsername}`);
    if (githubData.profile.bio)       lines.push(`- **Bio**: ${githubData.profile.bio}`);
    if (githubData.profile.company)   lines.push(`- **Company**: ${githubData.profile.company}`);
    if (githubData.profile.location)  lines.push(`- **Location**: ${githubData.profile.location}`);
    lines.push(`- **Public Repos**: ${githubData.profile.publicRepos}`);
    lines.push(`- **Followers**: ${githubData.profile.followers}`);

    if (githubData.topLanguages.length > 0) {
      lines.push(`- **Primary Languages (by LOC)**: ${githubData.topLanguages.join(', ')}`);
    }

    if (githubData.projects.length > 0) {
      lines.push('\n#### GitHub Projects (own repos, sorted by last updated)');
      githubData.projects.slice(0, 20).forEach(p => {
        lines.push(`\n**${p.name}**`);
        if (p.description) lines.push(`  - Description: ${p.description}`);
        lines.push(`  - Stars: ${p.stars}`);
        if (p.language)    lines.push(`  - Primary language: ${p.language}`);
        if (p.topics && p.topics.length > 0) {
          lines.push(`  - Topics: ${p.topics.join(', ')}`);
        }
        if (p.languages && Object.keys(p.languages).length > 0) {
          const sorted = Object.entries(p.languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([l]) => l);
          lines.push(`  - Languages used: ${sorted.join(', ')}`);
        }
        lines.push(`  - URL: ${p.url}`);
      });
    }
  }

  // ── LeetCode section ──
  if (leetcodeData) {
    lines.push('\n### LeetCode Stats');
    lines.push(`- **Username**: ${leetcodeUsername}`);
    if (leetcodeData.totalSolved != null) {
      lines.push(
        `- **Problems Solved**: ${leetcodeData.totalSolved} total ` +
        `(Easy: ${leetcodeData.easySolved ?? '?'}, ` +
        `Medium: ${leetcodeData.mediumSolved ?? '?'}, ` +
        `Hard: ${leetcodeData.hardSolved ?? '?'})`
      );
    }
    if (leetcodeData.ranking != null) {
      lines.push(`- **Global Ranking**: #${leetcodeData.ranking.toLocaleString()}`);
    }
    if (leetcodeData.contestRating != null) {
      lines.push(`- **Contest Rating**: ${leetcodeData.contestRating}`);
    }
    if (leetcodeData.contestRanking != null) {
      lines.push(`- **Contest Global Ranking**: #${leetcodeData.contestRanking.toLocaleString()}`);
    }
    if (leetcodeData.contestAttended != null) {
      lines.push(`- **Contests Attended**: ${leetcodeData.contestAttended}`);
    }
    if (leetcodeData.topLanguages.length > 0) {
      lines.push(`- **Languages Used (by problems solved)**: ${leetcodeData.topLanguages.join(', ')}`);
    }
    if (leetcodeData.advancedSkills.length > 0) {
      lines.push(`- **Advanced DSA Skills**: ${leetcodeData.advancedSkills.join(', ')}`);
    }
    if (leetcodeData.intermediateSkills.length > 0) {
      lines.push(`- **Intermediate DSA Skills**: ${leetcodeData.intermediateSkills.join(', ')}`);
    }
    if (leetcodeData.fundamentalSkills.length > 0) {
      lines.push(`- **Fundamental DSA Skills**: ${leetcodeData.fundamentalSkills.join(', ')}`);
    }
  }

  return lines.join('\n');
}

// ── Skill merger ────────────────────────────────────────────────────

/**
 * Merge new skills (from platform) into existing skills (from resume),
 * deduplicating case-insensitively. Preserves original casing of existing skills.
 */
function mergeSkills(existingSkills, newSkills) {
  const seen = new Set(existingSkills.map(s => s.toLowerCase()));
  const merged = [...existingSkills];
  for (const s of newSkills) {
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      merged.push(s);
    }
  }
  return merged;
}

// ── Main orchestrator ────────────────────────────────────────────────

/**
 * Fetch full context from GitHub and LeetCode for a candidate,
 * persists to the User document, and builds the platformContext
 * text block used by Coach and interview AI.
 *
 * @param {string} userId - MongoDB ObjectId string of the candidate
 */
async function fetchAndSyncUserPlatforms(userId) {
  let user;
  try {
    user = await User.findById(userId);
    if (!user) return;

    if (!user.githubUrl && !user.leetcodeUrl) return;

    user.platformSyncStatus = 'syncing';
    await user.save();

    const githubUsername  = extractGithubUsername(user.githubUrl);
    const leetcodeUsername = extractLeetCodeUsername(user.leetcodeUrl);

    if (githubUsername)   user.githubUsername   = githubUsername;
    if (leetcodeUsername) user.leetcodeUsername = leetcodeUsername;

    // ── Fetch both platforms in parallel ──
    const [githubResult, leetcodeResult] = await Promise.allSettled([
      githubUsername  ? fetchGithubData(githubUsername)   : Promise.resolve(null),
      leetcodeUsername ? fetchLeetCodeData(leetcodeUsername) : Promise.resolve(null),
    ]);

    const githubData   = githubResult.status   === 'fulfilled' ? githubResult.value   : null;
    const leetcodeData = leetcodeResult.status === 'fulfilled' ? leetcodeResult.value : null;

    const githubFailed   = githubUsername   && githubResult.status   === 'rejected';
    const leetcodeFailed = leetcodeUsername && leetcodeResult.status === 'rejected';

    if (githubFailed)   logger.error('GitHub fetch failed',   { username: githubUsername,   err: githubResult.reason?.message });
    if (leetcodeFailed) logger.error('LeetCode fetch failed', { username: leetcodeUsername, err: leetcodeResult.reason?.message });

    // ── Persist structured LeetCode stats ──
    if (leetcodeData) {
      user.leetcodeStats = {
        totalSolved:       leetcodeData.totalSolved,
        easySolved:        leetcodeData.easySolved,
        mediumSolved:      leetcodeData.mediumSolved,
        hardSolved:        leetcodeData.hardSolved,
        ranking:           leetcodeData.ranking,
        contestRating:     leetcodeData.contestRating,
        contestRanking:    leetcodeData.contestRanking,
        contestAttended:   leetcodeData.contestAttended,
        topLanguages:      leetcodeData.topLanguages,
        advancedSkills:    leetcodeData.advancedSkills,
        intermediateSkills: leetcodeData.intermediateSkills,
        fundamentalSkills: leetcodeData.fundamentalSkills,
      };
    }

    // ── Persist enriched GitHub projects ──
    if (githubData) {
      user.projects = githubData.projects;
    }

    // ── Merge skills ──
    const newSkillsFromGitHub   = githubData   ? githubData.topLanguages              : [];
    const newSkillsFromLeetCode = leetcodeData
      ? [
          ...leetcodeData.topLanguages,
          ...leetcodeData.advancedSkills,
          ...leetcodeData.intermediateSkills,
          ...leetcodeData.fundamentalSkills,
        ]
      : [];

    user.skills = mergeSkills(user.skills, [...newSkillsFromGitHub, ...newSkillsFromLeetCode]);

    // ── Build & store platform context block ──
    user.platformContext = buildPlatformContextBlock(
      githubData,
      leetcodeData,
      githubUsername,
      leetcodeUsername
    );

    // ── Set final status ──
    const bothFailed = githubFailed && leetcodeFailed;
    const onlyOneTried = !githubUsername || !leetcodeUsername;
    const singleFailed = onlyOneTried && (githubFailed || leetcodeFailed);

    if (bothFailed || singleFailed) {
      user.platformSyncStatus = 'failed_fetching';
    } else {
      user.platformSyncStatus = 'completed';
    }

    await user.save();

    logger.info(`Platform sync completed for user ${userId}`, {
      status: user.platformSyncStatus,
      skillsCount: user.skills.length,
      projectsCount: user.projects.length,
      contextLength: user.platformContext?.length ?? 0,
    });

  } catch (err) {
    logger.error(`Critical error in fetchAndSyncUserPlatforms for ${userId}`, { err: err.message });
    try {
      await User.findByIdAndUpdate(userId, { platformSyncStatus: 'failed_fetching' });
    } catch (_) { /* ignore secondary db errors */ }
  }
}

module.exports = {
  fetchAndSyncUserPlatforms,
  extractGithubUsername,
  extractLeetCodeUsername,
};
