const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const sessionController = require('../controllers/sessionController');
const speechController = require('../controllers/speechController');
const personaController = require('../controllers/personaController');
const jdController = require('../controllers/jdController');
const progressController = require('../controllers/progressController');
const skillController = require('../controllers/skillController');
const reportController = require('../controllers/reportController');
const evaluationController = require('../controllers/evaluationController');

const router = express.Router();

// ── Personas ──────────────────────────────────────────────
router.get('/personas', personaController.getPersonas);
router.get('/personas/:id', personaController.getPersona);

// ── Sessions ──────────────────────────────────────────────
router.post('/sessions', optionalAuth, sessionController.createSession);
router.post('/sessions/:sessionId/end', optionalAuth, sessionController.endSession);
router.post('/sessions/:sessionId/evaluate', optionalAuth, evaluationController.evaluateSession);
router.get('/sessions/:sessionId', optionalAuth, sessionController.getSession);
router.get('/user/sessions', requireAuth, sessionController.getUserSessions);

// ── Emotion Metrics ───────────────────────────────────────
router.post('/sessions/:sessionId/emotion-metrics', optionalAuth, sessionController.saveEmotionMetrics);
router.get('/sessions/:sessionId/emotion-metrics', optionalAuth, sessionController.getEmotionMetrics);

// ── Speech Metrics ────────────────────────────────────────
router.post('/sessions/:sessionId/speech-metrics', optionalAuth, speechController.saveSpeechMetrics);
router.get('/sessions/:sessionId/speech-metrics', optionalAuth, speechController.getSpeechMetrics);

// ── JD Parser ─────────────────────────────────────────────
router.post('/jd/parse', requireAuth, jdController.parseJD);
router.get('/jd/:jdSessionId/questions', optionalAuth, jdController.getJDQuestions);

// ── Progress Tracker ──────────────────────────────────────
router.get('/users/:userId/progress', requireAuth, progressController.getProgress);

// ── Skill Vector / Adaptive Difficulty ────────────────────
router.post('/users/:userId/skill-vector/update', requireAuth, skillController.updateSkillVector);
router.get('/users/:userId/skill-vector', requireAuth, skillController.getSkillVector);
router.get('/sessions/:sessionId/next-question', optionalAuth, skillController.getNextQuestion);

// ── PDF Report ────────────────────────────────────────────
router.get('/sessions/:sessionId/report', optionalAuth, reportController.generateReport);

module.exports = router;
