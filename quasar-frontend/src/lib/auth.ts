// Auth state module — persisted in-memory (not localStorage per spec)

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  hasPassword?: boolean;
  linkedProviders?: string[];
}

type AuthListener = (user: User | null) => void;

let currentUser: User | null = null;
const listeners: Set<AuthListener> = new Set();

function notify() {
  listeners.forEach(fn => fn(currentUser));
}

export const authState = {
  getUser(): User | null {
    return currentUser;
  },

  setUser(user: User | null) {
    currentUser = user;
    notify();
  },

  subscribe(listener: AuthListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
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

export async function refreshSession(): Promise<User | null> {
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
