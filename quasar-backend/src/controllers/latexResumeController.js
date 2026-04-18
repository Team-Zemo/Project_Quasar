/**
 * LaTeX Resume Controller
 * Manages candidate LaTeX resume creation, editing, compiling, and downloading.
 */
const LatexResume = require('../models/LatexResume');
const User = require('../models/User');
const latexResumeService = require('../services/latexResumeService');
const { uploadFile, getPresignedUrl } = require('../services/storageService');
const logger = require('../utils/logger');

/**
 * GET /api/latex-resume/templates
 * Returns list of available LaTeX templates.
 */
async function getTemplates(req, res) {
  try {
    const templates = latexResumeService.getTemplates();
    const pdflatexAvailable = await latexResumeService.isPdflatexAvailable();
    return res.json({
      success: true,
      data: { templates, pdflatexAvailable },
    });
  } catch (err) {
    logger.error('Get templates error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get templates', data: null });
  }
}

/**
 * GET /api/latex-resume/templates/:templateId/skeleton
 * Returns the raw LaTeX skeleton for a template (for direct editing).
 */
async function getTemplateSkeleton(req, res) {
  try {
    const { templateId } = req.params;
    const skeleton = latexResumeService.getTemplateSkeleton(templateId);
    return res.json({ success: true, data: { templateId, skeleton } });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message, data: null });
  }
}

/**
 * POST /api/latex-resume/transform
 * Use Gemini to transform the candidate's resume into a LaTeX template.
 * Body: { templateId: 'classic' | 'modern' | 'minimal' }
 */
async function transformResume(req, res) {
  try {
    const userId = req.user.id;
    const { templateId } = req.body;

    if (!templateId || !['classic', 'modern', 'minimal'].includes(templateId)) {
      return res.status(400).json({ success: false, message: 'Invalid templateId', data: null });
    }

    const user = await User.findById(userId)
      .select('resumeParsed resumeText role name email phone location')
      .lean();

    if (!user || user.role !== 'candidate') {
      return res.status(403).json({ success: false, message: 'Candidates only', data: null });
    }

    if (!user.resumeParsed && !user.resumeText) {
      return res.status(400).json({
        success: false,
        message: 'No resume data found. Please upload your resume first.',
        data: null,
      });
    }

    // Augment parsed data with profile info
    const resumeParsed = {
      ...(user.resumeParsed || {}),
      name: user.resumeParsed?.name || user.name,
      email: user.resumeParsed?.email || user.email,
      phone: user.resumeParsed?.phone || user.phone,
      location: user.resumeParsed?.location || user.location,
    };

    const latexSource = await latexResumeService.transformResumeToLatex(
      resumeParsed,
      user.resumeText,
      templateId,
    );

    return res.json({
      success: true,
      message: 'Resume transformed to LaTeX successfully',
      data: { latexSource, templateId },
    });
  } catch (err) {
    logger.error('Transform resume error', { err: err.message });
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to transform resume',
      data: null,
    });
  }
}

/**
 * GET /api/latex-resume
 * List all LaTeX resumes for the authenticated candidate.
 */
async function listResumes(req, res) {
  try {
    const resumes = await LatexResume.find({ userId: req.user.id })
      .select('-latexSource') // Exclude large source from list
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ success: true, data: { resumes } });
  } catch (err) {
    logger.error('List LaTeX resumes error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to list resumes', data: null });
  }
}

/**
 * POST /api/latex-resume
 * Save a new LaTeX resume.
 * Body: { name, templateId, latexSource }
 */
async function createResume(req, res) {
  try {
    const { name, templateId, latexSource } = req.body;

    if (!latexSource || !templateId) {
      return res.status(400).json({ success: false, message: 'templateId and latexSource are required', data: null });
    }

    if (!['classic', 'modern', 'minimal'].includes(templateId)) {
      return res.status(400).json({ success: false, message: 'Invalid templateId', data: null });
    }

    const count = await LatexResume.countDocuments({ userId: req.user.id });
    if (count >= 10) {
      return res.status(400).json({ success: false, message: 'Maximum 10 saved resumes allowed', data: null });
    }

    const resume = await LatexResume.create({
      userId: req.user.id,
      name: name || `Resume ${count + 1}`,
      templateId,
      latexSource,
      isDefault: count === 0, // First one is default
    });

    logger.info('LaTeX resume created', { resumeId: resume._id, userId: req.user.id });

    return res.status(201).json({
      success: true,
      message: 'Resume saved successfully',
      data: { resume },
    });
  } catch (err) {
    logger.error('Create LaTeX resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to save resume', data: null });
  }
}

/**
 * GET /api/latex-resume/:id
 * Get a specific LaTeX resume (with full source).
 */
async function getResume(req, res) {
  try {
    const resume = await LatexResume.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).lean();

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found', data: null });
    }

    return res.json({ success: true, data: { resume } });
  } catch (err) {
    logger.error('Get LaTeX resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get resume', data: null });
  }
}

/**
 * PUT /api/latex-resume/:id
 * Update a LaTeX resume.
 * Body: { name?, latexSource? }
 */
async function updateResume(req, res) {
  try {
    const { name, latexSource } = req.body;

    const resume = await LatexResume.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found', data: null });
    }

    if (name !== undefined) resume.name = name.trim() || resume.name;
    if (latexSource !== undefined) {
      resume.latexSource = latexSource;
      // Invalidate compiled PDF when source changes
      resume.compiledPdfKey = null;
      resume.compiledAt = null;
    }

    await resume.save();
    logger.info('LaTeX resume updated', { resumeId: resume._id });

    return res.json({ success: true, message: 'Resume updated', data: { resume } });
  } catch (err) {
    logger.error('Update LaTeX resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update resume', data: null });
  }
}

/**
 * DELETE /api/latex-resume/:id
 * Delete a LaTeX resume.
 */
async function deleteResume(req, res) {
  try {
    const resume = await LatexResume.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found', data: null });
    }

    logger.info('LaTeX resume deleted', { resumeId: req.params.id });
    return res.json({ success: true, message: 'Resume deleted', data: null });
  } catch (err) {
    logger.error('Delete LaTeX resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to delete resume', data: null });
  }
}

/**
 * POST /api/latex-resume/:id/compile
 * Compile LaTeX source to PDF server-side using pdflatex.
 * Returns PDF file as download, or stores in MinIO and returns presigned URL.
 */
async function compileResume(req, res) {
  try {
    const resume = await LatexResume.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found', data: null });
    }

    let pdfBuffer;
    try {
      pdfBuffer = await latexResumeService.compileLatexToPdf(resume.latexSource);
    } catch (compileErr) {
      return res.status(422).json({
        success: false,
        message: compileErr.message,
        data: null,
      });
    }

    // Store compiled PDF in MinIO
    const pdfKey = `latex-resumes/${req.user.id}/${resume._id}/resume.pdf`;
    try {
      await uploadFile(pdfKey, pdfBuffer, 'application/pdf');
      resume.compiledPdfKey = pdfKey;
      resume.compiledAt = new Date();
      await resume.save();
    } catch (storageErr) {
      logger.warn('Failed to store compiled PDF in MinIO, returning directly', { err: storageErr.message });
    }

    // Return PDF directly
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${resume.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    logger.error('Compile LaTeX resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to compile resume', data: null });
  }
}

/**
 * POST /api/latex-resume/compile-raw
 * Compile arbitrary LaTeX source (for live preview without saving).
 * Body: { latexSource }
 */
async function compileRaw(req, res) {
  try {
    const { latexSource } = req.body;

    if (!latexSource) {
      return res.status(400).json({ success: false, message: 'latexSource is required', data: null });
    }

    if (latexSource.length > 100000) {
      return res.status(400).json({ success: false, message: 'LaTeX source too large', data: null });
    }

    let pdfBuffer;
    try {
      pdfBuffer = await latexResumeService.compileLatexToPdf(latexSource);
    } catch (compileErr) {
      return res.status(422).json({
        success: false,
        message: compileErr.message,
        data: null,
      });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    logger.error('Compile raw LaTeX error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Compilation failed', data: null });
  }
}

/**
 * GET /api/latex-resume/:id/download
 * Download compiled PDF for a saved resume (regenerates if not compiled).
 */
async function downloadResume(req, res) {
  try {
    const resume = await LatexResume.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found', data: null });
    }

    // If we have a stored compiled PDF, try to redirect
    if (resume.compiledPdfKey) {
      try {
        const url = await getPresignedUrl(resume.compiledPdfKey, 3600);
        return res.json({ success: true, data: { url } });
      } catch { /* fall through to recompile */ }
    }

    // Recompile
    let pdfBuffer;
    try {
      pdfBuffer = await latexResumeService.compileLatexToPdf(resume.latexSource);
    } catch (compileErr) {
      return res.status(422).json({ success: false, message: compileErr.message, data: null });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${resume.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    logger.error('Download LaTeX resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to download resume', data: null });
  }
}

/**
 * PUT /api/latex-resume/:id/default
 * Set a resume as the default (unsets all others).
 */
async function setDefault(req, res) {
  try {
    await LatexResume.updateMany(
      { userId: req.user.id },
      { $set: { isDefault: false } },
    );

    const resume = await LatexResume.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { isDefault: true } },
      { new: true },
    );

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found', data: null });
    }

    return res.json({ success: true, message: 'Default resume updated', data: { resumeId: resume._id } });
  } catch (err) {
    logger.error('Set default resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to set default', data: null });
  }
}

module.exports = {
  getTemplates,
  getTemplateSkeleton,
  transformResume,
  listResumes,
  createResume,
  getResume,
  updateResume,
  deleteResume,
  compileResume,
  compileRaw,
  downloadResume,
  setDefault,
};
