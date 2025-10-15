// src/api.js
const DEFAULT_API_HOST = window.__EUCLID_API_HOST__ || 'https://api.yourdomain.com';

export async function fetchBotConfig(botId) {
  const res = await fetch(`${DEFAULT_API_HOST}/api/chatbot/config/${encodeURIComponent(botId)}`, {
    credentials: 'omit'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load bot config: ${res.status} ${text}`);
  }
  return res.json();
}

// send a message
export async function sendQuery({ botId, sessionId, message, authToken }) {
  const res = await fetch(`${DEFAULT_API_HOST}/api/chatbot/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify({ botId, sessionId, message })
  });

  if (!res.ok) {
    const j = await res.json().catch(() => null);
    const err = (j && j.error) ? j.error : `Status ${res.status}`;
    throw new Error(err);
  }
  return res.json();
}
