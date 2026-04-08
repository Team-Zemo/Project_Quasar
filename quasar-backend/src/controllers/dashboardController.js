/**
 * Dashboard Controller
 * Recruiter analytics, applicant management, and pipeline insights.
 */
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const User = require('../models/User');
const { sendPipelineNotification } = require('../services/emailService');
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

module.exports = {
  getDashboardStats,
  getApplicants,
  getApplicantDetail,
  shortlistCandidate,
  getRankings,
};
