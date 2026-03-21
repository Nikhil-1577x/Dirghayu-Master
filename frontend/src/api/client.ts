/**
 * API client for Smart Medication Adherence System backend.
 *
 * - If `VITE_API_URL` is set → use it (no trailing slash).
 * - In **development** with empty env → call `http://127.0.0.1:8000` directly so
 *   `/api/chat`, WebSockets, etc. never hit Vite’s SPA fallback (HTML → “not valid JSON”).
 * - In **production** with empty env → same-origin (e.g. FastAPI serves `dist`).
 */
function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';
  if (raw) return raw.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://127.0.0.1:8000';
  return '';
}

export const API_BASE = resolveApiBase();

/** For user-facing errors (e.g. chat troubleshooting). */
export function getApiBaseUrl(): string {
  return API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
}

export class ApiError extends Error {
  status: number;
  url: string;
  bodyText?: string;
  bodyJson?: unknown;

  constructor(message: string, args: { status: number; url: string; bodyText?: string; bodyJson?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = args.status;
    this.url = args.url;
    this.bodyText = args.bodyText;
    this.bodyJson = args.bodyJson;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string | number> }
): Promise<T> {
  const { params, ...init } = options ?? {};
  let url = `${API_BASE}${path}`;
  if (params) {
    const search = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    url += (url.includes('?') ? '&' : '?') + search;
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const bodyText = await res.text().catch(() => '');

  if (!res.ok) {
    let bodyJson: unknown = undefined;
    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      bodyJson = undefined;
    }
    const detail =
      (bodyJson as any)?.detail ??
      (bodyJson as any)?.error?.message ??
      res.statusText ??
      `Request failed: ${res.status}`;
    throw new ApiError(String(detail), { status: res.status, url, bodyText, bodyJson });
  }

  if (res.status === 204) return undefined as T;

  const trimmed = bodyText.trimStart();
  if (trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<html')) {
    throw new ApiError(
      `API returned HTML instead of JSON (${url}). Restart FastAPI on port 8000 (needs /api/chat/history and /ws/chat), or set VITE_API_URL.`,
      { status: res.status, url, bodyText }
    );
  }

  try {
    return (bodyText ? JSON.parse(bodyText) : {}) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    throw new ApiError(`Invalid JSON from API: ${msg}`, { status: res.status, url, bodyText });
  }
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number>) =>
    request<T>(path, { method: 'GET', params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  upload: async <T>(path: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  },
};

export function getWsUrl(patientId: number): string {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  const wsProtocol = base.startsWith('https') ? 'wss' : 'ws';
  const host = base.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${host}/ws/${patientId}`;
}

/** Role-based chat participant id (must match Backend app.utils.chat_ids). */
export function getChatWsUrl(chatUserId: number): string {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  const wsProtocol = base.startsWith('https') ? 'wss' : 'ws';
  const host = base.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${host}/ws/chat/${chatUserId}`;
}
