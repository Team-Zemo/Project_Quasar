/**
 * Candidate Routes
 * Job browsing, application, and pipeline progression endpoints.
 * All require authentication + candidate role.
 */
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const applicationController = require('../controllers/applicationController');
const mcqRoundController = require('../controllers/mcqRoundController');
const pipelineController = require('../controllers/pipelineController');
const proctoringController = require('../controllers/proctoringController');

const router = express.Router();

// All candidate routes require auth + candidate role
router.use(requireAuth, requireRole('candidate'));

// ── Proctoring ────────────────────────────────────────────────────────
router.post('/applications/:appId/proctor/violation', proctoringController.logViolation);
router.post('/applications/:appId/proctor/violations/batch', proctoringController.logViolationsBatch);

// ── Job Browsing ──────────────────────────────────────────────────────
router.get('/jobs', applicationController.browseJobs);
router.get('/jobs/:id', applicationController.getJobDetail);
router.post('/jobs/:id/apply', applicationController.applyToJob);
router.get('/jobs/:id/my-application', applicationController.getMyApplication);

// ── My Applications ───────────────────────────────────────────────────
router.get('/applications', applicationController.listMyApplications);

// ── MCQ Round ─────────────────────────────────────────────────────────
router.post('/applications/:appId/mcq/start', mcqRoundController.startMcqTest);
router.post('/applications/:appId/mcq/submit', mcqRoundController.submitMcqTest);
router.get('/applications/:appId/mcq/result', mcqRoundController.getMcqResult);

// ── Tech Interview Rounds ─────────────────────────────────────────────
router.post('/applications/:appId/tech/:round/start', pipelineController.startTechRound);
router.post('/applications/:appId/tech/:round/complete', pipelineController.completeTechRound);

// ── HR Round ──────────────────────────────────────────────────────────
router.post('/applications/:appId/hr/start', pipelineController.startHrRound);
router.post('/applications/:appId/hr/complete', pipelineController.completeHrRound);

module.exports = router;
