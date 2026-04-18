/**
 * Recruiter Routes
 * All endpoints require authentication + recruiter role.
 */
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const jobPostingController = require('../controllers/jobPostingController');
const dashboardController = require('../controllers/dashboardController');
const proctoringController = require('../controllers/proctoringController');

const router = express.Router();

// All recruiter routes require auth + recruiter role
router.use(requireAuth, requireRole('recruiter'));

// ── Dashboard ─────────────────────────────────────────────────────────
router.get('/dashboard/stats', dashboardController.getDashboardStats);

// ── Job Posting CRUD ──────────────────────────────────────────────────
router.post('/jobs', jobPostingController.createJobPosting);
router.get('/jobs', jobPostingController.listJobPostings);
router.get('/jobs/:id', jobPostingController.getJobPosting);
router.put('/jobs/:id', jobPostingController.updateJobPosting);
router.post('/jobs/:id/publish', jobPostingController.publishJobPosting);
router.post('/jobs/:id/close', jobPostingController.closeJobPosting);

// ── MCQ Management ────────────────────────────────────────────────────
router.post('/jobs/:id/mcqs', jobPostingController.addMcq);
router.get('/jobs/:id/mcqs', jobPostingController.listMcqs);
router.put('/jobs/:id/mcqs/:mcqId', jobPostingController.updateMcq);
router.delete('/jobs/:id/mcqs/:mcqId', jobPostingController.deleteMcq);
router.post('/jobs/:id/mcqs/generate', jobPostingController.generateMcqs);

// ── DSA Question Management ───────────────────────────────────────────
router.post('/jobs/:id/dsa-questions', jobPostingController.addDsaQuestion);
router.get('/jobs/:id/dsa-questions', jobPostingController.listDsaQuestions);
router.put('/jobs/:id/dsa-questions/:qId', jobPostingController.updateDsaQuestion);
router.delete('/jobs/:id/dsa-questions/:qId', jobPostingController.deleteDsaQuestion);

// ── Applicant Management ──────────────────────────────────────────────
router.get('/jobs/:id/applicants', dashboardController.getApplicants);
router.get('/jobs/:id/applicants/:appId', dashboardController.getApplicantDetail);
router.get('/jobs/:id/applicants/:appId/profile', dashboardController.getApplicantProfile);
router.post('/jobs/:id/applicants/:appId/shortlist', dashboardController.shortlistCandidate);
router.get('/jobs/:id/applicants/:appId/resume', dashboardController.getApplicantResume);
router.get('/jobs/:id/rankings', dashboardController.getRankings);
router.get('/jobs/:id/export', dashboardController.exportApplicantsCSV);

// ── Proctoring Reports ────────────────────────────────────────────────
router.get('/jobs/:id/applicants/:appId/proctor', proctoringController.getProctoringReport);

module.exports = router;
