const PDFDocument = require('pdfkit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');
const Session = require('../models/Session');
const SpeechMetrics = require('../models/SpeechMetrics');
const Persona = require('../models/Persona');
const User = require('../models/User');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * GET /api/sessions/:sessionId/report
 * Generate and stream a PDF report card
 */
async function generateReport(req, res) {
  try {
    const { sessionId } = req.params;

    // Fetch session data
    const session = await Session.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    // Fetch persona name
    let personaName = null;
    if (session.personaId) {
      const persona = await Persona.findById(session.personaId).lean();
      if (persona) personaName = persona.name;
    }

    // Fetch user name/email
    let userName = 'Anonymous';
    let userEmail = '';
    if (session.userId) {
      const user = await User.findById(session.userId).select('name email').lean();
      if (user) {
        userName = user.name;
        userEmail = user.email;
      }
    }

    // Fetch speech metrics
    const speechMetrics = await SpeechMetrics.findOne({ sessionId }).lean() || {};

    // Generate action plan using Gemini
    let actionPlan = [];
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const starScores = session.starScores || {};
      const prompt = `Based on these interview performance scores, generate exactly 3 concise actionable improvement tips (one sentence each). Return ONLY a JSON array of 3 strings, no markdown.
Scores: Overall: ${session.overallScore || 'N/A'}/10, Situation: ${starScores.situation || 'N/A'}, Task: ${starScores.task || 'N/A'}, Action: ${starScores.action || 'N/A'}, Result: ${starScores.result || 'N/A'}, Clarity: ${session.clarityScore || 'N/A'}, Filler words: ${speechMetrics.totalFillers || 0}`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      }
      actionPlan = JSON.parse(text);
    } catch (aiErr) {
      logger.warn('Failed to generate action plan via Gemini', { err: aiErr.message });
      actionPlan = [
        'Practice structuring answers using the STAR framework.',
        'Reduce filler word usage by pausing instead of using "um" or "like".',
        'Maintain consistent eye contact and project confidence.'
      ];
    }

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="interview-report-${sessionId}.pdf"`);

    doc.pipe(res);

    const starScores = session.starScores || {};
    const emotionMetrics = session.emotionMetrics || [];
    const overallScore = parseFloat(session.overallScore) || 0;
    const durationMin = Math.round((session.durationSeconds || 0) / 60);

    // Colors
    const PRIMARY = '#f97316';
    const DARK = '#1a1a2e';
    const GRAY = '#6b7280';
    const GREEN = '#22c55e';
    const RED = '#ef4444';

    // ═══════════════════════════════════════════════
    // 1. HEADER
    // ═══════════════════════════════════════════════

    doc.rect(0, 0, doc.page.width, 100).fill(DARK);

    doc.fontSize(22).fillColor('#ffffff')
      .text('QUASAR INTERVIEW', 50, 30, { continued: false });

    doc.fontSize(10).fillColor('#9ca3af')
      .text(`Candidate: ${userName}  |  Date: ${new Date(session.startedAt).toLocaleDateString()}  |  Duration: ${durationMin} min  |  Persona: ${personaName || 'Default'}`, 50, 62);

    doc.moveDown(3);

    // ═══════════════════════════════════════════════
    // 2. OVERALL SCORE
    // ═══════════════════════════════════════════════

    const scoreY = 130;
    const passed = overallScore >= 6.5;

    doc.fontSize(14).fillColor(DARK).text('OVERALL SCORE', 50, scoreY);

    doc.fontSize(48).fillColor(passed ? GREEN : RED)
      .text(`${overallScore.toFixed(1)}`, 50, scoreY + 25);

    doc.fontSize(16).fillColor(GRAY)
      .text('/10', 50 + doc.widthOfString(`${overallScore.toFixed(1)}`, { fontSize: 48 }) + 5, scoreY + 50);

    // Verdict badge
    doc.roundedRect(350, scoreY + 25, 120, 40, 8)
      .fill(passed ? GREEN : RED);
    doc.fontSize(16).fillColor('#ffffff')
      .text(passed ? 'PASS' : 'NEEDS WORK', 355, scoreY + 35, { width: 110, align: 'center' });

    doc.moveDown(4);

    // ═══════════════════════════════════════════════
    // 3. STAR BREAKDOWN TABLE
    // ═══════════════════════════════════════════════

    const tableY = scoreY + 100;
    doc.fontSize(14).fillColor(DARK).text('STAR BREAKDOWN', 50, tableY);

    const dimensions = [
      { name: 'Situation', score: starScores.situation || 0 },
      { name: 'Task', score: starScores.task || 0 },
      { name: 'Action', score: starScores.action || 0 },
      { name: 'Result', score: starScores.result || 0 },
      { name: 'Clarity', score: parseFloat(session.clarityScore) || 0 },
      { name: 'Conciseness', score: starScores.conciseness || 0 },
      { name: 'Domain Knowledge', score: starScores.domain_knowledge || 0 },
    ];

    let rowY = tableY + 25;
    const barWidth = 300;
    const barHeight = 16;

    for (const dim of dimensions) {
      doc.fontSize(10).fillColor(GRAY).text(dim.name, 50, rowY + 2, { width: 120 });

      // Background bar
      doc.roundedRect(175, rowY, barWidth, barHeight, 4).fill('#e5e7eb');

      // Filled bar
      const fillWidth = Math.max(0, (dim.score / 10) * barWidth);
      if (fillWidth > 0) {
        doc.roundedRect(175, rowY, fillWidth, barHeight, 4).fill(PRIMARY);
      }

      // Score text
      doc.fontSize(10).fillColor(DARK).text(`${dim.score}/10`, 485, rowY + 2);

      rowY += 28;
    }

    // ═══════════════════════════════════════════════
    // 4. SPEECH ANALYSIS
    // ═══════════════════════════════════════════════

    rowY += 15;
    doc.fontSize(14).fillColor(DARK).text('SPEECH ANALYSIS', 50, rowY);
    rowY += 25;

    const speechData = [
      { label: 'Total Filler Words', value: (speechMetrics.totalFillers || 0).toString() },
      { label: 'Filler Rate', value: durationMin > 0 ? `${((speechMetrics.totalFillers || 0) / durationMin).toFixed(1)}/min` : 'N/A' },
      { label: 'Words Per Minute', value: speechMetrics.wordsPerMinute ? `${parseFloat(speechMetrics.wordsPerMinute).toFixed(0)} WPM` : 'N/A' },
    ];

    // Find top fillers from transcript
    const transcript = speechMetrics.transcript || session.transcript || '';
    const FILLERS = /\b(um+|uh+|like|you know|basically|literally|actually|so+|right\?|okay so|i mean)\b/gi;
    const fillerMatches = transcript.match(FILLERS) || [];
    const fillerCounts = {};
    fillerMatches.forEach(f => {
      const key = f.toLowerCase();
      fillerCounts[key] = (fillerCounts[key] || 0) + 1;
    });
    const topFillers = Object.entries(fillerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word, count]) => `"${word}" (${count}x)`);

    speechData.push({ label: 'Top Fillers', value: topFillers.length > 0 ? topFillers.join(', ') : 'None detected' });

    for (const item of speechData) {
      doc.fontSize(10).fillColor(GRAY).text(item.label, 70, rowY, { width: 140 });
      doc.fontSize(10).fillColor(DARK).text(item.value, 220, rowY);
      rowY += 20;
    }

    // ═══════════════════════════════════════════════
    // 5. CONFIDENCE ANALYSIS
    // ═══════════════════════════════════════════════

    rowY += 15;
    doc.fontSize(14).fillColor(DARK).text('CONFIDENCE ANALYSIS', 50, rowY);
    rowY += 25;

    if (emotionMetrics.length > 0) {
      const confidences = emotionMetrics.map(m => m.confidence || 0);
      const avgConf = Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length);
      const peakIndex = confidences.indexOf(Math.max(...confidences));
      const lowIndex = confidences.indexOf(Math.min(...confidences));

      const confData = [
        { label: 'Average Confidence', value: `${avgConf}%` },
        { label: 'Peak Confidence', value: `${Math.round(confidences[peakIndex])}% at ${emotionMetrics[peakIndex]?.t || peakIndex}s` },
        { label: 'Lowest Confidence', value: `${Math.round(confidences[lowIndex])}% at ${emotionMetrics[lowIndex]?.t || lowIndex}s` },
      ];

      for (const item of confData) {
        doc.fontSize(10).fillColor(GRAY).text(item.label, 70, rowY, { width: 140 });
        doc.fontSize(10).fillColor(DARK).text(item.value, 220, rowY);
        rowY += 20;
      }
    } else {
      doc.fontSize(10).fillColor(GRAY).text('No emotion metrics recorded for this session.', 70, rowY);
      rowY += 20;
    }

    // ═══════════════════════════════════════════════
    // 6. SESSION TRANSCRIPT
    // ═══════════════════════════════════════════════

    doc.addPage();
    doc.fontSize(14).fillColor(DARK).text('SESSION TRANSCRIPT', 50, 50);

    if (transcript) {
      // Mark filler words with [*]
      const markedTranscript = transcript.replace(FILLERS, (match) => `[*]${match}`);

      doc.moveDown(1);
      doc.font('Courier').fontSize(9).fillColor('#374151')
        .text(markedTranscript, 50, doc.y, {
          width: doc.page.width - 100,
          lineGap: 4
        });
      doc.font('Helvetica');
    } else {
      doc.moveDown(1);
      doc.fontSize(10).fillColor(GRAY).text('No transcript available for this session.', 50, doc.y);
    }

    // ═══════════════════════════════════════════════
    // 7. PERSONALISED ACTION PLAN
    // ═══════════════════════════════════════════════

    doc.moveDown(2);
    doc.fontSize(14).fillColor(DARK).text('PERSONALISED ACTION PLAN', 50, doc.y);
    doc.moveDown(0.5);

    for (let i = 0; i < actionPlan.length; i++) {
      doc.fontSize(10).fillColor(PRIMARY).text(`${i + 1}.`, 60, doc.y, { continued: true });
      doc.fillColor('#374151').text(` ${actionPlan[i]}`, { width: doc.page.width - 120 });
      doc.moveDown(0.5);
    }

    // ═══════════════════════════════════════════════
    // 8. FOOTER (on every page)
    // ═══════════════════════════════════════════════

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor(GRAY)
        .text(
          `Generated by Quasar Interview Platform  •  ${new Date().toISOString()}`,
          50,
          doc.page.height - 40,
          { width: doc.page.width - 100, align: 'center' }
        );
    }

    doc.end();
  } catch (err) {
    logger.error('Generate report error', { err: err.message });
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Failed to generate report', data: null });
    }
  }
}

module.exports = { generateReport };
