/**
 * RecruiterTour — Full interactive walkthrough of the Quasar Recruit platform.
 *
 * Built with React Joyride v3. Features:
 * - Custom Quasar-branded tooltip (dark glassmorphic theme, orange accent)
 * - 10 tour steps covering every major feature
 * - Smart view-navigation between steps (Dashboard ↔ Jobs) via `before` hooks
 * - Animated "Take a Tour" floating trigger button
 * - Dummy data shown during tour (real stats and job listings)
 */

import { useState, useCallback } from 'react';
import { Joyride, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { EventData, TooltipRenderProps, Step } from 'react-joyride';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { DashboardStats, JobPosting } from '../../types/recruitment';

// ── Props ────────────────────────────────────────────────────────────

interface Props {
  /** Called when the tour needs to change the recruiter's current view */
  onNavigate: (view: { type: string }) => void;
  /** Called with true when tour starts, false when it ends */
  onTourActiveChange: (active: boolean) => void;
}

// ── Dummy data shown during tour ─────────────────────────────────────

export const TOUR_DUMMY_STATS: DashboardStats = {
  totalPostings: 12,
  activePostings: 8,
  draftPostings: 3,
  closedPostings: 1,
  totalApplicants: 147,
  recentApplications: 23,
  selectedCandidates: 12,
  pipelineFunnel: {
    screening: 50,
    screening_passed: 38,
    screening_failed: 12,
    mcq_pending: 30,
    mcq_in_progress: 4,
    mcq_passed: 22,
    mcq_failed: 8,
    tech_pending: 18,
    tech_in_progress: 2,
    tech_passed: 14,
    tech_failed: 4,
    hr_pending: 10,
    hr_in_progress: 1,
    hr_passed: 8,
    hr_failed: 2,
    selected: 12,
    rejected: 26,
  },
};

export const TOUR_DUMMY_JOBS: JobPosting[] = [
  {
    _id: 'tour-j-1',
    recruiterId: 'tour',
    title: 'Senior React Developer',
    company: 'Quasar Technologies',
    location: 'Bangalore, IN',
    employmentType: 'full-time',
    salaryRange: { min: 2000000, max: 3500000, currency: 'INR' },
    jobDescription: '',
    parsedJd: null,
    status: 'published',
    pipeline: {},
    autoScreeningEnabled: true,
    screeningThreshold: 65,
    applicantCount: 42,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'tour-j-2',
    recruiterId: 'tour',
    title: 'ML Engineer — NLP & LLMs',
    company: 'Quasar Technologies',
    location: 'Remote',
    employmentType: 'full-time',
    salaryRange: { min: 2500000, max: 4200000, currency: 'INR' },
    jobDescription: '',
    parsedJd: null,
    status: 'published',
    pipeline: {},
    autoScreeningEnabled: true,
    screeningThreshold: 70,
    applicantCount: 29,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'tour-j-3',
    recruiterId: 'tour',
    title: 'Product Manager — Platform',
    company: 'Quasar Technologies',
    location: 'Mumbai, IN',
    employmentType: 'full-time',
    salaryRange: null,
    jobDescription: '',
    parsedJd: null,
    status: 'published',
    pipeline: {},
    autoScreeningEnabled: true,
    screeningThreshold: 60,
    applicantCount: 67,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'tour-j-4',
    recruiterId: 'tour',
    title: 'DevOps / Platform Engineer',
    company: 'Quasar Technologies',
    location: 'Hyderabad, IN',
    employmentType: 'contract',
    salaryRange: null,
    jobDescription: '',
    parsedJd: null,
    status: 'draft',
    pipeline: {},
    autoScreeningEnabled: false,
    screeningThreshold: 50,
    applicantCount: 0,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'tour-j-5',
    recruiterId: 'tour',
    title: 'UI/UX Designer — Brand',
    company: 'Quasar Technologies',
    location: 'Bangalore, IN',
    employmentType: 'full-time',
    salaryRange: { min: 1200000, max: 2000000, currency: 'INR' },
    jobDescription: '',
    parsedJd: null,
    status: 'closed',
    pipeline: {},
    autoScreeningEnabled: false,
    screeningThreshold: 55,
    applicantCount: 31,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── Custom Joyride tooltip ────────────────────────────────────────────

const STEP_ICONS = ['👋', '📊', '📈', '🎯', '⚡', '💼', '📋', '✨', '🚀', '🎉'];

function QuasarTooltip({
  backProps,
  closeProps,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  step,
  tooltipProps,
  size,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      style={{
        width: 390,
        background: 'rgba(11, 11, 20, 0.98)',
        border: '1px solid rgba(249, 115, 22, 0.22)',
        borderRadius: 20,
        boxShadow:
          '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(249,115,22,0.08), 0 0 60px rgba(249,115,22,0.06)',
        overflow: 'hidden',
        backdropFilter: 'blur(24px)',
        fontFamily: "'Inter', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        animation: 'tour-tooltip-in 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
      }}
    >
      {/* Top gradient bar */}
      <div
        style={{
          height: 3,
          background: 'linear-gradient(90deg, #f97316 0%, #fb923c 60%, #fbbf24 100%)',
        }}
      />

      <div style={{ padding: '22px 24px 20px' }}>
        {/* Header: icon + title + close */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          {/* Step icon bubble */}
          <div
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              background:
                'linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(251,146,60,0.12) 100%)',
              border: '1px solid rgba(249,115,22,0.28)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            {STEP_ICONS[index] ?? '✦'}
          </div>

          {/* Title */}
          <div style={{ flex: 1, paddingTop: 3 }}>
            {step.title && (
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#f0f0f8',
                  lineHeight: 1.3,
                  letterSpacing: '-0.3px',
                }}
              >
                {step.title}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            {...closeProps}
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(240,240,248,0.35)',
              marginTop: 2,
            }}
            aria-label="Close tour"
          >
            <X size={13} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.7,
            color: 'rgba(240,240,248,0.62)',
            marginBottom: 20,
          }}
        >
          {step.content}
        </div>

        {/* Progress segments */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
          {Array.from({ length: size }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 3,
                borderRadius: 999,
                flex: i === index ? 2.5 : 1,
                background:
                  i === index
                    ? '#f97316'
                    : i < index
                    ? 'rgba(249,115,22,0.35)'
                    : 'rgba(255,255,255,0.08)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Footer: skip | counter back next */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!isLastStep ? (
            <button
              {...skipProps}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                color: 'rgba(240,240,248,0.28)',
                cursor: 'pointer',
                padding: '4px 0',
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
            >
              Skip tour
            </button>
          ) : (
            <span />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                color: 'rgba(240,240,248,0.28)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                marginRight: 2,
              }}
            >
              {index + 1}/{size}
            </span>

            {/* Back */}
            {index > 0 && (
              <button
                {...backProps}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '7px 13px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'rgba(240,240,248,0.6)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <ChevronLeft size={13} />
                Back
              </button>
            )}

            {/* Next / Finish */}
            <button
              {...primaryProps}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 18px',
                background: isLastStep
                  ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                  : 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                border: 'none',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                color: isLastStep ? '#fff' : '#000',
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: isLastStep
                  ? '0 4px 20px rgba(34,197,94,0.35)'
                  : '0 4px 20px rgba(249,115,22,0.35)',
              }}
            >
              {isLastStep ? 'Get started!' : 'Next'}
              {!isLastStep && <ChevronRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tour steps ────────────────────────────────────────────────────────

const TOUR_STEPS: Step[] = [
  {
    target: '#tour-sidebar',
    title: 'Welcome to Quasar Recruit!',
    content: (
      <span>
        Your AI-powered hiring platform. We'll walk you through every feature in about{' '}
        <strong style={{ color: '#f97316' }}>2 minutes</strong>. You can skip at any time.
      </span>
    ),
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '#tour-nav-dashboard',
    title: 'Dashboard',
    content:
      'Your command center — real-time stats, pipeline health, and quick actions. Everything you need the moment you log in.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '#tour-stat-cards',
    title: 'Key Metrics at a Glance',
    content: (
      <span>
        Track <strong style={{ color: '#f97316' }}>active postings</strong>,{' '}
        <strong style={{ color: '#3b82f6' }}>total applicants</strong>,{' '}
        <strong style={{ color: '#22c55e' }}>selected candidates</strong>, and{' '}
        <strong style={{ color: '#8b5cf6' }}>new applications this week</strong> — all updated in
        real time.
      </span>
    ),
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '#tour-pipeline-funnel',
    title: 'Pipeline Funnel',
    content: (
      <span>
        Visualise exactly how candidates flow through each stage —{' '}
        <strong style={{ color: '#f97316' }}>
          Application → Screening → MCQ → Tech → HR → Selected
        </strong>
        . Instantly spot where you're losing talent.
      </span>
    ),
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: '#tour-quick-actions',
    title: 'Quick Actions',
    content:
      'One-click shortcuts to your most common tasks — create a new job or dive into your candidate pipeline without deep navigation.',
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: '#tour-nav-jobs',
    title: 'Job Postings',
    content:
      'All your open roles in one place. Filter by status (published, draft, closed), see live applicant counts, and dive into any position with a click.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '#tour-job-list',
    title: 'Your Job Listings',
    content: (
      <span>
        Each card shows the{' '}
        <strong style={{ color: '#f97316' }}>role, company, location, status badge</strong>, and
        live applicant count. Click any row to open the full candidate pipeline with AI scores,
        transcripts, and evaluations.
      </span>
    ),
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '#tour-create-job-btn',
    title: 'Create a Job Posting',
    content: (
      <span>
        Post a new role in minutes. Paste your JD and Quasar's AI will{' '}
        <strong style={{ color: '#f97316' }}>
          instantly parse requirements, suggest screening criteria
        </strong>
        , and configure your multi-round pipeline automatically.
      </span>
    ),
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '#tour-nav-create-job',
    title: 'Design Your Pipeline',
    content: (
      <span>
        Define a fully configurable hiring pipeline:{' '}
        <strong style={{ color: '#f97316' }}>
          AI Screening → MCQ → 1–3 Tech Interviews → HR Round
        </strong>
        . Each round has time windows, score thresholds, and AI interview personas.
      </span>
    ),
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '#tour-user-footer',
    title: "You're all set! 🎉",
    content: (
      <span>
        That's the full platform! Create your first job posting and let Quasar's AI handle{' '}
        <strong style={{ color: '#22c55e' }}>
          screening, interviews, and candidate ranking
        </strong>{' '}
        automatically. Good hiring starts here.
      </span>
    ),
    placement: 'top',
    skipBeacon: true,
  },
];

// View required per step (null = sidebar target, always in DOM)
const STEP_VIEW: Record<number, 'dashboard' | 'jobs' | null> = {
  0: 'dashboard',
  1: 'dashboard',
  2: 'dashboard',
  3: 'dashboard',
  4: 'dashboard',
  5: null,
  6: 'jobs',
  7: 'jobs',
  8: null,
  9: null,
};

// ── Main tour component ───────────────────────────────────────────────

export function RecruiterTour({ onNavigate, onTourActiveChange }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [run, setRun] = useState(false);

  const startTour = useCallback(() => {
    onNavigate({ type: 'dashboard' });
    onTourActiveChange(true);
    // Small delay for DOM to settle
    setTimeout(() => {
      setStepIndex(0);
      setRun(true);
    }, 350);
  }, [onNavigate, onTourActiveChange]);

  const endTour = useCallback(() => {
    setRun(false);
    setStepIndex(0);
    onTourActiveChange(false);
    onNavigate({ type: 'dashboard' });
  }, [onNavigate, onTourActiveChange]);

  const handleEvent = useCallback(
    (data: EventData) => {
      const { action, index, type, status } = data;

      // ── Finished or skipped ──────────────────────────────────────
      if (
        status === STATUS.FINISHED ||
        status === STATUS.SKIPPED ||
        action === ACTIONS.CLOSE ||
        action === ACTIONS.SKIP
      ) {
        endTour();
        return;
      }

      // ── Step navigation ──────────────────────────────────────────
      if (type === EVENTS.STEP_AFTER) {
        const isForward = action === ACTIONS.NEXT || action === ACTIONS.GO;
        const isBack = action === ACTIONS.PREV;
        if (!isForward && !isBack) return;

        const nextIndex = isForward ? index + 1 : index - 1;
        if (nextIndex < 0 || nextIndex >= TOUR_STEPS.length) return;

        const requiredView = STEP_VIEW[nextIndex];

        if (requiredView) {
          // Pause, navigate, then resume at nextIndex
          setRun(false);
          onNavigate({ type: requiredView });
          setTimeout(() => {
            setStepIndex(nextIndex);
            setRun(true);
          }, 450);
        } else {
          setStepIndex(nextIndex);
        }
      }
    },
    [endTour, onNavigate]
  );

  return (
    <>
      {/* ── Floating "Take a Tour" trigger ─────────────────────────── */}
      <AnimatePresence>
        {!run && (
          <motion.button
            id="tour-start-btn"
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={startTour}
            title="Take a platform tour"
            style={{
              position: 'fixed',
              bottom: 28,
              right: 28,
              zIndex: 9998,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 20px',
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
              border: 'none',
              borderRadius: 14,
              color: '#000',
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "'Inter', system-ui, sans-serif",
              cursor: 'pointer',
              boxShadow:
                '0 8px 32px rgba(249,115,22,0.45), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              letterSpacing: '-0.1px',
              WebkitFontSmoothing: 'antialiased',
            }}
          >
            <Sparkles size={15} />
            Take a Tour
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Joyride v3 instance ─────────────────────────────────────── */}
      <Joyride
        steps={TOUR_STEPS}
        run={run}
        stepIndex={stepIndex}
        continuous
        onEvent={handleEvent}
        tooltipComponent={QuasarTooltip}
        options={{
          overlayColor: 'rgba(0, 0, 0, 0.68)',
          spotlightRadius: 16,
          spotlightPadding: 10,
          zIndex: 10000,
          arrowColor: 'rgba(11, 11, 20, 0.98)',
          skipScroll: true,
        }}
      />

      {/* Tooltip animation keyframes */}
      <style>{`
        @keyframes tour-tooltip-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </>
  );
}
