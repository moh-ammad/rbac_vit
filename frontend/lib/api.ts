// Tiny fetch wrapper. The session is an httpOnly cookie set by the API, so
// nothing is stored in localStorage/sessionStorage — the browser just sends
// the cookie along with every same-origin /api request.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    if (response.status === 401 && path !== "/me" && !path.startsWith("/auth/") && typeof window !== "undefined") {
      window.location.replace("/login");
    }
    throw new ApiError(response.status, data?.error ?? "Something went wrong. Please try again.");
  }
  return data as T;
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

/** Builds "?a=1&b=2", skipping empty values. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
}
