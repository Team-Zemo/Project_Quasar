const express = require('express');
const { requireAuth } = require('../middleware/auth');

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
router.post('/sessions', requireAuth, sessionController.createSession);
router.post('/sessions/:sessionId/end', requireAuth, sessionController.endSession);
router.post('/sessions/:sessionId/evaluate', requireAuth, evaluationController.evaluateSession);
router.get('/sessions/:sessionId', requireAuth, sessionController.getSession);
router.get('/user/sessions', requireAuth, sessionController.getUserSessions);

// ── Emotion Metrics ───────────────────────────────────────
router.post('/sessions/:sessionId/emotion-metrics', requireAuth, sessionController.saveEmotionMetrics);
router.get('/sessions/:sessionId/emotion-metrics', requireAuth, sessionController.getEmotionMetrics);

// ── Speech Metrics ────────────────────────────────────────
router.post('/sessions/:sessionId/speech-metrics', requireAuth, speechController.saveSpeechMetrics);
router.get('/sessions/:sessionId/speech-metrics', requireAuth, speechController.getSpeechMetrics);

// ── JD Parser ─────────────────────────────────────────────
router.post('/jd/parse', requireAuth, jdController.parseJD);
router.get('/jd/:jdSessionId/questions', requireAuth, jdController.getJDQuestions);

// ── Progress Tracker ──────────────────────────────────────
router.get('/users/:userId/progress', requireAuth, progressController.getProgress);

// ── Skill Vector / Adaptive Difficulty ────────────────────
router.post('/users/:userId/skill-vector/update', requireAuth, skillController.updateSkillVector);
router.get('/users/:userId/skill-vector', requireAuth, skillController.getSkillVector);
router.get('/sessions/:sessionId/next-question', requireAuth, skillController.getNextQuestion);

// ── PDF Report ────────────────────────────────────────────
router.get('/sessions/:sessionId/report', requireAuth, reportController.generateReport);

module.exports = router;
