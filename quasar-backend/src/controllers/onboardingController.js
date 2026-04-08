/**
 * Onboarding Controller
 * Handles role selection, profile completion, and resume upload for new users.
 */
const User = require('../models/User');
const { extractTextFromPDF } = require('../utils/pdfExtract');
const { parseResume } = require('../services/resumeScreeningService');
const logger = require('../utils/logger');

/**
 * POST /api/onboarding/role
 * Set user role (one-time). Cannot be changed once set.
 */
async function setRole(req, res) {
  try {
    const userId = req.user?.id;
    const { role } = req.body;

    if (!role || !['candidate', 'recruiter'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role required: "candidate" or "recruiter"',
        data: null,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.role) {
      return res.status(409).json({
        success: false,
        message: 'Role already set. Cannot change role.',
        data: { role: user.role },
      });
    }

    user.role = role;
    await user.save();

    logger.info('User role set', { userId, role });

    return res.json({
      success: true,
      message: `Role set to ${role}`,
      data: { role: user.role, profileComplete: user.profileComplete },
    });
  } catch (err) {
    logger.error('Set role error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to set role', data: null });
  }
}

/**
 * POST /api/onboarding/profile
 * Complete user profile after role selection.
 * For candidates: name, phone, headline, location
 * For recruiters: name, phone, company, location
 */
async function completeProfile(req, res) {
  try {
    const userId = req.user?.id;
    const { name, phone, headline, location, company } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (!user.role) {
      return res.status(400).json({
        success: false,
        message: 'Select a role before completing profile',
        data: null,
      });
    }

    // Validate required fields based on role
    if (user.role === 'recruiter' && !company) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required for recruiters',
        data: null,
      });
    }

    // Update common fields
    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (location) user.location = location.trim();

    // Role-specific fields
    if (user.role === 'candidate') {
      if (headline) user.headline = headline.trim();
    } else if (user.role === 'recruiter') {
      if (company) user.company = company.trim();
    }

    user.profileComplete = true;
    await user.save();

    logger.info('Profile completed', { userId, role: user.role });

    return res.json({
      success: true,
      message: 'Profile completed successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: true,
        phone: user.phone,
        headline: user.headline,
        location: user.location,
        company: user.company,
      },
    });
  } catch (err) {
    logger.error('Complete profile error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to complete profile', data: null });
  }
}

/**
 * POST /api/onboarding/resume
 * Upload and parse resume (PDF). Auto-fills candidate profile with extracted data.
 * Accepts multipart form with field name "resume".
 */
async function uploadResume(req, res) {
  try {
    const userId = req.user?.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.role !== 'candidate') {
      return res.status(403).json({
        success: false,
        message: 'Resume upload is only available for candidates',
        data: null,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Resume file (PDF) is required',
        data: null,
      });
    }

    // Extract text from PDF
    let resumeText;
    try {
      resumeText = await extractTextFromPDF(req.file.buffer);
    } catch (pdfErr) {
      logger.error('Resume PDF extraction failed', { err: pdfErr.message });
      return res.status(422).json({
        success: false,
        message: `Could not extract text from resume PDF: ${pdfErr.message}`,
        data: null,
      });
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Resume contains insufficient text. Please upload a valid resume PDF.',
        data: null,
      });
    }

    // AI parse resume
    let parsedData;
    try {
      parsedData = await parseResume(resumeText);
    } catch (parseErr) {
      logger.warn('AI resume parsing failed, storing raw text only', { err: parseErr.message });
      parsedData = null;
    }

    // Update user with resume data
    user.resumeText = resumeText;
    user.resumeParsed = parsedData;

    // Auto-fill fields from parsed data
    if (parsedData) {
      if (parsedData.skills && Array.isArray(parsedData.skills)) {
        user.skills = parsedData.skills;
      }
      if (parsedData.experience && typeof parsedData.experience === 'number') {
        user.experience = parsedData.experience;
      }
      if (parsedData.headline && !user.headline) {
        user.headline = parsedData.headline;
      }
      if (parsedData.phone && !user.phone) {
        user.phone = parsedData.phone;
      }
    }

    await user.save();

    logger.info('Resume uploaded and parsed', { userId, skillsCount: user.skills.length });

    return res.json({
      success: true,
      message: 'Resume uploaded and parsed successfully',
      data: {
        resumeParsed: parsedData,
        skills: user.skills,
        experience: user.experience,
        headline: user.headline,
      },
    });
  } catch (err) {
    logger.error('Upload resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to upload resume', data: null });
  }
}

module.exports = { setRole, completeProfile, uploadResume };
