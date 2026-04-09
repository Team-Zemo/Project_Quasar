// Auth state module — persisted in-memory (not localStorage per spec)

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  hasPassword?: boolean;
  linkedProviders?: string[];
  role?: 'candidate' | 'recruiter' | null;
  profileComplete?: boolean;
  phone?: string | null;
  headline?: string | null;
  location?: string | null;
  company?: string | null;
  designation?: string | null;
  companyWebsite?: string | null;
  skills?: string[];
  experience?: number | null;
  resumeKey?: string | null;
  resumeFilename?: string | null;
  resumeUploadedAt?: string | null;
}

/**
 * Observable auth state singleton.
 * Follows the same pattern as Firebase Auth's onAuthStateChanged /
 * Supabase's onAuthStateChange — a single source of truth that all
 * consumers (hooks, interceptors) subscribe to.
 */
type AuthSnapshot = { user: User | null; ready: boolean };
type AuthListener = (snapshot: AuthSnapshot) => void;

let _user: User | null = null;
let _ready = false;
let _initPromise: Promise<void> | null = null;
const _listeners: Set<AuthListener> = new Set();

// Cached snapshot — must return the SAME reference when unchanged.
// useSyncExternalStore compares with Object.is; new objects trigger infinite loops.
let _snapshot: AuthSnapshot = { user: null, ready: false };

function _updateSnapshot() {
  _snapshot = { user: _user, ready: _ready };
}

function _notify() {
  _updateSnapshot();
  _listeners.forEach(fn => fn(_snapshot));
}

export const authState = {
  /** Current snapshot (returns stable reference) */
  getSnapshot(): AuthSnapshot {
    return _snapshot;
  },

  getUser(): User | null {
    return _user;
  },

  isReady(): boolean {
    return _ready;
  },

  setUser(user: User | null) {
    _user = user;
    _notify();
  },

  /** Mark initialization complete — called once after the first refresh attempt */
  setReady() {
    if (!_ready) {
      _ready = true;
      _notify();
    }
  },

  subscribe(listener: AuthListener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  /**
   * Initialize auth state by attempting a silent token refresh.
   * Idempotent: calling this multiple times returns the same promise.
   * This is the ONLY place that fires the initial /auth/refresh.
   */
  init(): Promise<void> {
    if (_initPromise) return _initPromise;

    _initPromise = _doRefresh()
      .catch(() => { _user = null; })
      .finally(() => {
        _ready = true;
        _notify();
      });

    return _initPromise;
  },
};

// API helpers
const BASE = '';

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

export async function register(email: string, password: string, name: string) {
  const res = await apiFetch(`${BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  const json = await res.json();
  if (json.success && json.data) authState.setUser(json.data);
  return json as { success: boolean; message: string; data: User | null };
}

export async function login(email: string, password: string) {
  const res = await apiFetch(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (json.success && json.data) authState.setUser(json.data);
  return json as { success: boolean; message: string; data: User | null };
}

/**
 * Refresh the session. Handles two scenarios:
 * 1. Initial page load → delegates to authState.init() (idempotent)
 * 2. Mid-session 401 → fires a fresh refresh with its own dedup
 */
let _midSessionRefresh: Promise<User | null> | null = null;

export async function refreshSession(): Promise<User | null> {
  // If auth hasn't initialized yet, init first (idempotent)
  if (!authState.isReady()) {
    await authState.init();
    return authState.getUser();
  }

  // Mid-session refresh — dedup concurrent calls but allow new refreshes
  if (_midSessionRefresh) return _midSessionRefresh;
  _midSessionRefresh = _doRefresh().finally(() => { _midSessionRefresh = null; });
  return _midSessionRefresh;
}

async function _doRefresh(): Promise<User | null> {
  try {
    const res = await apiFetch(`${BASE}/auth/refresh`, { method: 'POST' });
    const json = await res.json();
    if (json.success && json.data) {
      authState.setUser(json.data);
      return json.data;
    }
    authState.setUser(null);
    return null;
  } catch {
    authState.setUser(null);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch(`${BASE}/auth/logout`, { method: 'POST' });
  } finally {
    authState.setUser(null);
  }
}

export async function fetchMe(): Promise<User | null> {
  try {
    const res = await apiFetch(`${BASE}/auth/me`);
    const json = await res.json();
    if (json.success && json.data) {
      authState.setUser(json.data);
      return json.data;
    }
    return null;
  } catch {
    return null;
  }
}

/** Fetch full profile (email, hasPassword, linkedProviders) without mutating authState */
export async function fetchProfile(): Promise<User | null> {
  try {
    const res = await apiFetch(`${BASE}/auth/me`);
    const json = await res.json();
    return json.success && json.data ? json.data : null;
  } catch {
    return null;
  }
}

export async function forgotPassword(email: string) {
  const res = await apiFetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return res.json() as Promise<{ success: boolean; message: string; data: null }>;
}

export async function resetPassword(token: string, password: string) {
  const res = await apiFetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
  return res.json() as Promise<{ success: boolean; message: string; data: null }>;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await apiFetch(`${BASE}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.json() as Promise<{ success: boolean; message: string; data: null }>;
}
