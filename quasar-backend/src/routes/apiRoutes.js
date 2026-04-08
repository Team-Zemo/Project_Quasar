const express = require('express');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const sessionController      = require('../controllers/sessionController');
const speechController       = require('../controllers/speechController');
const personaController      = require('../controllers/personaController');
const jdController           = require('../controllers/jdController');
const progressController     = require('../controllers/progressController');
const skillController        = require('../controllers/skillController');
const reportController       = require('../controllers/reportController');
const evaluationController   = require('../controllers/evaluationController');
const resumeCompareController = require('../controllers/resumeCompareController');
const gamificationController = require('../controllers/gamificationController');
const coachController        = require('../controllers/coachController');
const studyPlanController    = require('../controllers/studyPlanController');
const onboardingController   = require('../controllers/onboardingController');

// New route modules
const recruiterRoutes = require('./recruiterRoutes');
const candidateRoutes = require('./candidateRoutes');

const router = express.Router();

// ── Onboarding (auth required, no role/profile gate) ──────────
router.post('/onboarding/role',    requireAuth, onboardingController.setRole);
router.post('/onboarding/profile', requireAuth, onboardingController.completeProfile);
router.post('/onboarding/resume',  requireAuth, upload.single('resume'), onboardingController.uploadResume);

// ── Recruiter Portal ──────────────────────────────────────────
router.use('/recruiter', recruiterRoutes);

// ── Candidate Portal ──────────────────────────────────────────
router.use('/candidate', candidateRoutes);

// ── Personas ──────────────────────────────────────────────────
router.get('/personas',     personaController.getPersonas);
router.get('/personas/:id', personaController.getPersona);

// ── Sessions ──────────────────────────────────────────────────
router.post('/sessions',                     requireAuth, sessionController.createSession);
router.post('/sessions/:sessionId/end',      requireAuth, sessionController.endSession);
router.post('/sessions/:sessionId/evaluate', requireAuth, evaluationController.evaluateSession);
router.get('/sessions/:sessionId',           requireAuth, sessionController.getSession);
router.get('/user/sessions',                 requireAuth, sessionController.getUserSessions);

// ── Emotion Metrics ───────────────────────────────────────────
router.post('/sessions/:sessionId/emotion-metrics', requireAuth, sessionController.saveEmotionMetrics);
router.get('/sessions/:sessionId/emotion-metrics',  requireAuth, sessionController.getEmotionMetrics);

// ── Speech Metrics ────────────────────────────────────────────
router.post('/sessions/:sessionId/speech-metrics', requireAuth, speechController.saveSpeechMetrics);
router.get('/sessions/:sessionId/speech-metrics',  requireAuth, speechController.getSpeechMetrics);

// ── JD Parser ─────────────────────────────────────────────────
// Accepts multipart (PDF upload) OR JSON body (plain text)
router.post('/jd/parse',                    requireAuth, upload.single('jd'), jdController.parseJD);
router.get('/jd/:jdSessionId/questions',    requireAuth, jdController.getJDQuestions);

// ── Resume vs JD Comparison ───────────────────────────────────
router.post(
  '/resume/compare',
  requireAuth,
  upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'jd', maxCount: 1 }]),
  resumeCompareController.compareResumeToJD
);

// ── Progress Tracker ──────────────────────────────────────────
router.get('/users/:userId/progress', requireAuth, progressController.getProgress);

// ── Gamification ─────────────────────────────────────────────
router.get('/users/:userId/stats',   requireAuth, gamificationController.getUserStats);
router.get('/users/:userId/badges',  requireAuth, gamificationController.getUserBadges);

// ── Skill Vector / Adaptive Difficulty ────────────────────────
router.post('/users/:userId/skill-vector/update', requireAuth, skillController.updateSkillVector);
router.get('/users/:userId/skill-vector',         requireAuth, skillController.getSkillVector);
router.get('/sessions/:sessionId/next-question',  requireAuth, skillController.getNextQuestion);

// ── AI Career Coach (streaming) ───────────────────────────────
router.post('/coach/chat', requireAuth, coachController.chat);

// ── Study Plan Generator (streaming) ─────────────────────────
router.post('/study-plan/generate', requireAuth, studyPlanController.generatePlan);

// ── PDF Report ────────────────────────────────────────────────
router.get('/sessions/:sessionId/report', requireAuth, reportController.generateReport);

module.exports = router;
