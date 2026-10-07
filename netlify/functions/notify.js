// Sends Telegram alerts for the Truth or Dare game.
// The bot token and chat id live in Netlify environment variables (TG_TOKEN, TG_CHAT), never in the page.
const hits = [];

exports.handler = async (event) => {
  const json = (code, body) => ({
    statusCode: code,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (event.httpMethod !== 'POST') return json(405, { ok: false });

  const T = process.env.TG_TOKEN, C = process.env.TG_CHAT;
  if (!T || !C) return json(500, { ok: false, error: 'not configured' });

  // Only accept calls coming from this same site
  const h = event.headers || {};
  const origin = h.origin || h.referer || '';
  const host = (h['x-forwarded-host'] || h.host || '').toLowerCase();
  if (origin && host) {
    try { if (new URL(origin).host.toLowerCase() !== host) return json(403, { ok: false }); }
    catch { return json(403, { ok: false }); }
  }

  // Simple limit: 60 alerts per minute
  const now = Date.now();
  while (hits.length && now - hits[0] > 60000) hits.shift();
  if (hits.length >= 60) return json(429, { ok: false });
  hits.push(now);

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false }); }
