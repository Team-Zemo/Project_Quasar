/**
 * Dashboard Controller
 * Recruiter analytics, applicant management, and pipeline insights.
 */
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const User = require('../models/User');
const { sendPipelineNotification, sendRecruiterInteractionScheduled } = require('../services/emailService');
const { getPresignedUrl } = require('../services/storageService');
const logger = require('../utils/logger');

/**
 * GET /api/recruiter/dashboard/stats
 * Aggregate statistics across all the recruiter's job postings.
 */
async function getDashboardStats(req, res) {
  try {
    const recruiterId = req.user?.id;

    // Count postings by status
    const postings = await JobPosting.find({ recruiterId }).select('status applicantCount').lean();

    const stats = {
      totalPostings: postings.length,
      activePostings: postings.filter(p => p.status === 'published').length,
      draftPostings: postings.filter(p => p.status === 'draft').length,
      closedPostings: postings.filter(p => p.status === 'closed').length,
      totalApplicants: postings.reduce((sum, p) => sum + (p.applicantCount || 0), 0),
    };

    // Get pipeline funnel across all active postings
    const jobIds = postings.filter(p => p.status === 'published').map(p => p._id);

    if (jobIds.length > 0) {
      const pipeline = await Application.aggregate([
        { $match: { jobPostingId: { $in: jobIds } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      stats.pipelineFunnel = {};
      for (const item of pipeline) {
        stats.pipelineFunnel[item._id] = item.count;
      }
    } else {
      stats.pipelineFunnel = {};
    }

    // Recent applications (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentApplications = await Application.countDocuments({
      jobPostingId: { $in: postings.map(p => p._id) },
      appliedAt: { $gte: weekAgo },
    });
    stats.recentApplications = recentApplications;

    // Selected candidates count
    stats.selectedCandidates = await Application.countDocuments({
      jobPostingId: { $in: postings.map(p => p._id) },
      status: 'selected',
    });

    return res.json({
      success: true,
      message: 'Dashboard stats retrieved',
      data: stats,
    });
  } catch (err) {
    logger.error('Dashboard stats error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get dashboard stats', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id/applicants
 * Ranked list of all applicants for a job posting.
 */
async function getApplicants(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;
    const { status, sortBy = 'totalScore', order = 'desc' } = req.query;

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id title').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const filter = { jobPostingId: id };
    if (status) {
      filter.status = status;
    }

    const sortOptions = {};
    if (sortBy === 'totalScore') {
      sortOptions.totalScore = order === 'asc' ? 1 : -1;
    } else if (sortBy === 'appliedAt') {
      sortOptions.appliedAt = order === 'asc' ? 1 : -1;
    } else if (sortBy === 'rank') {
      sortOptions.rank = order === 'asc' ? 1 : -1;
    } else {
      sortOptions.totalScore = -1;
    }

    const applicants = await Application.find(filter)
      .populate('candidateId', 'name email headline skills experience avatarUrl')
      .sort(sortOptions)
      .lean();

    // Build summary for each applicant
    const enrichedApplicants = applicants.map(app => ({
      _id: app._id,
      candidate: app.candidateId,
      status: app.status,
      currentRound: app.currentRound,
      rank: app.rank,
      totalScore: app.totalScore,
      appliedAt: app.appliedAt,
      lastActivityAt: app.lastActivityAt,
      screeningScore: app.screeningResult?.matchScore || null,
      mcqPercentage: app.mcqResult?.percentage || null,
      dsaPercentage: app.dsaResult?.percentage || null,
      techScores: (app.techResults || []).map(r => ({
        round: r.roundNumber,
        score: r.score,
        passed: r.passed,
      })),
      hrScore: app.hrResult?.score || null,
    }));

    return res.json({
      success: true,
      message: 'Applicants retrieved',
      data: {
        jobTitle: posting.title,
        applicants: enrichedApplicants,
        total: enrichedApplicants.length,
      },
    });
  } catch (err) {
    logger.error('Get applicants error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get applicants', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id/applicants/:appId
 * Detailed view of a specific applicant.
 */
async function getApplicantDetail(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id, appId } = req.params;

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id title pipeline').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const application = await Application.findOne({ _id: appId, jobPostingId: id })
      .populate('candidateId', 'name email headline skills experience avatarUrl phone location resumeParsed')
      .lean();

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Applicant detail retrieved',
      data: {
        application,
        pipelineConfig: posting.pipeline,
      },
    });
  } catch (err) {
    logger.error('Get applicant detail error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get applicant detail', data: null });
  }
}

/**
 * POST /api/recruiter/jobs/:id/applicants/:appId/shortlist
 * Manually shortlist or reject a candidate.
 * Body: { action: 'shortlist' | 'reject' }
 */
async function shortlistCandidate(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id, appId } = req.params;
    const { action } = req.body;

    if (!['shortlist', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be "shortlist" or "reject"',
        data: null,
      });
    }

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const application = await Application.findOne({ _id: appId, jobPostingId: id });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (action === 'shortlist') {
      application.status = 'selected';
      application.currentRound = 'completed';
    } else {
      application.status = 'rejected';
    }

    application.lastActivityAt = new Date();
    await application.save();

    // Fire-and-forget email notification for final selection/rejection
    const outcome = action === 'shortlist' ? 'selected' : 'rejected';
    try {
      const candidate = await User.findById(application.candidateId).select('email name').lean();
      const jobInfo = await JobPosting.findById(id).select('title company').lean();
      if (candidate?.email && jobInfo) {
        sendPipelineNotification(
          candidate.email,
          candidate.name || 'Candidate',
          jobInfo.title,
          jobInfo.company,
          outcome,
        ).catch(err => logger.warn('Pipeline email failed', { err: err.message }));
      }
    } catch (emailErr) {
      logger.warn('Failed to send pipeline notification', { err: emailErr.message });
    }

    logger.info('Candidate shortlist action', { appId, action, recruiterId });

    return res.json({
      success: true,
      message: `Candidate ${action === 'shortlist' ? 'shortlisted' : 'rejected'} successfully`,
      data: { status: application.status },
    });
  } catch (err) {
    logger.error('Shortlist candidate error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update candidate status', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id/rankings
 * Full ranked leaderboard of selected candidates.
 */
async function getRankings(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId })
      .select('_id title pipeline')
      .lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const rankings = await Application.find({
      jobPostingId: id,
      status: 'selected',
    })
      .populate('candidateId', 'name email headline skills experience avatarUrl')
      .sort({ totalScore: -1 })
      .lean();

    // Assign rank based on sort order
    const rankedList = rankings.map((app, index) => ({
      rank: index + 1,
      candidate: app.candidateId,
      totalScore: app.totalScore,
      mcqPercentage: app.mcqResult?.percentage || null,
      dsaPercentage: app.dsaResult?.percentage || null,
      techScores: (app.techResults || []).map(r => ({
        round: r.roundNumber,
        score: r.score,
      })),
      hrScore: app.hrResult?.score || null,
      appliedAt: app.appliedAt,
    }));

    return res.json({
      success: true,
      message: 'Rankings retrieved',
      data: {
        jobTitle: posting.title,
        rankings: rankedList,
        total: rankedList.length,
      },
    });
  } catch (err) {
    logger.error('Get rankings error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get rankings', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id/export
 * Export all applicants for a job posting as CSV.
 */
async function exportApplicantsCSV(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;

    const posting = await JobPosting.findOne({ _id: id, recruiterId }).lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const applications = await Application.find({ jobPostingId: id })
      .populate('candidateId', 'name email phone headline skills experience location')
      .sort({ totalScore: -1 })
      .lean();

    // CSV header
    const headers = [
      'Rank', 'Name', 'Email', 'Phone', 'Location', 'Headline',
      'Skills', 'Experience (Years)', 'Status', 'Applied At',
      'Screening Score (%)', 'Screening Passed', 'Matched Skills', 'Missing Skills', 'Screening Summary',
      'MCQ Score (%)', 'MCQ Correct', 'MCQ Total', 'MCQ Passed',
      'DSA Score (%)', 'DSA Passed Tests', 'DSA Total Tests', 'DSA Passed',
    ];

    // Add dynamic tech round columns
    const maxTechRounds = Math.max(...applications.map(a => (a.techResults || []).length), 0);
    for (let i = 1; i <= maxTechRounds; i++) {
      headers.push(`Tech Round ${i} Score`, `Tech Round ${i} Passed`);
    }

    headers.push('HR Score', 'HR Passed', 'Total Score');

    // Escape CSV value
    const esc = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    };

    const rows = [headers.join(',')];

    applications.forEach((app, index) => {
      const c = app.candidateId || {};
      const sr = app.screeningResult || {};
      const mcq = app.mcqResult || {};

      const row = [
        app.rank || index + 1,
        esc(c.name),
        esc(c.email),
        esc(c.phone),
        esc(c.location),
        esc(c.headline),
        esc((c.skills || []).join('; ')),
        c.experience ?? '',
        app.status,
        app.appliedAt ? new Date(app.appliedAt).toISOString().split('T')[0] : '',
        sr.matchScore ?? '',
        sr.passed != null ? (sr.passed ? 'Yes' : 'No') : '',
        esc((sr.matchedSkills || []).join('; ')),
        esc((sr.missingSkills || []).join('; ')),
        esc(sr.summary),
        mcq.percentage ?? '',
        mcq.correctAnswers ?? '',
        mcq.totalQuestions ?? '',
        mcq.passed != null ? (mcq.passed ? 'Yes' : 'No') : '',
      ];

      // DSA columns
      const dsa = app.dsaResult || {};
      row.push(dsa.percentage ?? '');
      const dsaPassed = (dsa.questions || []).reduce((s, q) => s + (q.passedCount || 0), 0);
      const dsaTotal = (dsa.questions || []).reduce((s, q) => s + (q.totalCount || 0), 0);
      row.push(dsaPassed || '');
      row.push(dsaTotal || '');
      row.push(dsa.passed != null ? (dsa.passed ? 'Yes' : 'No') : '');

      // Tech rounds
      for (let i = 0; i < maxTechRounds; i++) {
        const tr = (app.techResults || [])[i];
        row.push(tr?.score != null ? tr.score.toFixed(1) : '');
        row.push(tr?.passed != null ? (tr.passed ? 'Yes' : 'No') : '');
      }

      const hr = app.hrResult || {};
      row.push(hr.score != null ? hr.score.toFixed(1) : '');
      row.push(hr.passed != null ? (hr.passed ? 'Yes' : 'No') : '');
      row.push(app.totalScore ? app.totalScore.toFixed(2) : '0');

      rows.push(row.join(','));
    });

    const csv = rows.join('\n');
    const filename = `${posting.title.replace(/[^a-zA-Z0-9]/g, '_')}_applicants_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    logger.error('Export applicants CSV error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to export applicants', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id/applicants/:appId/resume
 * Serve a candidate's resume to the recruiter via presigned MinIO URL.
 */
async function getApplicantResume(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id, appId } = req.params;

    // Verify job ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    // Find the application and get candidate
    const application = await Application.findOne({ _id: appId, jobPostingId: id })
      .select('candidateId')
      .lean();
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    const candidate = await User.findById(application.candidateId)
      .select('resumeKey resumeFilename name')
      .lean();

    if (!candidate || !candidate.resumeKey) {
      return res.status(404).json({ success: false, message: 'Candidate has no resume uploaded', data: null });
    }

    const url = await getPresignedUrl(candidate.resumeKey, 3600);

    return res.json({
      success: true,
      message: 'Resume URL retrieved',
      data: {
        url,
        filename: candidate.resumeFilename || 'resume.pdf',
        candidateName: candidate.name,
      },
    });
  } catch (err) {
    logger.error('Get applicant resume error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get resume', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id/applicants/:appId/profile
 * Get full profile of a candidate (including platform stats like LeetCode/GitHub)
 */
async function getApplicantProfile(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id, appId } = req.params;

    // Verify ownership of the job
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const application = await Application.findOne({ _id: appId, jobPostingId: id }).select('candidateId').lean();
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    const user = await User.findById(application.candidateId)
      .select('-passwordHash -passwordResetToken -passwordResetExpires -__v')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate not found', data: null });
    }

    // Generate presigned resume URL if they have one
    let resumeUrl = null;
    if (user.resumeKey) {
      try {
        resumeUrl = await getPresignedUrl(user.resumeKey, 3600);
      } catch {
        logger.warn('Failed to generate resume presigned URL for applicant profile', { userId: user._id });
      }
    }

    return res.json({
      success: true,
      message: 'Candidate profile retrieved',
      data: {
        ...user,
        _id: user._id,
        resumeUrl,
      },
    });
  } catch (err) {
    logger.error('Get applicant profile error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get applicant profile', data: null });
  }
}

/**
 * POST /api/recruiter/jobs/:id/applicants/:appId/schedule-interaction
 * Recruiter provides a meeting link + scheduled datetime.
 * Sends an email to the candidate and moves status to ri_scheduled.
 * Body: { meetLink, scheduledAt }
 */
async function scheduleRecruiterInteraction(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id, appId } = req.params;
    const { meetLink, scheduledAt } = req.body;

    if (!meetLink || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'meetLink and scheduledAt are required', data: null });
    }

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('title company').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const application = await Application.findOne({ _id: appId, jobPostingId: id });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'ri_pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot schedule interaction. Current status: ${application.status}`,
        data: null,
      });
    }

    application.status = 'ri_scheduled';
    application.recruiterInteractionResult = {
      meetLink: meetLink.trim(),
      scheduledAt: new Date(scheduledAt),
      passed: null,
      notes: '',
      completedAt: null,
    };
    application.lastActivityAt = new Date();
    await application.save();

    // Send email to candidate
    try {
      const candidate = await User.findById(application.candidateId).select('email name').lean();
      if (candidate?.email) {
        sendRecruiterInteractionScheduled(
          candidate.email,
          candidate.name || 'Candidate',
          posting.title,
          posting.company,
          meetLink.trim(),
          new Date(scheduledAt),
        ).catch(err => logger.warn('RI schedule email failed', { err: err.message }));
      }
    } catch (emailErr) {
      logger.warn('Failed to send RI scheduled email', { err: emailErr.message });
    }

    logger.info('Recruiter interaction scheduled', { appId, recruiterId, meetLink, scheduledAt });

    return res.json({
      success: true,
      message: 'Meeting scheduled. Candidate has been notified via email.',
      data: { status: application.status, recruiterInteractionResult: application.recruiterInteractionResult },
    });
  } catch (err) {
    logger.error('Schedule recruiter interaction error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to schedule interaction', data: null });
  }
}

/**
 * POST /api/recruiter/jobs/:id/applicants/:appId/complete-interaction
 * Recruiter passes or fails candidate after the meeting.
 * Body: { passed: boolean, notes?: string }
 */
async function completeRecruiterInteraction(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id, appId } = req.params;
    const { passed, notes } = req.body;

    if (typeof passed !== 'boolean') {
      return res.status(400).json({ success: false, message: '`passed` (boolean) is required', data: null });
    }

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('title company').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const application = await Application.findOne({ _id: appId, jobPostingId: id });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'ri_scheduled') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete interaction. Current status: ${application.status}`,
        data: null,
      });
    }

    application.recruiterInteractionResult.passed = passed;
    application.recruiterInteractionResult.notes = notes || '';
    application.recruiterInteractionResult.completedAt = new Date();

    if (passed) {
      application.status = 'selected';
      application.currentRound = 'completed';
      // Recalculate total score
      const { recalculateRankings } = require('./pipelineController');
      const fullPosting = await JobPosting.findById(id).lean();
      application.totalScore = calculateTotalScoreForRI(application, fullPosting);
      application.lastActivityAt = new Date();
      await application.save();
      await recalculateRankings(id);
    } else {
      application.status = 'ri_failed';
      application.lastActivityAt = new Date();
      await application.save();
    }

    // Send pipeline notification email
    const outcome = passed ? 'selected' : 'rejected';
    try {
      const candidate = await User.findById(application.candidateId).select('email name').lean();
      if (candidate?.email) {
        sendPipelineNotification(
          candidate.email,
          candidate.name || 'Candidate',
          posting.title,
          posting.company,
          outcome,
        ).catch(err => logger.warn('Pipeline email failed', { err: err.message }));
      }
    } catch (emailErr) {
      logger.warn('Failed to send pipeline notification', { err: emailErr.message });
    }

    logger.info('Recruiter interaction completed', { appId, recruiterId, passed });

    return res.json({
      success: true,
      message: passed ? 'Candidate selected!' : 'Candidate rejected.',
      data: { status: application.status },
    });
  } catch (err) {
    logger.error('Complete recruiter interaction error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to complete interaction', data: null });
  }
}

/**
 * Calculate total score (duplicated helper to avoid circular dependency).
 */
function calculateTotalScoreForRI(application, posting) {
  let total = 0;
  let components = 0;
  if (application.mcqResult?.percentage != null) { total += (application.mcqResult.percentage / 100) * 10; components++; }
  if (application.dsaResult?.percentage != null && application.dsaResult.completedAt) { total += (application.dsaResult.percentage / 100) * 10; components++; }
  if (application.techResults?.length > 0) {
    const scores = application.techResults.filter(r => r.score != null).map(r => r.score);
    if (scores.length > 0) { total += scores.reduce((a, b) => a + b, 0) / scores.length; components++; }
  }
  if (application.hrResult?.score != null) { total += application.hrResult.score; components++; }
  return components > 0 ? parseFloat((total / components).toFixed(2)) : 0;
}

module.exports = {
  getDashboardStats,
  getApplicants,
  getApplicantDetail,
  shortlistCandidate,
  getRankings,
  exportApplicantsCSV,
  getApplicantResume,
  getApplicantProfile,
  scheduleRecruiterInteraction,
  completeRecruiterInteraction,
};
