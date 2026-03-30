// Centralized API helper with credential-inclusive fetch

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; message: string; data: T }> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json();
  }

  // Non-JSON response (e.g., PDF)
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

export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
