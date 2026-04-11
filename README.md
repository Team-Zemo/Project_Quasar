<p align="center">
  <img src="https://img.shields.io/badge/Gemini_3.1_Flash-Live_API-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/React_19-Vite_8-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Express_5-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose_8-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/WebSocket-Real_Time-010101?style=for-the-badge&logo=socketdotio&logoColor=white" />
  <img src="https://img.shields.io/badge/MediaPipe-Face_Landmarks-FF6F00?style=for-the-badge&logo=mediapipe&logoColor=white" />
</p>

# 🌌 Interview Quasar

> **The AI-powered hiring platform that replaces the entire interview pipeline — from resume screening to final selection — with a single, autonomous system.**

<p align="center">
  <br/>
  <a href="https://drive.google.com/file/d/1MY-Bs8JCHpTB1WAPr6taUkbO6-WxZcSh/view?usp=sharing">
    <img src="https://img.shields.io/badge/🎥_Watch_Demo_Video-Click_Here-FF0000?style=for-the-badge&logoColor=white&labelColor=1a1a2e&color=e94560" alt="Demo Video" />
  </a>
  <br/><br/>
  <b>👆 See the full platform in action — live AI interviews, autonomous agent, proctoring &amp; more</b>
  <br/><br/>
</p>

---

Interview Quasar is a full-stack platform with two parallel product surfaces:

1. **For Candidates** — Practice with a real-time AI interviewer powered by **Gemini 3.1 Flash Live API** (voice-to-voice), get STAR-scored evaluations, built-in code editor, emotion analysis, and an AI career coach.
2. **For Recruiters** — Post jobs, auto-screen resumes with AI, run proctored MCQ + AI interview rounds, and deploy an **autonomous hiring agent** that advances, rejects, or escalates candidates based on configurable thresholds — with zero manual intervention.

---

## 🎬 What Makes This Different

Most "AI interview" tools are glorified chatbots. Quasar is a **complete agentic system** where:

| Traditional Process | Interview Quasar |
|---|---|
| Recruiter manually reviews 200 resumes | AI screens every resume against JD in real-time — ranked by match % |
| Schedule interviews with human interviewers | AI conducts live voice interviews 24/7, with live coding rounds |
| Recruiter manually advances each candidate | **Autonomous agent** advances, rejects, or escalates — recruiter sets goals once |
| No proctoring, easy to cheat | Full proctoring: fullscreen lock, tab-switch detection, devtools blocking, multi-face detection via MediaPipe |
| Static report cards | Live emotion analysis (confidence, stress, nervousness, eye contact), filler word detection, STAR scoring, skill vector tracking |
| One evaluation dimension | 6-axis STAR scoring + 6 category scores + speech metrics + emotion data = comprehensive evaluation |

---

## ✨ Core Features

### 🎤 Real-Time Voice Interviews (Gemini Live API)

<table>
<tr><td width="60%">

- **Voice-to-voice** conversations via Gemini 3.1 Flash Live API with WebSocket relay
- **Structured interview flow**: Introduction → 4-5 core questions → coding challenge → closing
- **Function calling**: AI calls `present_coding_question` → triggers Monaco code editor → candidate writes code → AI evaluates verbally
- **Function calling**: AI calls `end_interview` → graceful session teardown
- **Push-to-Talk mode**: Hold `Space` to talk, or Free Talk (always-on mic)
- **Live transcription**: Both user (input) and AI (output) speech are transcribed in real-time
- **Context-aware**: AI knows the candidate's GitHub projects, LeetCode stats, and resume — asks tailored questions

</td><td>

**Tech Stack**
```
Browser → WebSocket → Backend ConnectionHandler
  → Gemini 3.1 Flash Live API (native SDK)
  → Audio (PCM 16kHz) bidirectional streaming
  → Tool calls (end_interview, present_coding_question)
  → Transcription (input + output)
```

</td></tr>
</table>

### 🧠 Emotion & Behavioral Analysis (MediaPipe)

Real-time face analysis powered by **MediaPipe FaceLandmarker** with 52 ARKit blendshapes:

| Metric | How It Works |
|---|---|
| **Confidence Score** | Weighted composite: smile (30%) + attention (35%) + inverse stress (20%) + eye contact (15%) |
| **Attention Score** | Head pose deviation — penalizes yaw/pitch away from camera |
| **Stress Detection** | Brow tension + nose sneer + mouth frown + cheek puff blendshapes |
| **Nervousness** | Rolling variance of jaw + brow activity over 4-second window |
| **Eye Contact** | Gaze deviation + head-pose facing detection |
| **Blink Rate** | Blink event counting with 60-second sliding window |
| **Head Pose Compass** | Live pitch/yaw/roll visualization from facial transformation matrix |
| **Multi-Face Detection** | Confirms ≥2 faces for 5 consecutive frames → proctoring violation |

> GPU-accelerated (WebGL2 delegate, CPU fallback), runs at 5 fps analysis rate with ~5ms/frame.

### 🛡️ Enterprise Proctoring System

Full-stack proctoring with 9 violation types — active during MCQ tests and AI interviews:

```
fullscreen_exit  → critical    |  right_click       → warning
tab_switch       → critical    |  copy_paste        → warning
devtools_open    → critical    |  keyboard_shortcut → warning
multiple_faces   → critical    |  multi_monitor     → warning
print_screen     → warning     |
```

- **Auto-termination**: Session ends after 5 critical violations or trust score ≤ 0
- **Trust Score**: Starts at 100, decays per violation (critical: -5, warning: -2)
- **Batched API**: Violations are queued client-side and flushed in batches (250ms debounce)
- **Keyboard blocking**: Blocks Ctrl+C/V/X, F12, Ctrl+Shift+I/J/C, PrintScreen, Alt+Tab, Ctrl+P/S/U

### 🤖 Autonomous Hiring Agent

The flagship feature — an **event-driven agentic orchestration layer** that automates the entire hiring funnel:

```
Recruiter sets goal: "5 finalists by Friday, 70% screening threshold"
         ↓
Agent takes over and runs autonomously:
  ↓ Candidate applies → AI screens resume → Agent checks score
    ├── Score ≥ 70%     → AUTO-ADVANCE to MCQ
    ├── Score 66.5-70%  → ESCALATE (borderline — recruiter decides)
    └── Score < 66.5%   → AUTO-REJECT
  ↓ MCQ completed → Agent checks percentage → advance/reject/escalate
  ↓ Tech interview → Agent checks STAR score + AI confidence → advance/escalate
  ↓ HR interview → Agent checks score → select as finalist or escalate
         ↓
Agent only contacts recruiter for:
  • Borderline scores (within configurable margin)
  • Proctoring violations
  • Low AI confidence (STAR variance > 2.0)
  • Finalist target reached
  • Deadline approaching
```

**Architecture:**

| Component | Purpose |
|---|---|
| `agentDecisionEngine.js` (659 lines) | Pure logic — threshold evaluation, borderline detection, STAR variance analysis |
| `agentService.js` (409 lines) | Orchestrator — executes decisions, transitions statuses, sends emails |
| `agentScheduler.js` (366 lines) | 3 cron jobs: pipeline poll (60s), daily digest (9 PM IST), deadline check (9 AM IST) |
| `AgentConfig` model | Stores goals, thresholds, escalation rules per job |
| `AgentEvent` model | Full audit log — every autonomous decision with scores and reasoning |
| `AgentDigest` model | Daily summary reports for recruiter email digest |

**Key Design Decisions:**
- **Fire-and-forget hooks** — Agent hooks in controllers never block the HTTP response
- **Safety-first** — If the agent crashes, manual pipeline works exactly as before
- **Dual processing** — Instant hooks + 60-second safety poller ensures nothing is missed
- **Threshold cascading** — Agent config → Job config → System defaults
- **Human-in-the-loop** — Agent escalates instead of deciding on uncertain cases

### 🎓 AI Career Coach (Tool-Augmented)

Context-aware career advisor with **real-time job search** capability:

- **Intent detection**: AI classifies if the user is asking about jobs
- **Database search**: Queries active job postings with text + regex matching
- **Profile-aware**: Injects user's interview scores, skill vectors, GitHub projects, LeetCode stats
- **SSE streaming**: Progressive response rendering

### 🔗 Platform Integration (GitHub + LeetCode)

Syncs and enriches candidate profiles from external platforms:

| Platform | Data Synced |
|---|---|
| **GitHub** | Profile, all non-forked repos (with per-repo language byte breakdown), top languages by LOC, project descriptions, stars, topics |
| **LeetCode** | Total solved (Easy/Medium/Hard), global ranking, contest rating, languages used, advanced/intermediate/fundamental skill tags |

All data is transformed into a `platformContext` text block injected directly into AI prompts — the interviewer knows your actual projects and asks questions about them.

### 🎮 Gamification System

25 badges, 10 levels, XP system, streaks:

```
Session complete: +20 XP    |  Pass (≥6.5): +30 XP
Excellent (≥8.0): +20 XP   |  7-day streak: +30 XP bonus
Duration bonus: +5 per 10 min

Badges: First Step, Consistent, Dedicated, Centurion, High Achiever,
        Perfect Ten, Comeback Kid, On Fire, Week Warrior, Fortnight,
        Unstoppable, Domain Explorer, Polymath, Face the Panel,
        Clean Speaker, Speed Demon, Measured, Rising Star,
        Interview Master, XP Farmer, Night Owl, Early Bird,
        Resume Analyst, JD Whisperer
```

### 📊 Resume vs JD Comparison

Upload a resume and compare it against any job description:
- **Match score** (0-100) with weighted criteria (skills 40%, experience 30%, education 15%, suitability 15%)
- **Matched vs missing skills** breakdown
- **Recommendation**: Shortlist / Review / Reject

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vite 8 + React 19 + TypeScript)  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Landing Page │  │  Candidate   │  │  Recruiter Shell         │ │
│  │  (Framer +   │  │  • Interview │  │  • Dashboard + Stats     │ │
│  │   Lenis +    │  │  • Coach Chat│  │  • Job CRUD + Pipeline   │ │
│  │   OGL)       │  │  • Progress  │  │  • Agent Config Panel    │ │
│  │              │  │  • MCQ Tests │  │  • Escalation Panel      │ │
│  │              │  │  • Profile   │  │  • Applicant Detail View  │ │
│  │              │  │  • Gamify    │  │  • Activity Feed          │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
│                         │ WebSocket          │ REST API            │
└─────────────────────────┼────────────────────┼────────────────────┘
                          │                    │
┌─────────────────────────┼────────────────────┼────────────────────┐
│                     BACKEND (Express 5 + Node.js)                 │
│  ┌──────────────┐  ┌────┴──────┐  ┌──────────┴──────────────────┐ │
│  │  WebSocket   │  │  REST API │  │  Agent Scheduler (node-cron) │ │
│  │  Handler     │  │  21 ctrl  │  │  • Poll (60s)               │ │
│  │  ↕ Gemini    │  │  4 routes │  │  • Digest (21:00 IST)       │ │
│  │  Live API    │  │  9 models │  │  • Deadline (09:00 IST)     │ │
│  └──────────────┘  └──────────┘  └──────────────────────────────┘ │
│                         │                                         │
│  ┌──────────────────────┴────────────────────────────────────────┐ │
│  │  Services Layer                                                │ │
│  │  • geminiService (Live API)  • resumeScreeningService          │ │
│  │  • agentDecisionEngine       • agentService                    │ │
│  │  • gamificationService       • emailService (6 templates)      │ │
│  │  • platformSyncService       • mcqGeneratorService             │ │
│  │  • groqService               • storageService (MinIO)          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                         │                                         │
└─────────────────────────┼─────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │   MongoDB + MinIO     │
              │   (12 collections)    │
              └───────────────────────┘
```

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Framer Motion, Tailwind CSS 4, shadcn/ui, Lenis (smooth scroll), OGL (WebGL), Monaco Editor |
| **Backend** | Node.js, Express 5, Mongoose 8, WebSocket (ws), node-cron |
| **AI / ML** | Gemini 3.1 Flash Live API (@google/genai), Groq API (gpt-oss-120b), MediaPipe FaceLandmarker |
| **Database** | MongoDB Atlas |
| **Storage** | MinIO (S3-compatible) for resume PDFs |
| **Auth** | JWT (access + refresh tokens), Google OAuth 2.0, GitHub OAuth 2.0, bcrypt |
| **Email** | Nodemailer with branded HTML templates (6 agent templates + system emails) |
| **PDF** | PDFKit (interview report generation), pdfjs-dist (resume parsing) |
| **Deployment** | Nginx reverse proxy, systemd services, SSL/TLS |

---

## 📁 Project Structure

```
quasar-backend/src/
├── controllers/         # 21 controllers (auth, jobs, pipeline, agent, eval, coach, proctoring...)
├── services/            # 8 services (gemini, agent engine, gamification, email, platform sync...)
├── models/              # 13 Mongoose models (User, Session, Application, AgentConfig, AgentEvent...)
├── routes/              # 4 route files (api, auth, candidate, recruiter)
├── websocket/           # WebSocket handler + Gemini Live API bridge
├── middleware/          # Auth, rate limiting, validation
├── config/              # Environment configuration
└── utils/               # Logger (Winston + Morgan with color coding)

quasar-frontend/src/
├── components/          # 34 shared components + 7 candidate + 6 recruiter
├── hooks/               # 5 custom hooks (useInterviewSession, useProctoring, useAudioProcessor...)
├── landing/             # 8 landing page sections (Hero, Features, HowItWorks, CTA...)
├── lib/                 # API client, auth state machine, utilities
├── workers/             # Web Workers for audio processing
└── types/               # TypeScript interfaces
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)
- MinIO (or any S3-compatible store)
- Gemini API key (for live interviews)
- Groq API key (for evaluations and coaching)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/Project_Quasar.git
cd Project_Quasar

# Backend
cd quasar-backend
npm install

# Frontend
cd ../quasar-frontend
npm install
```

### 2. Configure Environment

Create `quasar-backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quasar
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# AI
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key

# Storage (MinIO)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=quasar-resumes

# Email (for agent notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Interview Quasar <noreply@quasar.ai>

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

FRONTEND_URL=http://localhost:5173
```

### 3. Run

```bash
# Terminal 1 — Backend
cd quasar-backend
npm run dev

# Terminal 2 — Frontend
cd quasar-frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🔑 API Overview

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/google` | Google OAuth |
| GET | `/api/auth/github` | GitHub OAuth |

### Candidate
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sessions/start` | Start interview session |
| POST | `/api/sessions/:id/evaluate` | Evaluate transcript (STAR + category scoring) |
| GET | `/api/sessions/:id/report` | Download PDF report |
| POST | `/api/coach/chat` | AI career coach (SSE stream) |
| GET | `/api/candidate/jobs` | Browse published jobs |
| POST | `/api/candidate/jobs/:id/apply` | Apply with resume |

### Recruiter
| Method | Endpoint | Description |
|---|---|---|
| CRUD | `/api/recruiter/jobs` | Job posting management |
| GET | `/api/recruiter/jobs/:id/applicants` | View applicant pipeline |
| POST | `/api/recruiter/jobs/:id/mcqs/generate` | AI-generate MCQ questions from JD |

### Autonomous Agent
| Method | Endpoint | Description |
|---|---|---|
| PUT | `/api/recruiter/agent/:jobId/config` | Configure agent goals & thresholds |
| POST | `/api/recruiter/agent/:jobId/start` | Activate agent |
| POST | `/api/recruiter/agent/:jobId/pause` | Pause agent |
| GET | `/api/recruiter/agent/:jobId/events` | Activity feed (paginated) |
| GET | `/api/recruiter/agent/:jobId/events/escalations` | Pending escalations |
| POST | `/api/recruiter/agent/:jobId/events/:eventId/resolve` | Resolve escalation (advance/reject) |

---

## 👥 Team

| Name | Role |
|---|---|
| Surendra Singh Chouhan | Backend Developer |
| Yadveer Singh Pawar | Full-Stack Developer |
| Ratan Tiwari | Full-Stack Developer |
| Uday Khare | Backend Developer & DeveOps Engineer |

---

<p align="center"><sub>Built with 🧡 for innovation — powered by Gemini, driven by purpose.</sub></p>
