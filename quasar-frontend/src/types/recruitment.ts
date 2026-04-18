// ── Recruitment system types ──────────────────────────────────────────

export type UserRole = 'candidate' | 'recruiter';

export interface OnboardingState {
  role: UserRole | null;
  profileComplete: boolean;
}

// ── Job Posting ───────────────────────────────────────────────────────

export interface TimeWindow {
  start: string; // ISO date
  end: string;
}

export interface McqRoundConfig {
  enabled: boolean;
  durationMinutes: number;
  passingScore: number;
  window: TimeWindow;
}

export interface TechRoundConfig {
  roundNumber: number;
  title: string;
  domain: string;
  personaId: string;
  durationMinutes: number;
  passingScore: number;
  window: TimeWindow;
}

export interface HrRoundConfig {
  enabled: boolean;
  durationMinutes: number;
  passingScore: number;
  window: TimeWindow;
}

export interface DsaRoundConfig {
  enabled: boolean;
  durationMinutes: number;
  passingScore: number;
  window: TimeWindow;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  allowedLanguages: string[];
}

export interface PipelineConfig {
  mcqRound?: McqRoundConfig | null;
  dsaRound?: DsaRoundConfig | null;
  techInterviewRounds?: TechRoundConfig[];
  hrRound?: HrRoundConfig | null;
}

export interface SalaryRange {
  min: number | null;
  max: number | null;
  currency: string;
}

export interface JobPosting {
  _id: string;
  recruiterId: string;
  title: string;
  company: string;
  location: string | null;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
  salaryRange: SalaryRange | null;
  jobDescription: string;
  parsedJd: ParsedJd | null;
  status: 'draft' | 'published' | 'closed' | 'archived';
  pipeline: PipelineConfig;
  autoScreeningEnabled: boolean;
  screeningThreshold: number;
  applicantCount: number;
  mcqCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedJd {
  role: string;
  seniority: string;
  domain: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  culturalSignals: string[];
}

// ── MCQ Question ──────────────────────────────────────────────────────

export interface McqOption {
  text: string;
  isCorrect?: boolean; // Only visible to recruiter, stripped for candidates
}

export interface McqQuestion {
  _id: string;
  jobPostingId: string;
  question: string;
  options: McqOption[];
  explanation: string | null;
  difficulty: 1 | 2 | 3;
  topic: string | null;
  source: 'recruiter' | 'ai_generated';
  createdAt: string;
}

// ── Application ───────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'applied'
  | 'screening' | 'screening_passed' | 'screening_failed'
  | 'mcq_pending' | 'mcq_in_progress' | 'mcq_passed' | 'mcq_failed'
  | 'dsa_pending' | 'dsa_in_progress' | 'dsa_passed' | 'dsa_failed'
  | 'tech_pending' | 'tech_in_progress' | 'tech_passed' | 'tech_failed'
  | 'hr_pending' | 'hr_in_progress' | 'hr_passed' | 'hr_failed'
  | 'selected' | 'rejected' | 'withdrawn';

export interface ScreeningResult {
  matchScore: number;
  passed: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
  evaluatedAt: string;
}

export interface McqAnswer {
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
  timeTakenSeconds: number;
}

export interface McqResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  passed: boolean;
  answers: McqAnswer[];
  startedAt: string;
  completedAt: string | null;
}

export interface TechResult {
  roundNumber: number;
  sessionId: string | null;
  score: number | null;
  passed: boolean | null;
  transcript: string;
  evaluation: Record<string, unknown> | null;
  completedAt: string | null;
}

export interface HrResult {
  sessionId: string | null;
  score: number | null;
  passed: boolean | null;
  transcript: string;
  evaluation: Record<string, unknown> | null;
  completedAt: string | null;
}

export interface DsaTestCaseResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  time: number;
  memory: number;
  status: string;
  isHidden?: boolean;
}

export interface DsaQuestionResult {
  questionId: string;
  language: string;
  code: string;
  testCaseResults: DsaTestCaseResult[];
  passedCount: number;
  totalCount: number;
  score: number;
  submittedAt: string | null;
}

export interface DsaResult {
  questions: DsaQuestionResult[];
  totalScore: number;
  percentage: number;
  passed: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

export interface DsaQuestion {
  _id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  domain: string;
  constraints: string;
  inputFormat: string;
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
  testCases: { _id?: string; input: string; expectedOutput: string; isHidden?: boolean; timeLimit?: number; memoryLimit?: number }[];
  starterCode: Record<string, string>;
  tags: string[];
  source: 'system' | 'recruiter';
  jobPostingId: string | null;
}

export interface DsaTestStartData {
  questions: DsaQuestion[];
  totalQuestions: number;
  durationMinutes: number;
  allowedLanguages: string[];
  startedAt: string;
  deadline: string;
}

export interface Application {
  _id: string;
  candidateId: string;
  jobPostingId: string | JobPosting;
  status: ApplicationStatus;
  currentRound: string;
  currentTechRoundNumber: number;
  screeningResult: ScreeningResult | null;
  mcqResult: McqResult | null;
  dsaResult: DsaResult | null;
  techResults: TechResult[];
  hrResult: HrResult | null;
  totalScore: number;
  rank: number | null;
  appliedAt: string;
  lastActivityAt: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalPostings: number;
  activePostings: number;
  draftPostings: number;
  closedPostings: number;
  totalApplicants: number;
  recentApplications: number;
  selectedCandidates: number;
  pipelineFunnel: Record<string, number>;
}

export interface ApplicantSummary {
  _id: string;
  candidate: {
    _id: string;
    name: string;
    email: string;
    headline: string | null;
    skills: string[];
    experience: number | null;
    avatarUrl: string | null;
  };
  status: ApplicationStatus;
  currentRound: string;
  rank: number | null;
  totalScore: number;
  appliedAt: string;
  lastActivityAt: string;
  screeningScore: number | null;
  mcqPercentage: number | null;
  techScores: { round: number; score: number | null; passed: boolean | null }[];
  hrScore: number | null;
  dsaPercentage: number | null;
}

// ── MCQ Test (Candidate View) ─────────────────────────────────────────

export interface McqTestQuestion {
  _id: string;
  question: string;
  options: { text: string }[]; // No isCorrect — stripped for candidates
  difficulty: 1 | 2 | 3;
  topic: string | null;
}

export interface McqTestStartData {
  questions: McqTestQuestion[];
  totalQuestions: number;
  durationMinutes: number;
  startedAt: string;
  deadline: string;
}
