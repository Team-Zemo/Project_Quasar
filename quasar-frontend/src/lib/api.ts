import { refreshSession } from './auth';
import type { User } from './auth';

let refreshPromise: Promise<User | null> | null = null;

export async function apiFetchRaw(
  url: string,
  options: RequestInit & { _retry?: boolean } = {}
): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  let res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && !options._retry) {
    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => refreshPromise = null);
    }
    const user = await refreshPromise;
    if (user) {
      res = await fetch(url, {
        ...options,
        _retry: true,
        credentials: 'include',
        headers,
      } as RequestInit);
    }
  }

  return res;
}

export async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<{ success: boolean; message: string; data: T }> {
  const res = await apiFetchRaw(url, options);

  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json();
  }

  throw new Error(`Unexpected response type: ${res.headers.get('content-type')}`);
}

export async function apiGet<T = unknown>(url: string): Promise<{ success: boolean; message: string; data: T }> {
  return apiFetch<T>(url, { method: 'GET' });
}

export async function apiPost<T = unknown>(url: string, body: unknown): Promise<{ success: boolean; message: string; data: T }> {
  return apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiPut<T = unknown>(url: string, body: unknown): Promise<{ success: boolean; message: string; data: T }> {
  return apiFetch<T>(url, { method: 'PUT', body: JSON.stringify(body) });
}

export async function apiDelete<T = unknown>(url: string): Promise<{ success: boolean; message: string; data: T }> {
  return apiFetch<T>(url, { method: 'DELETE' });
}

export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

