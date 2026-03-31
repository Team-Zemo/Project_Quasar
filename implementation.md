# Gamification Frontend — Generation Guide

> Hand this document to an implementation agent.  
> Backend is fully live — do NOT modify any backend files.

---

## 1. New API Endpoints (all require cookie auth)

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/users/:userId/stats` | Full XP / level / streak profile |
| `GET` | `/api/users/:userId/badges` | Full badge catalogue (locked + unlocked) |

`userId` = the authenticated user's ID (available in the auth context as `user.id`).

---

## 2. API Shapes

### `GET /api/users/:userId/stats`
```ts
interface UserStats {
  xp:                number;       // total XP earned
  level:             number;       // 1-10
  xpToNextLevel:     number | null; // null at max level
  currentStreak:     number;       // days
  longestStreak:     number;
  lastPracticeDate:  string | null; // "YYYY-MM-DD" UTC
  totalSessions:     number;
  badges:            EarnedBadge[];
  domainsPlayed:     string[];
  personasUsed:      string[];
  jdsParsed:         number;
  resumeComparesRun: number;
}
```

### `GET /api/users/:userId/badges`
```ts
interface BadgeCatalogueResponse {
  earned: number;  // count of unlocked badges
  total:  number;  // 25
  badges: BadgeEntry[];
}

interface BadgeEntry {
  id:          string;
  name:        string;
  description: string;
  icon:        string;   // emoji
  unlocked:    boolean;
  unlockedAt:  string | null; // ISO date
}
```

### Gamification block appended to `POST /api/sessions/:sessionId/evaluate`
```ts
interface GamificationResult {
  xpEarned:      number;
  xpBreakdown:   { event: string; xp: number }[];
  totalXp:       number;
  level:         number;
  levelUp:       boolean;
  currentStreak: number;
  longestStreak: number;
  newBadges:     { id: string; name: string; icon: string }[];
}
// Evaluate response: data.gamification: GamificationResult | null
```

### `POST /api/resume/compare` — badge added to response
```ts
// data.newBadge: { id, name, icon, description } | null
// show toast if newBadge is present
```

---

## 3. Components to Build

### 3.1 `XPBar` — inline XP / level widget
**Used in:** TopNav (next to user avatar) and StatsPage header

```
╔══════════════════════════════════╗
║  Lvl 5  ▓▓▓▓▓▓▓░░░░  740/900    ║
╚══════════════════════════════════╝
```

**Props:**
```ts
interface XPBarProps {
  xp:           number;
  level:        number;
  xpToNext:     number | null;
  compact?:     boolean;  // true → show only in TopNav (smaller)
}
```

**Design:**
- Level displayed as pill badge `Lvl N` with accent colour gradient by tier:
  - 1-3: `#6b7280`  4-6: `#3b82f6`  7-9: `#f97316`  10: `#fbbf24` (gold)
- Progress bar: animated width fill, uses `--c-accent` → glowing effect
- Show `MAX` when `xpToNext` is null

---

### 3.2 `StreakWidget` — daily streak card
**Used in:** StatsPage and optionally Progress Dashboard

```
╔══════════════╗
║  🔥  7       ║
║  day streak  ║
║  Best: 12    ║
╚══════════════╝
```

**Props:**
```ts
interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
}
```

**Design:**
- Fire emoji pulses with CSS animation when streak ≥ 3
- Show "Practice today to keep your streak!" if `lastPracticeDate !== todayUTC`
- Convert `lastPracticeDate` UTC → local date display in the frontend (no backend changes)
- Background: subtle gradient from `rgba(249,115,22,0.08)` to `rgba(234,179,8,0.08)`

---

### 3.3 `BadgeGrid` — full badge catalogue page/panel
**Used in:** StatsPage (tab) and `/badges` route

Layout: responsive grid of badge cards, locked badges are greyscale with `filter: grayscale(1) opacity(0.4)`.

**Props:**
```ts
interface BadgeGridProps {
  badges: BadgeEntry[];
}
```

**Design per card:**
```
╔════════════════╗
║   🔥           ║  ← emoji (large, 36px)
║  On Fire       ║  ← name
║  3-day streak  ║  ← description (12px, muted)
║  Mar 31, 2026  ║  ← unlockedAt OR locked icon
╚════════════════╝
```
- Unlocked cards: coloured border glow matching badge category
- Badge categories by ID prefix for colour grouping:
  - `streak_*` → orange `#f97316`
  - `*_sessions`, `first_session`, `century` → blue `#3b82f6`
  - `*_pass`, `high_achiever`, `perfect_ten`, `comeback_kid` → green `#22c55e`
  - `level_*`, `xp_*` → gold `#fbbf24`
  - `domain_*`, `polymath` → purple `var(--c-purple)`
  - `no_fillers`, `speed_demon`, `slow_and_steady` → teal `#14b8a6`
  - `night_owl`, `early_bird`, `resume_checker`, `jd_parser`, `persona_collector` → pink `#ec4899`

---

### 3.4 `GamificationToast` — XP / badge notification
**Used in:** InterviewRoom (after evaluate completes) and ResumeComparePage

This is a transient notification that appears after a session is evaluated.  
Show for 6 seconds then fade out.

**Props:**
```ts
interface GamificationToastProps {
  gamification: GamificationResult;
  onClose: () => void;
}
```

**Design:**
```
╔═════════════════════════════════════════╗
║  ⚡ +80 XP earned      Level 5  →  6 ✓ ║
║  ──────────────────────────────────     ║
║  🏆 Badge Unlocked: Week Warrior ⚡     ║
║  📈 Badge Unlocked: First Step  🎯     ║
╚═════════════════════════════════════════╝
```
- Slide in from bottom-right
- Each XP breakdown shows on hover/expand (collapsible)
- Level-up gets a special animation: golden shimmer border
- Multiple badges: stack with small delay between each

---

### 3.5 `StatsPage` — full gamification dashboard
**Route:** `/stats`  
**Nav link:** Add `📊 Stats` link in TopNav (alongside Progress, Resume Check)

**Layout:**

```
┌─────── Header: XP card ──────────────────────┐
│  [XPBar large]   [StreakWidget]  [Sessions]   │
└───────────────────────────────────────────────┘
┌─────── Tabs ──────────────────────────────────┐
│  [ Overview ]  [ Badges ]  [ Activity ]       │
└───────────────────────────────────────────────┘
Tab: Overview
  ┌──────── Key Stats ────────────────────────┐
  │  Total Sessions  Domains  JDs Parsed  etc │
  └───────────────────────────────────────────┘
  ┌──────── Recent Badges ────────────────────┐
  │  last 4 unlocked badges, small cards      │
  └───────────────────────────────────────────┘

Tab: Badges
  <BadgeGrid> — all 25 badges

Tab: Activity
  Reuse existing ProgressDashboard session list
```

**Data fetching:** `GET /api/users/${user.id}/stats` and `GET /api/users/${user.id}/badges`

---

### 3.6 `LevelUpModal` — celebratory overlay
**Triggered when:** `gamification.levelUp === true` in evaluate response

```
╔═══════════════════════════════════╗
║         ⭐ LEVEL UP! ⭐            ║
║                                   ║
║     You reached Level 6           ║
║                                   ║
║    [ Continue Practicing ]        ║
╚═══════════════════════════════════╝
```
- Full-screen overlay with particle/confetti animation
- Auto-dismiss after 5s or on button click
- Golden gradient border, pulsing glow

---

## 4. Integration Points in Existing Code

### 4.1 `App.tsx`
Add to TopNav (after Resume Check link):
```tsx
<Link to="/stats" className="topnav__link">
  <svg>...</svg>
  Stats
</Link>
```

Add protected route:
```tsx
<Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
```

Add compact `XPBar` to the TopNav user section (next to avatar, only when authenticated):
```tsx
{user && <XPBar compact xp={stats.xp} level={stats.level} xpToNext={stats.xpToNextLevel} />}
```
Fetch stats once in `App.tsx` via a `useGamificationStats()` hook and pass down via context to avoid per-component fetching.

---

### 4.2 `InterviewRoom.tsx` / Evaluate flow
After the evaluate API call resolves, check:
```ts
if (result.data.gamification) {
  setGamification(result.data.gamification);  // triggers GamificationToast
  if (result.data.gamification.levelUp) setShowLevelUp(true);
}
```

---

### 4.3 `ResumeComparePage.tsx`
After compare resolves:
```ts
if (json.data.newBadge) {
  // show a small badge-unlock toast
}
```

---

### 4.4 `ProgressDashboard.tsx`
Add a `StreakWidget` and compact `XPBar` at the top of the dashboard above the chart.

---

## 5. New Hook: `useGamificationStats`

```ts
// src/hooks/useGamificationStats.ts
export function useGamificationStats(userId: string | undefined) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const res = await fetch(`/api/users/${userId}/stats`, { credentials: 'include' });
    const json = await res.json();
    if (json.success) setStats(json.data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, refresh };
}
```

Call `refresh()` after evaluate completes to update TopNav XP bar.

---

## 6. CSS Design Tokens (add to `index.css`)

No new CSS variables needed — use existing tokens:
- `--c-accent` (#f97316 orange) → XP bar, streak
- `--c-user` (#3b82f6 blue) → session milestones
- `--c-success` (#22c55e) → score badges
- `--c-purple` → domain badges
- `--c-error` (#ef4444) → locked state indicators

New animations to add:
```css
/* XP Bar fill */
@keyframes xp-fill { from { width: 0%; } to { width: var(--xp-pct); } }

/* Streak pulse */
@keyframes streak-pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.15); }
}

/* Toast slide-in */
@keyframes toast-slide-in {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

/* Level-up shimmer */
@keyframes level-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
```

---

## 7. Level → Colour Map (for XPBar pill)

```ts
const LEVEL_COLORS: Record<number, string> = {
  1: '#6b7280', 2: '#6b7280', 3: '#6b7280',  // grey
  4: '#3b82f6', 5: '#3b82f6', 6: '#3b82f6',  // blue
  7: '#f97316', 8: '#f97316', 9: '#f97316',  // orange
  10: '#fbbf24',                              // gold
};
```

---

## 8. XP Level Progress Table (for StatsPage display)

| Level | XP Required | XP to Next |
|-------|------------|------------|
| 1 | 0 | 100 |
| 2 | 100 | 150 |
| 3 | 250 | 250 |
| 4 | 500 | 400 |
| 5 | 900 | 500 |
| 6 | 1,400 | 600 |
| 7 | 2,000 | 800 |
| 8 | 2,800 | 1,000 |
| 9 | 3,800 | 1,200 |
| 10 | 5,000 | — |

---

## 9. Badge Category Map (25 badges)

```ts
const BADGE_CATEGORY: Record<string, string> = {
  first_session: 'milestone', ten_sessions: 'milestone',
  fifty_sessions: 'milestone', century: 'milestone',
  first_pass: 'score', high_achiever: 'score',
  perfect_ten: 'score', comeback_kid: 'score',
  streak_3: 'streak', streak_7: 'streak',
  streak_14: 'streak', streak_30: 'streak',
  domain_explorer: 'domain', polymath: 'domain',
  persona_collector: 'persona',
  no_fillers: 'speech', speed_demon: 'speech', slow_and_steady: 'speech',
  level_5: 'level', level_10: 'level', xp_500: 'level',
  night_owl: 'special', early_bird: 'special',
  resume_checker: 'feature', jd_parser: 'feature',
};
```

---

## 10. File Checklist

| File | Action |
|------|--------|
| `src/hooks/useGamificationStats.ts` | Create |
| `src/components/XPBar.tsx` | Create |
| `src/components/StreakWidget.tsx` | Create |
| `src/components/BadgeGrid.tsx` | Create |
| `src/components/GamificationToast.tsx` | Create |
| `src/components/LevelUpModal.tsx` | Create |
| `src/components/StatsPage.tsx` | Create |
| `src/App.tsx` | Add /stats route + nav link + compact XPBar in TopNav |
| `src/components/InterviewRoom.tsx` | Consume `gamification` from evaluate response |
| `src/components/ResumeComparePage.tsx` | Consume `newBadge` from compare response |
| `src/components/ProgressDashboard.tsx` | Add StreakWidget + compact XPBar at top |
| `src/index.css` | Add XP/toast/streak/level-up animations + stats page styles |
