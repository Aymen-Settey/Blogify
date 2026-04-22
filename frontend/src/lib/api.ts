const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ApiError {
  status: number;
  detail: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = "Request failed";
    try {
      const data = await res.json();
      detail = normalizeDetail(data.detail) || detail;
    } catch {
      /* ignore */
    }
    throw { status: res.status, detail } as ApiError;
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

export async function uploadFile<T = { url: string }>(
  path: string,
  file: File
): Promise<T> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw { status: res.status, detail: normalizeDetail(data.detail) || "Upload failed" } as ApiError;
  }
  return res.json();
}

export { API_URL };

/**
 * FastAPI returns `detail` as a string for HTTPException but as an array of
 * validation error objects for 422 responses. Normalize both shapes into a
 * human-readable string.
 */
function normalizeDetail(detail: unknown): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        if (typeof e === "string") return e;
        if (e && typeof e === "object" && "msg" in e) {
          const err = e as { msg: string; loc?: (string | number)[] };
          const field =
            Array.isArray(err.loc) && err.loc.length > 1
              ? String(err.loc[err.loc.length - 1])
              : "";
          return field ? `${field}: ${err.msg}` : err.msg;
        }
        return JSON.stringify(e);
      })
      .join("; ");
  }
  if (typeof detail === "object") return JSON.stringify(detail);
  return String(detail);
}
