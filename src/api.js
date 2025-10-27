// src/api.js
const HOST = (typeof window !== "undefined" && window.__EUCLID_API_HOST__) || "https://euclid-be-production.up.railway.app/api";

export async function fetchBotConfig(botId) {
  const res = await fetch(`${HOST}/bots/${encodeURIComponent(botId)}`, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load bot config: ${res.status} ${text}`);
  }
  return res.json();
}

// Send a message to backend chat
export async function sendQuery({ botId, sessionId, message, authToken }) {
  const res = await fetch(`${HOST}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ botId, sessionId, message }),
  });

  // Try to parse JSON safely for better errors
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const err = (data && (data.error || data.message)) || `Status ${res.status}`;
    const status = res.status;
    const payload = data || null;
    const e = new Error(err);
    e.status = status;
    e.payload = payload;
    throw e;
  }
  return data || {};
}
