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

  const h = event.headers || {};
  const origin = h.origin || h.referer || '';
  const host = (h['x-forwarded-host'] || h.host || '').toLowerCase();
  if (origin && host) {
    try { if (new URL(origin).host.toLowerCase() !== host) return json(403, { ok: false }); }
    catch { return json(403, { ok: false }); }
  }

  const now = Date.now();
  while (hits.length && now - hits[0] > 60000) hits.shift();
  if (hits.length >= 60) return json(429, { ok: false });
  hits.push(now);

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false }); }

  const api = 'https://api.telegram.org/bot' + T;
  try {
    if (typeof b.text === 'string' && b.text) {
      await fetch(api + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: C, text: b.text.slice(0, 3900) })
      });
    } else if (b.file && typeof b.file.content === 'string') {
      const fd = new FormData();
      fd.append('chat_id', C);
      fd.append('caption', String(b.file.caption || '').slice(0, 900));
      fd.append('document',
        new Blob([b.file.content.slice(0, 2000000)], { type: 'text/plain' }),
        String(b.file.name || 'chat.txt').replace(/[^\w.\-]/g, '_'));
      await fetch(api + '/sendDocument', { method: 'POST', body: fd });
    } else {
      return json(400, { ok: false });
    }
    return json(200, { ok: true });
  } catch {
    return json(502, { ok: false });
  }
};
