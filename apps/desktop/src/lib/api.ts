const base = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export type ApiError = { error: string; hint?: string };

export async function api<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = body as ApiError;
    throw new Error(err?.error ?? res.statusText);
  }
  return body as T;
}

export function connectRealtime(query: Record<string, string>): WebSocket {
  const root = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";
  const u = new URL(root);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/realtime";
  u.search = new URLSearchParams(query).toString();
  return new WebSocket(u.toString());
}
