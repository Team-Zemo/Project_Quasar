/**
 * Profile Controller
 * Handles profile viewing, editing, resume upload/download for both roles.
 */
const User = require('../models/User');
const { extractTextFromPDF } = require('../utils/pdfExtract');
const { parseResume } = require('../services/resumeScreeningService');
const { uploadFile, getPresignedUrl, deleteFile, fileExists } = require('../services/storageService');
const logger = require('../utils/logger');

/**
 * GET /api/profile
 * Return full profile for the authenticated user.
 */
async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select('-passwordHash -passwordResetToken -passwordResetExpires -__v')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    // Generate presigned resume URL if they have one
    let resumeUrl = null;
    if (user.resumeKey) {
      try {
        resumeUrl = await getPresignedUrl(user.resumeKey, 3600);
      } catch {
        logger.warn('Failed to generate resume presigned URL', { userId: user._id });
      }
    }

    return res.json({
      success: true,
      message: 'Profile retrieved',
      data: {
        ...user,
        _id: user._id,
        resumeUrl,
      },
    });
  } catch (err) {
    logger.error('Get profile error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get profile', data: null });
  }
}

/**
 * PUT /api/profile
 * Update profile fields. Different fields are allowed based on role.
 */
async function updateProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    const { name, phone, headline, location, skills, experience, company, designation, companyWebsite } = req.body;

    // Common fields
    if (name !== undefined && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.phone = phone ? phone.trim() : null;
    if (location !== undefined) user.location = location ? location.trim() : null;

    // Candidate-specific
    if (user.role === 'candidate') {
      if (headline !== undefined) user.headline = headline ? headline.trim() : null;
      if (skills !== undefined && Array.isArray(skills)) {
        user.skills = skills.map(s => String(s).trim()).filter(Boolean);
      }
      if (experience !== undefined) {
        user.experience = experience !== null ? Number(experience) : null;
      }
    }

    // Recruiter-specific
    if (user.role === 'recruiter') {
      if (company !== undefined && company.trim()) user.company = company.trim();
      if (designation !== undefined) user.designation = designation ? designation.trim() : null;
      if (companyWebsite !== undefined) user.companyWebsite = companyWebsite ? companyWebsite.trim() : null;
    }

    await user.save();
    logger.info('Profile updated', { userId: user._id, role: user.role });

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        headline: user.headline,
        location: user.location,
        skills: user.skills,
        experience: user.experience,
        company: user.company,
        designation: user.designation,
        companyWebsite: user.companyWebsite,
        avatarUrl: user.avatarUrl,
        resumeKey: user.resumeKey,
        resumeFilename: user.resumeFilename,
        resumeUploadedAt: user.resumeUploadedAt,
      },
    });
  } catch (err) {
    logger.error('Update profile error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update profile', data: null });
  }
}

/**
 * POST /api/profile/resume
 * Upload or replace resume PDF. Stores in MinIO, parses with AI.
 */
async function uploadResume(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.role !== 'candidate') {
      return res.status(403).json({ success: false, message: 'Resume upload is for candidates only', data: null });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resume file (PDF) is required', data: null });
    }

    // Extract text from PDF
    let resumeText;
    try {
      resumeText = await extractTextFromPDF(req.file.buffer);
    } catch (pdfErr) {
      logger.error('Resume PDF extraction failed', { err: pdfErr.message });
      return res.status(422).json({
        success: false,
        message: `Could not extract text from resume: ${pdfErr.message}`,
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

    // Delete old resume from MinIO if exists
    if (user.resumeKey) {
      await deleteFile(user.resumeKey);
    }

    // Upload new resume to MinIO
    const timestamp = Date.now();
    const sanitizedName = (req.file.originalname || 'resume.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `resumes/${user._id}_${timestamp}_${sanitizedName}`;

    await uploadFile(objectKey, req.file.buffer, 'application/pdf', {
      'X-User-Id': String(user._id),
      'X-Original-Name': sanitizedName,
    });

    // AI parse resume
    let parsedData = null;
    try {
      parsedData = await parseResume(resumeText);
    } catch (parseErr) {
      logger.warn('AI resume parsing failed, storing raw text only', { err: parseErr.message });
    }

    // Update user
    user.resumeKey = objectKey;
    user.resumeFilename = req.file.originalname || 'resume.pdf';
    user.resumeUploadedAt = new Date();
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

    // Generate presigned URL for immediate access
    let resumeUrl = null;
    try {
      resumeUrl = await getPresignedUrl(objectKey, 3600);
    } catch { /* non-critical */ }

    logger.info('Resume uploaded via profile', { userId: user._id, objectKey });

    return res.json({
      success: true,
      message: 'Resume uploaded and parsed successfully',
      data: {
        resumeKey: objectKey,
        resumeFilename: user.resumeFilename,
        resumeUploadedAt: user.resumeUploadedAt,
        resumeUrl,
        resumeParsed: parsedData,
        skills: user.skills,
        experience: user.experience,
        headline: user.headline,
      },
    });
  } catch (err) {
    logger.error('Profile resume upload error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to upload resume', data: null });
  }
}

/**
 * GET /api/profile/resume
 * Download own resume — redirects to a presigned MinIO URL.
 */
async function downloadResume(req, res) {
  try {
    const user = await User.findById(req.user.id).select('resumeKey resumeFilename').lean();
    if (!user || !user.resumeKey) {
      return res.status(404).json({ success: false, message: 'No resume uploaded', data: null });
    }

    const exists = await fileExists(user.resumeKey);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Resume file not found in storage', data: null });
    }

    const url = await getPresignedUrl(user.resumeKey, 3600);
    return res.json({ success: true, data: { url, filename: user.resumeFilename } });
  } catch (err) {
    logger.error('Download resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get resume', data: null });
  }
}

/**
 * DELETE /api/profile/resume
 * Remove resume from MinIO and clear user fields.
 */
async function deleteResume(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.resumeKey) {
      return res.status(404).json({ success: false, message: 'No resume to delete', data: null });
    }

    await deleteFile(user.resumeKey);

    user.resumeKey = null;
    user.resumeFilename = null;
    user.resumeUploadedAt = null;
    user.resumeText = null;
    user.resumeParsed = null;
    user.resumeUrl = null;
    await user.save();

    logger.info('Resume deleted', { userId: user._id });

    return res.json({ success: true, message: 'Resume deleted successfully', data: null });
  } catch (err) {
    logger.error('Delete resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to delete resume', data: null });
  }
}

module.exports = { getProfile, updateProfile, uploadResume, downloadResume, deleteResume };
