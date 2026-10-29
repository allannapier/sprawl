// GET  /api/scores?board=daily&seed=YYYY-MM-DD   -> { top, total }
// GET  /api/scores?board=random                  -> { top, total }
// POST /api/scores {name,score,week,seed,daily,t,houses} -> { id, rank, total, top }

const WEEK = 45;          // game seconds per week, must match the client
const MAX_LEVEL = 3;      // max home level, each level scores 1 point per second when happy
const TOP = 10;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const utcDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10);

function boardFilter(daily, seed) {
  return daily ? { where: 'daily = 1 AND seed = ?', args: [seed] } : { where: 'daily = 0', args: [] };
}

async function board(db, daily, seed) {
  const { where, args } = boardFilter(daily, seed);
  const [top, total] = await db.batch([
    db.prepare(`SELECT id, name, score, week FROM scores WHERE ${where} ORDER BY score DESC, id ASC LIMIT ?`).bind(...args, TOP),
    db.prepare(`SELECT COUNT(*) AS n FROM scores WHERE ${where}`).bind(...args),
  ]);
  return { top: top.results, total: total.results[0].n };
}

async function hashIp(ip, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const daily = url.searchParams.get('board') !== 'random';
  const seed = url.searchParams.get('seed') || utcDay();
  if (daily && !/^\d{4}-\d{2}-\d{2}$/.test(seed)) return json({ error: 'Unknown map.' }, 400);
  return json(await board(env.DB, daily, seed));
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  const name = String(b.name ?? '').replace(/[^\p{L}\p{N} _.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const score = Math.floor(Number(b.score));
  const week = Math.floor(Number(b.week));
  const t = Math.round(Number(b.t));
  const houses = Math.floor(Number(b.houses));
  const daily = b.daily === true;
  const seed = String(b.seed ?? '').slice(0, 40);

  if (!name) return json({ error: 'Pick a name with some letters or numbers in it.' }, 400);
  if (![score, week, t, houses].every(Number.isFinite) || score < 1 || week < 1 || week > 500 || t < 0 || houses < 0 || houses > 2000)
    return json({ error: "That score doesn't add up." }, 400);

  // Plausibility: game time must match the week reached, and points can't
  // outpace every home being happy at max level the whole time.
  if (t > week * WEEK + 3 || t < (week - 1) * WEEK - 3) return json({ error: "That score doesn't add up." }, 400);
  if (score > t * houses * MAX_LEVEL + 50) return json({ error: "That score doesn't add up." }, 400);

  if (daily && ![utcDay(-1), utcDay(), utcDay(1)].includes(seed))
    return json({ error: "That day's map has closed. Play today's map to get on the board." }, 400);

  const ip = await hashIp(request.headers.get('CF-Connecting-IP') || 'local', env.IP_SALT || 'sprawl');
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM scores WHERE ip = ? AND created_at > datetime('now', '-20 seconds')"
  ).bind(ip).first('n');
  if (recent > 0) return json({ error: 'Slow down a moment, then try again.' }, 429);

  const row = await env.DB.prepare(
    'INSERT INTO scores (name, score, week, seed, daily, t, houses, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).bind(name, score, week, daily ? seed : 'random', daily ? 1 : 0, t, houses, ip).first();

  const { where, args } = boardFilter(daily, seed);
  const better = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM scores WHERE ${where} AND (score > ? OR (score = ? AND id < ?))`
  ).bind(...args, score, score, row.id).first('n');

  return json({ id: row.id, rank: better + 1, ...(await board(env.DB, daily, seed)) });
}
