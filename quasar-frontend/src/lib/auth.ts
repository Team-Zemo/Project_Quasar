// Auth state module — persisted in-memory (not localStorage per spec)

export interface User {
  id: string;
  email: string;
  name: string;
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

export async function register(email: string, password: string, name: string): Promise<{ success: boolean; message: string; data: User | null }> {
  const res = await apiFetch(`${BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  const json = await res.json();
  if (json.success && json.data) {
    authState.setUser(json.data);
  }
  return json;
}

export async function login(email: string, password: string): Promise<{ success: boolean; message: string; data: User | null }> {
  const res = await apiFetch(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (json.success && json.data) {
    authState.setUser(json.data);
  }
  return json;
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
