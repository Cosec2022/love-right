const STORAGE_KEY = "love-right-commercial-session-v1";

export function loadSession() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return value?.token && value?.user ? value : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  if (!session) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

async function request(path, options = {}) {
  const session = loadSession();
  const headers = new Headers(options.headers ?? {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (session?.token) headers.set("authorization", `Bearer ${session.token}`);
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error ?? `请求失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const commercialApi = Object.freeze({
  login: (loveId, nickname) => request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ loveId, nickname })
  }),
  me: () => request("/api/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  ranking: () => request("/api/stories/ranking"),
  profile: () => request("/api/profile"),
  saveCompletion: (completion) => request("/api/completions", {
    method: "POST",
    body: JSON.stringify(completion)
  }),
  myVote: (storyId) => request(`/api/votes/${encodeURIComponent(storyId)}`),
  vote: (storyId, vote) => request(`/api/votes/${encodeURIComponent(storyId)}`, {
    method: "PUT",
    body: JSON.stringify({ vote })
  }),
  config: () => request("/api/config")
});
