
const API_BASE = "https://zainab-club-api.onrender.com/api";

async function apiRequest(path, options = {}) {
  // Support paths with or without a leading slash.
  const cleanPath = path.startsWith("/") ? path : "/" + path;
  const response = await fetch(API_BASE + cleanPath, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || payload.ok === false) {
    const message =
      payload?.error?.message ||
      "The server could not complete that request.";

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload.data;
}

window.apiRequest = apiRequest;
