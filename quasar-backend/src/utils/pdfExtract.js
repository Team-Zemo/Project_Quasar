'use strict';

/**
 * pdfExtract.js
 *
 * Uses pdfjs-dist v3 (Mozilla PDF.js) directly in Node.js — no worker thread,
 * no test-runner side effects, fully compatible with Node 22+.
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Disable the web worker — Node.js runs everything in the main thread
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/**
 * Extract plain text from a PDF Buffer.
 * @param {Buffer} buffer
 * @returns {Promise<string>} extracted and trimmed text
 */
async function extractTextFromPDF(buffer) {
  const data = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,   // no fetch in Node
    isEvalSupported: false,  // safer in server context
    useSystemFonts: true,    // skip font-loading overhead
  });

  const pdf = await loadingTask.promise;

  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => 'str' in item)  // skip MarkedContent markers
      .map((item) => item.str)
      .join(' ');
    pageTexts.push(pageText);
  }

  await pdf.destroy();
  return pageTexts.join('\n').trim();
}

module.exports = { extractTextFromPDF };
