/**
 * LaTeX Resume Service
 * Transforms candidate's parsed resume data into LaTeX templates using NeevCloud.
 * Also handles server-side PDF compilation via pdflatex if available.
 */
const { chatCompletion } = require('./groqService');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

// ─── LaTeX Templates ──────────────────────────────────────────────────────────

const TEMPLATES = {
  classic: {
    id: 'classic',
    name: 'Classic Academic',
    description: 'Traditional academic CV layout, ATS-friendly with clear sections',
    preview: 'classic',
    skeleton: `% CLASSIC ACADEMIC TEMPLATE
\\documentclass[11pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{parskip}

\\geometry{top=2cm, bottom=2cm, left=2.2cm, right=2.2cm}
\\hypersetup{colorlinks=true, urlcolor=blue}
\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\setlength{\\parskip}{4pt}

\\begin{document}

% ── Header ──────────────────────────────────────────
\\begin{center}
  {\\LARGE\\textbf{FULLNAME}}\\\\[4pt]
  \\href{mailto:EMAIL}{EMAIL} \\quad|\\quad PHONE \\quad|\\quad LOCATION\\\\
  \\href{GITHUB}{GitHub} \\quad|\\quad \\href{LINKEDIN}{LinkedIn}
\\end{center}

\\vspace{6pt}

% ── Summary ─────────────────────────────────────────
\\section*{Professional Summary}
SUMMARY

% ── Experience ──────────────────────────────────────
\\section*{Work Experience}
\\textbf{JOB TITLE} \\hfill STARTDATE -- ENDDATE\\\\
\\textit{COMPANY, LOCATION}
\\begin{itemize}[leftmargin=*, noitemsep]
  \\item BULLET POINT
\\end{itemize}

% ── Education ───────────────────────────────────────
\\section*{Education}
\\textbf{DEGREE} \\hfill YEAR\\\\
\\textit{INSTITUTION}

% ── Skills ──────────────────────────────────────────
\\section*{Technical Skills}
\\textbf{Languages:} LANG LIST\\\\
\\textbf{Frameworks:} FRAMEWORK LIST\\\\
\\textbf{Tools:} TOOLS LIST

\\end{document}`,
  },

  modern: {
    id: 'modern',
    name: 'Modern Two-Column',
    description: 'Contemporary two-column layout with sidebar for skills and contact',
    preview: 'modern',
    skeleton: `% MODERN TWO-COLUMN TEMPLATE
\\documentclass[10pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{multicol}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage{array}
\\usepackage{tabularx}

\\definecolor{accent}{RGB}{30, 100, 200}
\\geometry{top=1.5cm, bottom=1.5cm, left=1.5cm, right=1.5cm}
\\hypersetup{colorlinks=true, urlcolor=accent}
\\titleformat{\\section}{\\color{accent}\\large\\bfseries}{}{0em}{}[{\\color{accent}\\hrule}]

\\begin{document}
\\noindent
\\begin{tabularx}{\\textwidth}{Xr}
  {\\fontsize{22}{26}\\selectfont\\textbf{FULLNAME}} &
  \\begin{tabular}[t]{r}
    \\href{mailto:EMAIL}{\\texttt{EMAIL}} \\\\
    PHONE \\\\
    LOCATION \\\\
    \\href{GITHUB}{\\texttt{github.com/USER}}
  \\end{tabular}
\\end{tabularx}

\\vspace{8pt}
{\\color{accent}\\large\\textit{HEADLINE}}
\\vspace{4pt}

\\section*{Experience}
\\textbf{JOB TITLE} --- \\textit{COMPANY} \\hfill DATES\\\\
\\begin{itemize}[noitemsep, leftmargin=*]
  \\item ACHIEVEMENT
\\end{itemize}

\\section*{Education}
\\textbf{DEGREE} \\hfill YEAR\\\\
INSTITUTION

\\section*{Skills}
\\begin{multicols}{3}
\\begin{itemize}[noitemsep, leftmargin=*]
  \\item SKILL
\\end{itemize}
\\end{multicols}

\\section*{Projects}
\\textbf{PROJECT NAME} | \\textit{TECH STACK}\\\\
PROJECT DESCRIPTION

\\end{document}`,
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Ultra-clean minimalist design, maximizes content density',
    preview: 'minimal',
    skeleton: `% MINIMAL CLEAN TEMPLATE
\\documentclass[10pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{lmodern}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{microtype}

\\geometry{top=1.8cm, bottom=1.8cm, left=2cm, right=2cm}
\\hypersetup{hidelinks}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{3pt}

\\newcommand{\\rsection}[1]{%
  \\vspace{8pt}%
  \\textsc{\\textbf{\\large #1}}\\\\[-2pt]%
  \\rule{\\textwidth}{0.4pt}%
  \\vspace{4pt}%
}

\\begin{document}

{\\centering
  {\\Huge\\textbf{FULLNAME}}\\\\[3pt]
  {\\small EMAIL $\\cdot$ PHONE $\\cdot$ LOCATION}\\\\[2pt]
  {\\small \\href{GITHUB}{GitHub} $\\cdot$ \\href{LINKEDIN}{LinkedIn}}\\\\
\\par}

\\rsection{Summary}
SUMMARY

\\rsection{Experience}
\\textbf{JOB TITLE}, \\textit{COMPANY} \\hfill DATES\\\\
\\begin{itemize}[leftmargin=1.4em, itemsep=1pt, topsep=2pt]
  \\item BULLET
\\end{itemize}

\\rsection{Education}
\\textbf{DEGREE}, INSTITUTION \\hfill YEAR

\\rsection{Skills}
SKILLS LIST

\\rsection{Projects}
\\textbf{PROJECT} -- DESCRIPTION \\hfill \\textit{TECH}

\\end{document}`,
  },
};

/**
 * Get all available templates (metadata only, no full skeleton).
 */
function getTemplates() {
  return Object.values(TEMPLATES).map(({ id, name, description, preview }) => ({
    id, name, description, preview,
  }));
}

/**
 * Get a template's skeleton source (empty placeholders).
 */
function getTemplateSkeleton(templateId) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown template: ${templateId}`);
  return tpl.skeleton;
}

/**
 * Transform parsed resume data into a specific LaTeX template using Gemini.
 * @param {object} resumeParsed  — AI-parsed resume JSON from onboarding/profile
 * @param {string} resumeText   — Raw resume plain text (fallback context)
 * @param {string} templateId   — One of: 'classic' | 'modern' | 'minimal'
 * @returns {Promise<string>}   — Complete, compilable LaTeX source string
 */
async function transformResumeToLatex(resumeParsed, resumeText, templateId) {
  const template = TEMPLATES[templateId];
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const systemInstruction = `You are an expert LaTeX resume writer. 
Your task is to generate a complete, compilable LaTeX resume document.

RULES:
1. Use ONLY the template skeleton provided — do NOT change document class or package imports.
2. Replace ALL placeholder tokens (FULLNAME, EMAIL, PHONE, etc.) with real data from the candidate info.
3. Use real, specific bullet points derived from the candidate's work history — don't invent facts.
4. Escape any LaTeX special characters in text: & → \\&, % → \\%, $ → \\$, # → \\#, _ → \\_, { → \\{, } → \\}
5. Return ONLY the raw LaTeX source. Do NOT wrap in markdown fences. Do NOT add any explanation.
6. The output must be 100% valid, compilable LaTeX that will produce a well-formatted PDF.
7. If a field is missing, use sensible placeholder text like "Available upon request" or omit that item.
8. For skills, organize them into logical groups (Languages, Frameworks, Tools, Databases etc).
9. Write compelling, quantified bullet points where data is available.`;

  const userPrompt = `TEMPLATE SKELETON:
${template.skeleton}

CANDIDATE PARSED DATA:
${JSON.stringify(resumeParsed, null, 2)}

CANDIDATE RAW RESUME TEXT (for additional context):
${resumeText ? resumeText.substring(0, 3000) : 'Not available'}

Generate the complete LaTeX resume source using the template skeleton above, populated with the candidate's real data. Return only the LaTeX source code.`;

  try {
    const responseText = await chatCompletion(systemInstruction, userPrompt, {
      model: 'gpt-oss-120b',
      temperature: 0.3,
      maxTokens: 8192,
    });

    let latex = responseText || '';

    // Strip markdown fences if model adds them despite instructions
    latex = latex.replace(/^```(?:latex|tex)?\s*/im, '').replace(/```\s*$/im, '').trim();

    // Sanitize problematic Unicode characters that break pdflatex
    // U+202F narrow no-break space, U+00A0 no-break space, U+200B zero-width space,
    // U+200C/D zero-width (non-)joiner, U+FEFF BOM, U+2009 thin space, U+2002-2006 various spaces
    latex = latex
      .replace(/[\u202F\u00A0]/g, ' ')       // Replace special spaces with regular space
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // Remove zero-width chars
      .replace(/[\u2002-\u2009\u200A]/g, ' '); // Replace Unicode spaces with ASCII space

    if (!latex.includes('\\documentclass') || !latex.includes('\\begin{document}')) {
      throw new Error('Generated output does not appear to be valid LaTeX');
    }

    logger.info('LaTeX resume generated via NeevCloud', { templateId, length: latex.length });
    return latex;
  } catch (err) {
    logger.error('Gemini LaTeX generation failed', { err: err.message });
    throw new Error(`Failed to generate LaTeX resume: ${err.message}`);
  }
}

/**
 * Compile LaTeX source to PDF using pdflatex (if installed).
 * Returns the PDF buffer, or throws if pdflatex is not available.
 * @param {string} latexSource
 * @returns {Promise<Buffer>}
 */
async function compileLatexToPdf(latexSource) {
  // Check if pdflatex is available
  const which = promisify(exec);
  try {
    await which('which pdflatex');
  } catch {
    throw new Error('pdflatex not installed on server. Please install TeX Live or use client-side compilation.');
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'latexresume-'));
  const texFile = path.join(tmpDir, 'resume.tex');
  const pdfFile = path.join(tmpDir, 'resume.pdf');

  try {
    // Sanitize Unicode before writing — pdflatex chokes on these
    const cleanSource = latexSource
      .replace(/[\u202F\u00A0]/g, ' ')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/[\u2002-\u2009\u200A]/g, ' ');

    await fs.writeFile(texFile, cleanSource, 'utf8');

    // Run pdflatex twice (for cross-references)
    const compileArgs = [
      '-interaction=nonstopmode',
      '-output-directory', tmpDir,
      texFile,
    ];

    await execFileAsync('pdflatex', compileArgs, { timeout: 30000 });
    await execFileAsync('pdflatex', compileArgs, { timeout: 30000 }); // Second pass

    const pdfBuffer = await fs.readFile(pdfFile);
    logger.info('LaTeX compiled to PDF successfully', { size: pdfBuffer.length });
    return pdfBuffer;
  } catch (err) {
    // Try to read log for error details
    let logContent = '';
    try {
      logContent = await fs.readFile(path.join(tmpDir, 'resume.log'), 'utf8');
      // Extract last error lines
      const errorLines = logContent.split('\n').filter(l => l.startsWith('!')).slice(0, 5);
      if (errorLines.length) {
        throw new Error(`LaTeX compilation error:\n${errorLines.join('\n')}`);
      }
    } catch (logErr) {
      if (logErr.message.includes('LaTeX compilation error')) throw logErr;
    }
    throw new Error(`LaTeX compilation failed: ${err.message}`);
  } finally {
    // Cleanup temp dir
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Check if pdflatex is available on the server.
 */
async function isPdflatexAvailable() {
  try {
    const execAsync = promisify(exec);
    await execAsync('which pdflatex');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getTemplates,
  getTemplateSkeleton,
  transformResumeToLatex,
  compileLatexToPdf,
  isPdflatexAvailable,
};
