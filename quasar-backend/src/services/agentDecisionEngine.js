/**
 * Agent Decision Engine
 * Pure decision-logic module. No side effects — evaluates an application's
 * current state against the agent config and returns a decision object.
 *
 * The agentService.js orchestrator calls this, then executes the decision.
 */
const logger = require('../utils/logger');

// ── Decision action constants ─────────────────────────────────────────

const ACTIONS = {
  ADVANCE: 'advance',
  REJECT: 'reject',
  ESCALATE: 'escalate',
  HOLD: 'hold',
  NOOP: 'noop',
};

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Compute the effective threshold for a round by checking the agent config
 * first, then falling back to the job posting pipeline config.
 */
function getEffectiveScreeningThreshold(agentConfig, posting) {
  if (agentConfig.screeningThreshold != null) return agentConfig.screeningThreshold;
  return posting.screeningThreshold || 50;
}

function getEffectiveMcqThreshold(agentConfig, posting) {
  if (agentConfig.mcqThreshold != null) return agentConfig.mcqThreshold;
  return posting.pipeline?.mcqRound?.passingScore || 60;
}

function getEffectiveTechThreshold(agentConfig, posting) {
  if (agentConfig.techThreshold != null) return agentConfig.techThreshold;
  const techRounds = posting.pipeline?.techInterviewRounds || [];
  // Use the average passing score across tech rounds, or default 6.0
  if (techRounds.length > 0) {
    const avg = techRounds.reduce((sum, r) => sum + (r.passingScore || 6.0), 0) / techRounds.length;
    return avg;
  }
  return 6.0;
}

function getEffectiveHrThreshold(agentConfig, posting) {
  if (agentConfig.hrThreshold != null) return agentConfig.hrThreshold;
  return posting.pipeline?.hrRound?.passingScore || 6.0;
}

/**
 * Compute the escalation margin for a given threshold.
 * Returns the absolute score margin below which we escalate.
 * e.g. threshold=70, marginPercent=5 → margin=3.5 → escalate at 66.5-70
 */
function computeEscalationMargin(threshold, marginPercent) {
  return (threshold * marginPercent) / 100;
}

/**
 * Check whether a score falls in the "borderline" escalation band.
 * Borderline = score is below threshold but within the escalation margin.
 */
function isBorderlineScore(score, threshold, marginPercent) {
  const margin = computeEscalationMargin(threshold, marginPercent);
  const lowerBound = threshold - margin;
  return score >= lowerBound && score < threshold;
}

/**
 * Calculate STAR score variance to detect low AI confidence.
 * High variance across STAR dimensions suggests the AI was uncertain.
 */
function computeStarVariance(starScores) {
  if (!starScores) return 0;

  const values = [
    starScores.situation,
    starScores.task,
    starScores.action,
    starScores.result,
    starScores.conciseness,
    starScores.domain_knowledge,
  ].filter(v => v != null && typeof v === 'number');

  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance); // standard deviation
}

/**
 * Determine the next round status when advancing from the current round.
 */
function getNextRoundStatus(currentRound, posting, application) {
  switch (currentRound) {
    case 'screening': {
      if (posting.pipeline?.mcqRound?.enabled) {
        return { status: 'mcq_pending', round: 'mcq' };
      }
      const techRounds = posting.pipeline?.techInterviewRounds || [];
      if (techRounds.length > 0) {
        return { status: 'tech_pending', round: 'tech', techRoundNumber: 1 };
      }
      if (posting.pipeline?.hrRound?.enabled) {
        return { status: 'hr_pending', round: 'hr' };
      }
      return { status: 'selected', round: 'completed' };
    }

    case 'mcq': {
      const techRounds = posting.pipeline?.techInterviewRounds || [];
      if (techRounds.length > 0) {
        return { status: 'tech_pending', round: 'tech', techRoundNumber: 1 };
      }
      if (posting.pipeline?.hrRound?.enabled) {
        return { status: 'hr_pending', round: 'hr' };
      }
      return { status: 'selected', round: 'completed' };
    }

    case 'tech': {
      // Check if there are more tech rounds remaining
      const techRounds = posting.pipeline?.techInterviewRounds || [];
      const currentTechRound = application.currentTechRoundNumber || 1;
      const nextRound = techRounds.find(r => r.roundNumber === currentTechRound + 1);

      if (nextRound) {
        return { status: 'tech_pending', round: 'tech', techRoundNumber: currentTechRound + 1 };
      }
      if (posting.pipeline?.hrRound?.enabled) {
        return { status: 'hr_pending', round: 'hr' };
      }
      return { status: 'selected', round: 'completed' };
    }

    case 'hr':
      return { status: 'selected', round: 'completed' };

    default:
      return null;
  }
}

// ── Core Decision Functions ───────────────────────────────────────────

/**
 * Evaluate an application after screening completed.
 */
function evaluateScreening(application, agentConfig, posting) {
  if (!agentConfig.autoAdvanceScreening) {
    return {
      action: ACTIONS.NOOP,
      reason: 'auto_advance_screening_disabled',
      eventType: null,
      severity: 'info',
    };
  }

  const score = application.screeningResult?.matchScore ?? 0;
  const threshold = getEffectiveScreeningThreshold(agentConfig, posting);
  const marginPercent = agentConfig.escalation?.thresholdMarginPercent ?? 5;

  // Check proctoring flags (screening typically has none, but be defensive)
  if (agentConfig.escalation?.onProctoringFlag && application.proctoringFlags?.criticalViolations > 0) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'proctoring_flag',
      eventType: 'escalation_proctor',
      severity: 'critical',
      details: {
        score,
        threshold,
        violations: application.proctoringFlags,
      },
    };
  }

  // Clearly passed
  if (score >= threshold) {
    const nextRound = getNextRoundStatus('screening', posting, application);
    return {
      action: ACTIONS.ADVANCE,
      reason: 'screening_score_above_threshold',
      eventType: 'screening_auto_advanced',
      severity: 'success',
      nextStatus: nextRound?.status,
      nextRound: nextRound?.round,
      techRoundNumber: nextRound?.techRoundNumber,
      details: { score, threshold },
    };
  }

  // Borderline — escalate
  if (isBorderlineScore(score, threshold, marginPercent)) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'borderline_score',
      eventType: 'escalation_threshold',
      severity: 'warning',
      details: {
        score,
        threshold,
        margin: computeEscalationMargin(threshold, marginPercent),
        message: `Screening score ${score}% is within ${marginPercent}% of the ${threshold}% threshold`,
      },
    };
  }

  // Clearly failed
  return {
    action: ACTIONS.REJECT,
    reason: 'screening_score_below_threshold',
    eventType: 'screening_auto_rejected',
    severity: 'info',
    details: { score, threshold },
  };
}

/**
 * Evaluate an application after MCQ completed.
 */
function evaluateMcq(application, agentConfig, posting) {
  if (!agentConfig.autoAdvanceMcq) {
    return {
      action: ACTIONS.NOOP,
      reason: 'auto_advance_mcq_disabled',
      eventType: null,
      severity: 'info',
    };
  }

  const score = application.mcqResult?.percentage ?? 0;
  const threshold = getEffectiveMcqThreshold(agentConfig, posting);
  const marginPercent = agentConfig.escalation?.thresholdMarginPercent ?? 5;

  // Check proctoring
  if (agentConfig.escalation?.onProctoringFlag && application.proctoringFlags?.criticalViolations > 0) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'proctoring_flag',
      eventType: 'escalation_proctor',
      severity: 'critical',
      details: {
        score,
        threshold,
        violations: application.proctoringFlags,
      },
    };
  }

  if (score >= threshold) {
    const nextRound = getNextRoundStatus('mcq', posting, application);
    return {
      action: ACTIONS.ADVANCE,
      reason: 'mcq_score_above_threshold',
      eventType: 'mcq_auto_advanced',
      severity: 'success',
      nextStatus: nextRound?.status,
      nextRound: nextRound?.round,
      techRoundNumber: nextRound?.techRoundNumber,
      details: { score, threshold },
    };
  }

  if (isBorderlineScore(score, threshold, marginPercent)) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'borderline_score',
      eventType: 'escalation_threshold',
      severity: 'warning',
      details: {
        score,
        threshold,
        margin: computeEscalationMargin(threshold, marginPercent),
        message: `MCQ score ${score}% is within ${marginPercent}% of the ${threshold}% threshold`,
      },
    };
  }

  return {
    action: ACTIONS.REJECT,
    reason: 'mcq_score_below_threshold',
    eventType: 'mcq_auto_rejected',
    severity: 'info',
    details: { score, threshold },
  };
}

/**
 * Evaluate an application after tech interview completed.
 */
function evaluateTech(application, agentConfig, posting, session) {
  if (!agentConfig.autoAdvanceTech) {
    return {
      action: ACTIONS.NOOP,
      reason: 'auto_advance_tech_disabled',
      eventType: null,
      severity: 'info',
    };
  }

  const currentRoundNumber = application.currentTechRoundNumber || 1;
  const techResult = (application.techResults || []).find(r => r.roundNumber === currentRoundNumber);
  const score = techResult?.score ?? session?.overallScore ?? 0;
  const threshold = getEffectiveTechThreshold(agentConfig, posting);
  const marginPercent = agentConfig.escalation?.thresholdMarginPercent ?? 5;
  // Convert margin for 0-10 scale: marginPercent of threshold
  const margin10 = (threshold * marginPercent) / 100;

  // Check proctoring
  if (agentConfig.escalation?.onProctoringFlag && application.proctoringFlags?.criticalViolations > 0) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'proctoring_flag',
      eventType: 'escalation_proctor',
      severity: 'critical',
      details: { score, threshold, violations: application.proctoringFlags },
    };
  }

  // Check low AI confidence (high STAR variance)
  const starScores = techResult?.evaluation || session?.starScores;
  if (agentConfig.escalation?.onLowAiConfidence && starScores) {
    const stdDev = computeStarVariance(starScores);
    if (stdDev > 2.0) {
      return {
        action: ACTIONS.ESCALATE,
        reason: 'low_ai_confidence',
        eventType: 'escalation_confidence',
        severity: 'warning',
        details: {
          score,
          threshold,
          starVariance: stdDev.toFixed(2),
          message: `AI confidence is low — STAR score standard deviation is ${stdDev.toFixed(2)} (threshold: 2.0)`,
        },
      };
    }
  }

  if (score >= threshold) {
    const nextRound = getNextRoundStatus('tech', posting, application);
    return {
      action: ACTIONS.ADVANCE,
      reason: 'tech_score_above_threshold',
      eventType: 'tech_auto_advanced',
      severity: 'success',
      nextStatus: nextRound?.status,
      nextRound: nextRound?.round,
      techRoundNumber: nextRound?.techRoundNumber,
      details: { score, threshold, roundNumber: currentRoundNumber },
    };
  }

  // Borderline on 0-10 scale
  if (score >= (threshold - margin10) && score < threshold) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'borderline_score',
      eventType: 'escalation_threshold',
      severity: 'warning',
      details: {
        score,
        threshold,
        margin: margin10.toFixed(2),
        message: `Tech interview score ${score}/10 is near the ${threshold}/10 threshold`,
      },
    };
  }

  return {
    action: ACTIONS.REJECT,
    reason: 'tech_score_below_threshold',
    eventType: 'tech_auto_rejected',
    severity: 'info',
    details: { score, threshold, roundNumber: currentRoundNumber },
  };
}

/**
 * Evaluate an application after HR interview completed.
 */
function evaluateHr(application, agentConfig, posting, session) {
  if (!agentConfig.autoAdvanceHr) {
    return {
      action: ACTIONS.NOOP,
      reason: 'auto_advance_hr_disabled',
      eventType: null,
      severity: 'info',
    };
  }

  const score = application.hrResult?.score ?? session?.overallScore ?? 0;
  const threshold = getEffectiveHrThreshold(agentConfig, posting);
  const marginPercent = agentConfig.escalation?.thresholdMarginPercent ?? 5;
  const margin10 = (threshold * marginPercent) / 100;

  // Check proctoring
  if (agentConfig.escalation?.onProctoringFlag && application.proctoringFlags?.criticalViolations > 0) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'proctoring_flag',
      eventType: 'escalation_proctor',
      severity: 'critical',
      details: { score, threshold, violations: application.proctoringFlags },
    };
  }

  if (score >= threshold) {
    return {
      action: ACTIONS.ADVANCE,
      reason: 'hr_score_above_threshold',
      eventType: 'hr_auto_advanced',
      severity: 'success',
      nextStatus: 'selected',
      nextRound: 'completed',
      details: { score, threshold },
    };
  }

  if (score >= (threshold - margin10) && score < threshold) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'borderline_score',
      eventType: 'escalation_threshold',
      severity: 'warning',
      details: {
        score,
        threshold,
        margin: margin10.toFixed(2),
        message: `HR interview score ${score}/10 is near the ${threshold}/10 threshold`,
      },
    };
  }

  return {
    action: ACTIONS.REJECT,
    reason: 'hr_score_below_threshold',
    eventType: 'hr_auto_rejected',
    severity: 'info',
    details: { score, threshold },
  };
}

// ── Main Evaluation Entry Point ───────────────────────────────────────

/**
 * Core decision function — called after any pipeline status change.
 * Determines which round just completed based on the application status
 * and delegates to the appropriate evaluator.
 *
 * @param {Application} application - The mongoose application document
 * @param {AgentConfig} agentConfig - The agent configuration for this job
 * @param {JobPosting}  posting     - The job posting document
 * @param {Session}     [session]   - Optional session document for interview rounds
 * @returns {object} AgentDecision: { action, reason, eventType, severity, details, ... }
 */
function evaluateApplication(application, agentConfig, posting, session = null) {
  // Guard: agent must be enabled and running
  if (!agentConfig || !agentConfig.enabled || agentConfig.status !== 'running') {
    return {
      action: ACTIONS.NOOP,
      reason: 'agent_not_active',
      eventType: null,
      severity: 'info',
    };
  }

  // Guard: skip if application is already escalated
  if (application.escalated) {
    return {
      action: ACTIONS.NOOP,
      reason: 'application_already_escalated',
      eventType: null,
      severity: 'info',
    };
  }

  // Guard: skip if application was already processed by the agent
  if (application.agentAdvanced) {
    return {
      action: ACTIONS.NOOP,
      reason: 'already_processed_by_agent',
      eventType: null,
      severity: 'info',
    };
  }

  const status = application.status;

  // Determine which round just completed and evaluate
  let decision;

  switch (status) {
    case 'screening_passed':
      decision = evaluateScreening(application, agentConfig, posting);
      break;

    case 'screening_failed':
      // Already the correct final state — just log it
      decision = {
        action: ACTIONS.NOOP,
        reason: 'screening_already_failed',
        eventType: 'screening_auto_rejected',
        severity: 'info',
        details: { score: application.screeningResult?.matchScore },
      };
      break;

    case 'mcq_passed':
      decision = evaluateMcq(application, agentConfig, posting);
      break;

    case 'mcq_failed':
      decision = {
        action: ACTIONS.NOOP,
        reason: 'mcq_already_failed',
        eventType: 'mcq_auto_rejected',
        severity: 'info',
        details: { score: application.mcqResult?.percentage },
      };
      break;

    case 'tech_passed':
      decision = evaluateTech(application, agentConfig, posting, session);
      break;

    case 'tech_failed':
      decision = {
        action: ACTIONS.NOOP,
        reason: 'tech_already_failed',
        eventType: 'tech_auto_rejected',
        severity: 'info',
        details: {},
      };
      break;

    case 'hr_passed':
      decision = evaluateHr(application, agentConfig, posting, session);
      break;

    case 'hr_failed':
      decision = {
        action: ACTIONS.NOOP,
        reason: 'hr_already_failed',
        eventType: 'hr_auto_rejected',
        severity: 'info',
        details: {},
      };
      break;

    default:
      decision = {
        action: ACTIONS.NOOP,
        reason: `status_not_actionable: ${status}`,
        eventType: null,
        severity: 'info',
      };
  }

  // Post-decision: check if we're reaching the finalist target
  if (decision.action === ACTIONS.ADVANCE && decision.nextStatus === 'selected') {
    const currentFinalists = agentConfig.stats?.currentFinalists || 0;
    const target = agentConfig.targetFinalists || 5;

    if (agentConfig.escalation?.onTargetReached && (currentFinalists + 1) >= target) {
      // Override: escalate instead so recruiter can make final call
      return {
        action: ACTIONS.ESCALATE,
        reason: 'target_reached',
        eventType: 'escalation_target_reached',
        severity: 'warning',
        details: {
          ...decision.details,
          currentFinalists: currentFinalists + 1,
          targetFinalists: target,
          message: `Finalist target of ${target} has been reached. The recruiter should review all finalists.`,
          originalDecision: decision.action,
        },
      };
    }
  }

  return decision;
}

// ── Deadline Check ────────────────────────────────────────────────────

/**
 * Check if a job's agent config has a deadline that is within 24 hours.
 * Returns an escalation decision if the target has not yet been met.
 */
function checkDeadline(agentConfig) {
  if (!agentConfig.deadline) return null;
  if (agentConfig.status !== 'running') return null;

  const now = new Date();
  const deadline = new Date(agentConfig.deadline);
  const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

  if (hoursRemaining <= 0) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'deadline_passed',
      eventType: 'escalation_deadline',
      severity: 'critical',
      details: {
        deadline: agentConfig.deadline,
        currentFinalists: agentConfig.stats?.currentFinalists || 0,
        targetFinalists: agentConfig.targetFinalists,
        message: 'Agent deadline has passed. Final recruiter review needed.',
      },
    };
  }

  if (hoursRemaining <= 24) {
    const currentFinalists = agentConfig.stats?.currentFinalists || 0;
    const target = agentConfig.targetFinalists || 5;

    if (currentFinalists < target) {
      return {
        action: ACTIONS.ESCALATE,
        reason: 'deadline_approaching',
        eventType: 'escalation_deadline',
        severity: 'warning',
        details: {
          deadline: agentConfig.deadline,
          hoursRemaining: Math.round(hoursRemaining),
          currentFinalists,
          targetFinalists: target,
          message: `Deadline in ${Math.round(hoursRemaining)} hours. Only ${currentFinalists}/${target} finalists so far.`,
        },
      };
    }
  }

  return null;
}

module.exports = {
  ACTIONS,
  evaluateApplication,
  evaluateScreening,
  evaluateMcq,
  evaluateTech,
  evaluateHr,
  checkDeadline,
  computeStarVariance,
  isBorderlineScore,
  getNextRoundStatus,
  getEffectiveScreeningThreshold,
  getEffectiveMcqThreshold,
  getEffectiveTechThreshold,
  getEffectiveHrThreshold,
};
