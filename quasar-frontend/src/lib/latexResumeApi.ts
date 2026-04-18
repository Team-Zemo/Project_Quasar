/**
 * LaTeX Resume API helpers
 */

const apiFetch = (url: string, opts: RequestInit = {}) =>
  fetch(url, { ...opts, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  preview: string;
}

export interface SavedResume {
  _id: string;
  name: string;
  templateId: string;
  isDefault: boolean;
  compiledAt: string | null;
  createdAt: string;
  updatedAt: string;
  latexSource?: string;
}

export async function fetchTemplates(): Promise<{ templates: TemplateInfo[]; pdflatexAvailable: boolean }> {
  const res = await apiFetch('/api/latex-resume/templates');
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function fetchTemplateSkeleton(id: string): Promise<string> {
  const res = await apiFetch(`/api/latex-resume/templates/${id}/skeleton`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data.skeleton;
}

export async function transformResume(templateId: string): Promise<string> {
  const res = await apiFetch('/api/latex-resume/transform', {
    method: 'POST',
    body: JSON.stringify({ templateId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data.latexSource;
}

export async function listResumes(): Promise<SavedResume[]> {
  const res = await apiFetch('/api/latex-resume');
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data.resumes;
}

export async function getResume(id: string): Promise<SavedResume> {
  const res = await apiFetch(`/api/latex-resume/${id}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data.resume;
}

export async function createResume(data: { name: string; templateId: string; latexSource: string }): Promise<SavedResume> {
  const res = await apiFetch('/api/latex-resume', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data.resume;
}

export async function updateResume(id: string, data: { name?: string; latexSource?: string }): Promise<SavedResume> {
  const res = await apiFetch(`/api/latex-resume/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data.resume;
}

export async function deleteResume(id: string): Promise<void> {
  const res = await apiFetch(`/api/latex-resume/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
}

export async function setDefaultResume(id: string): Promise<void> {
  const res = await apiFetch(`/api/latex-resume/${id}/default`, { method: 'PUT' });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
}

export async function compileResumePdf(id: string): Promise<Blob> {
  const res = await fetch(`/api/latex-resume/${id}/compile`, { method: 'POST', credentials: 'include' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({ message: 'Compilation failed' }));
    throw new Error(json.message || 'Compilation failed');
  }
  return res.blob();
}

export async function compileRawLatex(latexSource: string): Promise<Blob> {
  const res = await fetch('/api/latex-resume/compile-raw', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latexSource }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({ message: 'Compilation failed' }));
    throw new Error(json.message || 'Compilation failed');
  }
  return res.blob();
}
