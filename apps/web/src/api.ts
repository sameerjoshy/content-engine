export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: string,
  ) {
    super(message);
  }
}

let _token: string | null = null;
export function setApiToken(token: string | null) {
  _token = token;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (_token) headers.Authorization = `Bearer ${_token}`;

  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let details: string | undefined;
    try {
      const data = (await res.json()) as { error?: string; details?: string };
      msg = data.error ?? msg;
      details = data.details;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status, details);
  }
  return (await res.json()) as T;
}