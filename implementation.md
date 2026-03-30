You are an expert full-stack engineer. You are working inside an existing AI interview platform with two folders:
- `quasar-frontend` — Vite JS, Tailwind CSS 
- `quasar-backend` — Node.js, Express, PostgreSQL, Mongoose for any MongoDB models

The platform already has a working core: the Gemini 3.1 Flash Live model conducts voice interviews with candidates in real time. Do NOT touch or break that core flow.

---

## YOUR TASK

Implement the following features end-to-end. For each feature, write production-quality code: clean, modular, no shortcuts. Do not explain what you are doing — just write the code. Do not scaffold boilerplate I didn't ask for.

---

## 1. AUTHENTICATION (Industry Standard)

Implement full auth for the platform:

- **Registration & Login** with email + password
- Passwords hashed with `bcrypt` (minimum 12 rounds)
- **JWT-based sessions**: access token (15min expiry) + refresh token (7 days), both stored as `httpOnly` `Secure` `SameSite=Strict` cookies — never in localStorage
- Refresh token rotation: on every refresh, invalidate old token, issue new one, persist hashed refresh tokens to DB with user binding
- **Google OAuth 2.0** via `passport-google-oauth20` — on first login create user record, on subsequent logins match by Google ID
- Auth middleware: `requireAuth` (blocks unauthenticated), `optionalAuth` (attaches user if present)
- Rate limiting on `/auth/*` routes: 10 requests/15min per IP using `express-rate-limit`
- All responses must never leak stack traces or internal errors — return standardised `{ success, message, data }` shape
- In `quasar-frontend`: persist auth state in a JS module (not localStorage). On app load, silently call `/auth/refresh` to restore session. Protect routes — redirect to `/login` if unauthenticated.

---

## 2. LIVE EMOTION & CONFIDENCE ANALYSER

**Frontend only** (`quasar-frontend`). No server calls during analysis.

- Load `face-api.js` from CDN during the interview session
- Load models: `tinyFaceDetector`, `faceExpressionNet`, `faceLandmark68Net` — from a `/models` static path or CDN
- Start webcam stream with `getUserMedia`. Run detection every **500ms** using `requestAnimationFrame` or `setInterval`
- From each detection frame, extract:
  - **Confidence score** (0–100): weighted composite of `happy` + `neutral` expressions minus `fearful` + `surprised`
  - **Nervousness indicator**: rolling 5-second average of micro-expression variance (rapid fluctuation across `fearful`, `surprised`, `disgusted`)
  - **Eye contact proxy**: face detected + landmark nose/eye alignment within centre 60% of video frame = good eye contact
- Render three live gauges on the interview UI using plain CSS/SVG — no chart library needed here:
  - Confidence meter (vertical bar)
  - Nervousness level (colour-coded pill: green/amber/red)
  - Eye contact indicator (dot: on/off)
- Collect per-second snapshots into a session array `[{ t, confidence, nervousness, eyeContact }]`
- On session end, POST this array to `/api/sessions/:sessionId/emotion-metrics` — backend stores it in PostgreSQL as a JSONB column

---

## 3. FILLER WORD & SPEECH PATTERN DETECTOR

**Frontend** (`quasar-frontend`):

- Use the `webkitSpeechRecognition` / `SpeechRecognition` API in `continuous` + `interimResults` mode
- On each `onresult` event, run a regex against the full rolling transcript:
```js
  const FILLERS = /\b(um+|uh+|like|you know|basically|literally|actually|so+|right\?|okay so|i mean)\b/gi;
```
- Show a **live filler counter** on the interview UI: "Fillers: 7 (2.3/min)"
- After session ends, segment the transcript into 10-second buckets. Count fillers per bucket. Send to backend.

**Backend** (`quasar-backend`):

- `POST /api/sessions/:sessionId/speech-metrics` — accepts `{ transcript: string, fillerBuckets: [{t, count}], totalFillers: number, wordsPerMinute: number }`
- Store in a `speech_metrics` table linked to session
- `GET /api/sessions/:sessionId/speech-metrics` — returns data for post-session heatmap rendering

**Frontend post-session heatmap**:

- Render a horizontal timeline bar divided into 10-second segments
- Colour each segment by filler density: white → light amber → deep red
- Label peak segments with the actual filler words used

---

## 4. INTERVIEWER PERSONA SYSTEM

**Backend** (`quasar-backend`):

- Create a `personas` table (or seed JSON) with these 4 personas. Each has: `id`, `name`, `description`, `systemPrompt`, `interruptionStyle`, `followUpAggression` (1–5)

Persona system prompts:

**FAANG Engineer**
```
You are a senior Staff Engineer at Google conducting a structured behavioural and system design interview. Ask one question at a time. Follow up with "Tell me more about X" or "How would you scale that?". Expect STAR-format answers. Be professional, methodical, and technically exacting. If the candidate is vague, press for specifics. Never accept the first answer — always probe one level deeper.
```

**Aggressive Startup Founder**
```
You are a Series A startup founder conducting a high-pressure interview. You have 20 minutes and zero tolerance for fluff. Interrupt if the candidate is rambling. Ask things like "Why should I hire you over someone with 5 more years?", "That sounds like something everyone says — what's actually unique about you?", "We move fast — give me evidence you can too." Be blunt, impatient, and direct. Challenge every claim.
```

**HR Manager**
```
You are an HR Manager focused on culture fit, values alignment, and soft skills. Ask about teamwork, conflict resolution, growth mindset, and how the candidate handles failure. Use open-ended questions. Be warm but probing. Follow up vague answers with "Can you walk me through a specific example?" Avoid technical questions entirely.
```

**Hostile Panel**
```
You are a panel of three interviewers. One is technical and skeptical, one is focused on leadership, one is challenging every answer for consistency. Rotate perspectives in your responses. Create mild pressure and contradictions: "Our technical interviewer thinks your answer lacks depth, but our leadership interviewer liked the people angle — can you address both?" Make the candidate work harder to satisfy multiple viewpoints simultaneously.
```

- `GET /api/personas` — returns list for the frontend persona selector
- When creating a session, accept `personaId` in the request body. Store on the session record. Inject the persona's `systemPrompt` as the system instruction to the Gemini Live model at session initialisation.

**Frontend** (`quasar-frontend`):

- Before starting a session, show a persona selector: 4 cards with name, description, aggression level indicator (dots 1–5). Selected persona card gets a highlight border.
- Pass selected `personaId` to the session creation API call.

---

## 5. JOB DESCRIPTION PARSER → CUSTOM QUESTION BANK

**Backend** (`quasar-backend`):

- `POST /api/jd/parse` — accepts `{ jobDescription: string, userId }`
- Call the Gemini API (text, not live) with this prompt structure:
```
  You are an expert technical recruiter. Analyse this job description and return ONLY valid JSON (no markdown) in this exact schema:
  {
    "role": string,
    "seniority": "junior" | "mid" | "senior" | "staff" | "principal",
    "domain": string,
    "requiredSkills": string[],
    "niceToHaveSkills": string[],
    "culturalSignals": string[],
    "generatedQuestions": [
      {
        "question": string,
        "category": "behavioural" | "technical" | "system-design" | "culture-fit",
        "difficulty": 1 | 2 | 3,
        "targetSkill": string,
        "weight": number  // 0.0–1.0, higher = more important for this role
      }
    ]
  }
  Generate exactly 20 questions, weighted by importance to the role.
  Job Description: {{JD_TEXT}}
```
- Parse the JSON response. Store the question bank linked to the user + a `jd_sessions` record.
- `GET /api/jd/:jdSessionId/questions` — returns the question list ordered by weight desc

**Frontend** (`quasar-frontend`):

- Add a "Paste Job Description" step before session start (after persona selection)
- Show a textarea + "Parse JD" button. On success, show extracted role/skills as tags and a preview of top 5 generated questions
- User confirms → session starts using this custom question bank instead of the default pack

---

## 6. PROGRESS TRACKER ACROSS SESSIONS

**Backend** (`quasar-backend`):

- `GET /api/users/:userId/progress` — aggregates across all completed sessions for this user:
```json
  {
    "sessions": [
      {
        "sessionId": "uuid",
        "date": "ISO string",
        "overallScore": 7.2,
        "starScores": { "situation": 8, "task": 6, "action": 7, "result": 5 },
        "clarityScore": 6,
        "fillerRate": 3.2,
        "confidenceAvg": 71
      }
    ],
    "improvement": {
      "clarityDelta": "+2.1 over last 5 sessions",
      "strongestDimension": "action",
      "weakestDimension": "result"
    }
  }
```

**Frontend** (`quasar-frontend`):

- Dedicated `/progress` dashboard page
- Use **Chart.js** (load from CDN). Render:
  1. **Line chart** — Overall score over time (x = session date, y = 0–10)
  2. **Multi-line chart** — Each STAR dimension as a separate line across sessions
  3. **Bar chart** — Filler word rate per session (lower = better, colour accordingly)
  4. **Single stat cards** — Current confidence avg, strongest dimension, weakest dimension, total sessions
- All charts responsive, respect dark mode via Chart.js theming

---

## 7. ADAPTIVE DIFFICULTY ENGINE

**Backend** (`quasar-backend`):

Implement a `skill_vectors` table per user:
```
userId, skill (varchar), score (float, 0–10), lastUpdated, attemptCount
```

Skills tracked: `communication`, `technical_depth`, `leadership`, `problem_structuring`, `result_orientation`, `culture_fit`

After each session answer is scored:
- `POST /api/users/:userId/skill-vector/update` — accepts `{ sessionId, starScores, categoryScores }`
- Update each skill using exponential moving average: `newScore = 0.7 * oldScore + 0.3 * latestScore`
- Map STAR dimensions → skills: Result → `result_orientation`, Task → `problem_structuring`, etc.

Question selection logic (`GET /api/sessions/:sessionId/next-question`):
- Fetch user's skill vector
- Find the 2 lowest-scoring skills
- Filter question bank for questions targeting those skills
- Apply spaced repetition: questions with `lastAttempted` > 3 sessions ago AND score < 6 get priority boost
- Return the top-priority question with `{ question, difficulty, targetSkill, reason }`

---



## 8. PDF REPORT CARD EXPORT

**Backend** (`quasar-backend`):

- Install `pdfkit` (not iText — this is Node.js)
- `GET /api/sessions/:sessionId/report` — generates and streams a PDF report

The PDF must include (in order):
1. **Header**: Platform name "Quasar Interview" + candidate name + date + session duration + persona used
2. **Overall Score**: Large number (e.g. 7.4/10) + pass/fail verdict based on threshold (≥6.5 = Pass)
3. **STAR Breakdown table**: 7 rows (Situation, Task, Action, Result, Clarity, Conciseness, Domain Knowledge), each with score bar (filled rectangle proportional to score/10)
4. **Speech Analysis section**: Total filler words, filler rate/min, words per minute, top 3 most used fillers
5. **Confidence Analysis section**: Average confidence score, peak confidence moment (timestamp), lowest confidence moment
6. **Session Transcript**: Full transcript in monospace font, with filler words visually marked (prefix with [*])
7. **Personalised Action Plan**: 3 bullet points generated by calling Gemini API with the session scores — "Based on your scores, focus on: ..."
8. **Footer**: "Generated by Quasar Interview Platform" + timestamp

Stream the PDF directly as response with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="interview-report-{sessionId}.pdf"`

**Frontend** (`quasar-frontend`):

- On the post-session results page, add a "Download Report" button
- On click, hit the `/api/sessions/:sessionId/report` endpoint and trigger browser file download


A few things I deliberately did in this prompt that matter:
The PDF section switches from iText/PDFBox to pdfkit because this is Node.js, not Java — that correction matters or you'd get broken code. The Gemini API is used consistently throughout (not Claude) since that's your existing integration. Auth is specified at the implementation level — cookie strategy, rotation logic, rate limits — not just "add JWT auth." And the question packs are fully written out so the AI doesn't invent them, it just seeds them.