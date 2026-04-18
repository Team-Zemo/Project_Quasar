/**
 * Code Execution Service (Piston Engine)
 * Compiles and runs candidate code against test cases using a self-hosted Piston instance.
 * Piston is cgroup-v2 compatible — ideal for modern Fedora/Ubuntu kernels.
 *
 * Piston API: POST /api/v2/execute
 * Docs: https://github.com/engineer-man/piston
 *
 * Supports: JavaScript, Java, C, C++, Kotlin, Go, Python
 */
const config = require('../config/env');
const logger = require('../utils/logger');

// ── Piston language/version mapping ───────────────────────────────────

const LANGUAGE_MAP = {
  javascript: { language: 'javascript', version: '*' },
  java:       { language: 'java',       version: '*' },
  c:          { language: 'c',          version: '*' },
  cpp:        { language: 'c++',        version: '*' },
  kotlin:     { language: 'kotlin',     version: '*' },
  go:         { language: 'go',         version: '*' },
  python:     { language: 'python',     version: '*' },
};

// Piston needs proper filenames for compiled languages
const FILE_NAMES = {
  javascript: 'solution.js',
  java:       'Main.java',
  c:          'main.c',
  cpp:        'main.cpp',
  kotlin:     'Main.kt',
  go:         'main.go',
  python:     'solution.py',
};

const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_MAP);

/**
 * Get the Piston API base URL.
 * Piston runs on port 2000 internally, mapped to whatever port the user chose.
 */
function getBaseUrl() {
  return config.judge0ApiUrl.replace(/\/+$/, '');
}

/**
 * Resolve the exact language version from the Piston runtimes list.
 * Caches runtimes after first fetch. Falls back to '*' (latest).
 */
let cachedRuntimes = null;
let runtimesFetchedAt = 0;

async function resolveVersion(langKey) {
  const mapping = LANGUAGE_MAP[langKey];
  if (!mapping) throw new Error(`Unsupported language: ${langKey}`);

  // Refresh runtimes cache every 5 minutes
  if (!cachedRuntimes || Date.now() - runtimesFetchedAt > 5 * 60 * 1000) {
    try {
      const res = await fetch(`${getBaseUrl()}/api/v2/runtimes`);
      if (res.ok) {
        cachedRuntimes = await res.json();
        runtimesFetchedAt = Date.now();
      }
    } catch (err) {
      logger.warn('Failed to fetch Piston runtimes, using wildcard version', { error: err.message });
    }
  }

  if (cachedRuntimes && Array.isArray(cachedRuntimes)) {
    const match = cachedRuntimes.find(r => r.language === mapping.language);
    if (match) return { language: match.language, version: match.version };
  }

  return mapping;
}

/**
 * Execute source code with given stdin via Piston API.
 * Piston returns results synchronously — no polling needed.
 *
 * @param {string} sourceCode - The source code to execute
 * @param {string} langKey - Language key (e.g. 'javascript')
 * @param {string} stdin - Input to feed via stdin
 * @param {number} timeLimit - Time limit in seconds (default 5)
 * @param {number} memoryLimit - Memory limit in bytes (default 256MB) — Piston uses bytes
 * @returns {Promise<{stdout, stderr, status, time, memory, compileOutput, exitCode}>}
 */
async function executeCode(sourceCode, langKey, stdin = '', timeLimit = 5) {
  const { language, version } = await resolveVersion(langKey);
  const fileName = FILE_NAMES[langKey] || 'solution.txt';
  const baseUrl = getBaseUrl();

  const payload = {
    language,
    version,
    files: [{ name: fileName, content: sourceCode }],
    stdin: stdin || '',
    run_timeout: Math.min(timeLimit * 1000, 10000), // Piston default max is 10s
    compile_timeout: 10000,
  };

  const startTime = Date.now();

  const res = await fetch(`${baseUrl}/api/v2/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Piston execution failed', { status: res.status, body: errText });
    throw new Error(`Piston execution failed: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  const wallTime = Date.now() - startTime;

  // Piston response has { run: { stdout, stderr, code, signal, output }, compile: { ... } }
  const run = data.run || {};
  const compile = data.compile || {};

  // Determine status
  let statusId, statusDesc;
  if (compile.code != null && compile.code !== 0) {
    statusId = 6;
    statusDesc = 'Compilation Error';
  } else if (run.signal === 'SIGKILL' || run.signal === 'SIGXCPU') {
    statusId = 5;
    statusDesc = 'Time Limit Exceeded';
  } else if (run.signal === 'SIGSEGV') {
    statusId = 7;
    statusDesc = 'Runtime Error (SIGSEGV)';
  } else if (run.signal === 'SIGABRT') {
    statusId = 10;
    statusDesc = 'Runtime Error (SIGABRT)';
  } else if (run.code != null && run.code !== 0) {
    statusId = 11;
    statusDesc = 'Runtime Error (NZEC)';
  } else {
    statusId = 3; // Accepted (ran without error)
    statusDesc = 'Accepted';
  }

  return {
    stdout: run.stdout || run.output || '',
    stderr: run.stderr || '',
    compileOutput: compile.stderr || compile.output || '',
    status: { id: statusId, description: statusDesc },
    time: wallTime / 1000, // seconds
    memory: 0, // Piston doesn't report exact memory usage
    exitCode: run.code,
  };
}

/**
 * Run code against a set of test cases.
 * Piston executes synchronously so we run them concurrently with Promise.all.
 *
 * @param {string} sourceCode - The source code
 * @param {string} langKey - Language key
 * @param {Array<{input: string, expectedOutput: string, timeLimit?: number, memoryLimit?: number}>} testCases
 * @returns {Promise<{results: Array, passedCount: number, totalCount: number}>}
 */
async function executeTestSuite(sourceCode, langKey, testCases) {
  if (!LANGUAGE_MAP[langKey]) {
    throw new Error(`Unsupported language: ${langKey}`);
  }

  // Run all test cases concurrently (Piston handles concurrency well)
  const promises = testCases.map(tc =>
    executeCode(
      sourceCode,
      langKey,
      tc.input || '',
      (tc.timeLimit || 5000) / 1000,
    ).catch(err => ({
      stdout: '',
      stderr: err.message,
      compileOutput: '',
      status: { id: 13, description: 'Internal Error' },
      time: 0,
      memory: 0,
      exitCode: -1,
    }))
  );

  const results = await Promise.all(promises);

  let passedCount = 0;
  const mappedResults = results.map((result, i) => {
    const tc = testCases[i];
    const actualOutput = (result.stdout || '').trim();
    const expectedOutput = (tc.expectedOutput || '').trim();

    // Accepted = status 3 AND output matches expected
    const passed = result.status?.id === 3 && actualOutput === expectedOutput;
    if (passed) passedCount++;

    return {
      passed,
      input: tc.input,
      expected: expectedOutput,
      actual: actualOutput,
      time: result.time * 1000, // Convert back to ms for frontend
      memory: result.memory || 0,
      status: mapStatusDescription(result.status),
    };
  });

  return {
    results: mappedResults,
    passedCount,
    totalCount: testCases.length,
  };
}

/**
 * Map status object to a human-readable description.
 */
function mapStatusDescription(status) {
  if (!status) return 'Unknown';
  const descriptions = {
    3: 'Accepted',
    4: 'Wrong Answer',
    5: 'Time Limit Exceeded',
    6: 'Compilation Error',
    7: 'Runtime Error (SIGSEGV)',
    8: 'Runtime Error (SIGXFSZ)',
    9: 'Runtime Error (SIGFPE)',
    10: 'Runtime Error (SIGABRT)',
    11: 'Runtime Error (NZEC)',
    12: 'Runtime Error (Other)',
    13: 'Internal Error',
  };
  return descriptions[status.id] || status.description || 'Unknown';
}

// Re-export same interface so dsaRoundController needs no changes
const LANGUAGE_IDS = Object.fromEntries(
  Object.keys(LANGUAGE_MAP).map((key, i) => [key, i + 1])
);

module.exports = {
  executeCode,
  executeTestSuite,
  LANGUAGE_IDS,
  SUPPORTED_LANGUAGES,
};
