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
    } else if (b.media && typeof b.media.data === 'string') {
      const d = b.media.data, i = d.indexOf(',');
      const head = d.slice(5, i);
      if (i < 0 || !head.includes('base64')) return json(400, { ok: false });
      const mime = head.split(';')[0];
      const buf = Buffer.from(d.slice(i + 1), 'base64');
      if (!buf.length || buf.length > 5000000) return json(413, { ok: false });
      const photo = b.media.kind === 'photo';
      const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp'
        : mime.includes('mp4') ? 'm4a' : mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'bin';
      const fd = new FormData();
      fd.append('chat_id', C);
      fd.append('caption', String(b.media.caption || '').slice(0, 900));
      fd.append(photo ? 'photo' : 'document', new Blob([buf], { type: mime }), (photo ? 'photo.' : 'voice.') + ext);
      await fetch(api + (photo ? '/sendPhoto' : '/sendDocument'), { method: 'POST', body: fd });
    } else {
      return json(400, { ok: false });
    }
    return json(200, { ok: true });
  } catch {
    return json(502, { ok: false });
  }
};
