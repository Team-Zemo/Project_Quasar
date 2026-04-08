/**
 * Application Controller
 * Handles candidate job browsing, applying, and application status tracking.
 */
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const User = require('../models/User');
const { screenResume } = require('../services/resumeScreeningService');
const logger = require('../utils/logger');

/**
 * GET /api/jobs
 * Browse published job postings (candidate view).
 */
async function browseJobs(req, res) {
  try {
    const { search, location, type, page = 1, limit = 20 } = req.query;
    const filter = { status: 'published' };

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }
    if (type && ['full-time', 'part-time', 'contract', 'internship'].includes(type)) {
      filter.employmentType = type;
    }

    let query = JobPosting.find(filter);

    if (search) {
      filter.$text = { $search: search };
      query = JobPosting.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const postings = await query
      .select('title company location employmentType salaryRange parsedJd applicantCount createdAt')
      .skip(skip)
      .limit(Math.min(parseInt(limit), 50))
      .lean();

    const total = await JobPosting.countDocuments(filter);

    return res.json({
      success: true,
      message: 'Jobs retrieved',
      data: { jobs: postings, total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    logger.error('Browse jobs error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to browse jobs', data: null });
  }
}

/**
 * GET /api/jobs/:id
 * View job posting detail (candidate view).
 */
async function getJobDetail(req, res) {
  try {
    const { id } = req.params;
    const candidateId = req.user?.id;

    const posting = await JobPosting.findOne({ _id: id, status: 'published' })
      .select('-recruiterId')
      .lean();

    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    // Check if candidate has already applied
    let application = null;
    if (candidateId) {
      application = await Application.findOne({ candidateId, jobPostingId: id })
        .select('status currentRound appliedAt')
        .lean();
    }

    return res.json({
      success: true,
      message: 'Job detail retrieved',
      data: {
        ...posting,
        hasApplied: !!application,
        application: application || null,
      },
    });
  } catch (err) {
    logger.error('Get job detail error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get job detail', data: null });
  }
}

/**
 * POST /api/jobs/:id/apply
 * Apply to a job posting. Triggers AI resume screening.
 */
async function applyToJob(req, res) {
  try {
    const candidateId = req.user?.id;
    const { id } = req.params;

    // Validate job exists and is published
    const posting = await JobPosting.findOne({ _id: id, status: 'published' }).lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found or closed', data: null });
    }

    // Check if already applied
    const existing = await Application.findOne({ candidateId, jobPostingId: id });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this job',
        data: { applicationId: existing._id, status: existing.status },
      });
    }

    // Fetch candidate profile for resume
    const candidate = await User.findById(candidateId)
      .select('resumeText resumeParsed skills experience profileComplete')
      .lean();

    if (!candidate || !candidate.profileComplete) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your profile before applying',
        data: null,
      });
    }

    if (!candidate.resumeText) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your resume before applying',
        data: null,
      });
    }

    // Create application
    const application = await Application.create({
      candidateId,
      jobPostingId: id,
      status: 'screening',
      currentRound: 'screening',
      appliedAt: new Date(),
      lastActivityAt: new Date(),
    });

    // Increment applicant count
    await JobPosting.findByIdAndUpdate(id, { $inc: { applicantCount: 1 } });

    // Perform AI resume screening (async but we wait for result)
    if (posting.autoScreeningEnabled) {
      try {
        const screeningResult = await screenResume({
          resumeText: candidate.resumeText,
          resumeParsed: candidate.resumeParsed,
          jobDescription: posting.jobDescription,
          parsedJd: posting.parsedJd,
          threshold: posting.screeningThreshold,
        });

        application.screeningResult = screeningResult;

        if (screeningResult.passed) {
          // Determine first actual round
          if (posting.pipeline?.mcqRound?.enabled) {
            application.status = 'mcq_pending';
            application.currentRound = 'mcq';
          } else if (posting.pipeline?.techInterviewRounds?.length > 0) {
            application.status = 'tech_pending';
            application.currentRound = 'tech';
            application.currentTechRoundNumber = 1;
          } else if (posting.pipeline?.hrRound?.enabled) {
            application.status = 'hr_pending';
            application.currentRound = 'hr';
          } else {
            application.status = 'selected';
            application.currentRound = 'completed';
          }
        } else {
          application.status = 'screening_failed';
        }

        application.lastActivityAt = new Date();
        await application.save();
      } catch (screenErr) {
        logger.warn('AI screening failed, advancing candidate anyway', { err: screenErr.message });
        // On screening failure, pass them through to the first round
        if (posting.pipeline?.mcqRound?.enabled) {
          application.status = 'mcq_pending';
          application.currentRound = 'mcq';
        } else if (posting.pipeline?.techInterviewRounds?.length > 0) {
          application.status = 'tech_pending';
          application.currentRound = 'tech';
        } else if (posting.pipeline?.hrRound?.enabled) {
          application.status = 'hr_pending';
          application.currentRound = 'hr';
        }
        await application.save();
      }
    } else {
      // No auto-screening — go straight to first round
      if (posting.pipeline?.mcqRound?.enabled) {
        application.status = 'mcq_pending';
        application.currentRound = 'mcq';
      } else if (posting.pipeline?.techInterviewRounds?.length > 0) {
        application.status = 'tech_pending';
        application.currentRound = 'tech';
        application.currentTechRoundNumber = 1;
      } else if (posting.pipeline?.hrRound?.enabled) {
        application.status = 'hr_pending';
        application.currentRound = 'hr';
      }
      application.status = application.status || 'screening_passed';
      await application.save();
    }

    logger.info('Application submitted', {
      applicationId: application._id,
      candidateId,
      jobId: id,
      status: application.status,
    });

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: application._id,
        status: application.status,
        currentRound: application.currentRound,
        screeningResult: application.screeningResult || null,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this job',
        data: null,
      });
    }
    logger.error('Apply to job error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to apply', data: null });
  }
}

/**
 * GET /api/jobs/:id/my-application
 * Get candidate's own application status for a specific job.
 */
async function getMyApplication(req, res) {
  try {
    const candidateId = req.user?.id;
    const { id } = req.params;

    const application = await Application.findOne({ candidateId, jobPostingId: id })
      .populate('jobPostingId', 'title company pipeline')
      .lean();

    if (!application) {
      return res.status(404).json({ success: false, message: 'No application found', data: null });
    }

    return res.json({
      success: true,
      message: 'Application retrieved',
      data: application,
    });
  } catch (err) {
    logger.error('Get my application error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get application', data: null });
  }
}

/**
 * GET /api/candidate/applications
 * List all applications for the authenticated candidate.
 */
async function listMyApplications(req, res) {
  try {
    const candidateId = req.user?.id;

    const applications = await Application.find({ candidateId })
      .populate('jobPostingId', 'title company location employmentType status pipeline parsedJd jobDescription')
      .sort({ appliedAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Applications retrieved',
      data: applications,
    });
  } catch (err) {
    logger.error('List applications error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to list applications', data: null });
  }
}

module.exports = {
  browseJobs,
  getJobDetail,
  applyToJob,
  getMyApplication,
  listMyApplications,
};
