// Cloudflare Pages Function: first-party analytics for the homepage red / blue pill easter egg.
//
// POST /api/pill            records one anonymous choice in the D1 database bound as TW_ANALYTICS.
// GET  /api/pill?health=1   setup check (binding, table, row count, whether the stats key is set). No visitor data.
// GET  /api/pill            aggregate stats, only for a browser unlocked for /rabbithole (cookie)
//                           or with the header  Authorization: Bearer <PILL_STATS_TOKEN>
//
// The dashboard that reads these stats lives at /rabbithole (functions/rabbithole.js). It is unlisted:
// without the unlock cookie it answers with the site's normal 404 page.
// The table is created on first use, so setup is: create a D1 database, bind it to the
// Pages project as TW_ANALYTICS, and add the secret PILL_STATS_TOKEN.

// D1's exec() reads one statement per line, so a multi-line CREATE TABLE fails there with
// "incomplete input". Each statement runs on its own through batch() instead.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pill_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    visitor_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    choice TEXT NOT NULL CHECK (choice IN ('red', 'blue')),
    first_visit INTEGER NOT NULL CHECK (first_visit IN (0, 1)),
    first_choice INTEGER NOT NULL CHECK (first_choice IN (0, 1)),
    elapsed_ms INTEGER,
    device TEXT,
    referrer_host TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    page TEXT NOT NULL DEFAULT '/',
    country TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE INDEX IF NOT EXISTS pill_events_visitor ON pill_events(visitor_id)',
  'CREATE INDEX IF NOT EXISTS pill_events_created ON pill_events(created_at)',
];

// Run the schema once per worker instance, not on every click.
let schemaReady = null;
function ensureSchema(db) {
  schemaReady ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((error) => {
    schemaReady = null; // try again next request
    throw error;
  });
  return schemaReady;
}

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (data, status = 200) => Response.json(data, { status, headers: NO_STORE });
const text = (value, max = 120) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function onRequestPost({ request, env }) {
  // Analytics must never break the pill buttons, so every failure still answers 204.
  if (!env.TW_ANALYTICS) {
    console.error('TW_ANALYTICS D1 binding is not configured; pill event not saved.');
    return empty();
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return new Response('Forbidden', { status: 403 });
  if (Number(request.headers.get('Content-Length') || 0) > 8192) return new Response('Payload too large', { status: 413 });

  let raw;
  try {
    raw = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const choice = raw.choice === 'red' || raw.choice === 'blue' ? raw.choice : '';
  const eventId = text(raw.event_id, 80);
  const visitorId = text(raw.visitor_id, 80);
  const sessionId = text(raw.session_id, 80);
  if (!choice || !eventId || !visitorId || !sessionId) return new Response('Invalid event', { status: 400 });

  const db = env.TW_ANALYTICS;
  try {
    await ensureSchema(db);
    const elapsed = Number.isFinite(Number(raw.elapsed_ms))
      ? Math.max(0, Math.min(3600000, Math.round(Number(raw.elapsed_ms))))
      : null;

    // first_choice is worked out inside the INSERT, so two quick clicks can't both claim it.
    await db.prepare(`
      INSERT OR IGNORE INTO pill_events
        (event_id, visitor_id, session_id, choice, first_visit, first_choice, elapsed_ms,
         device, referrer_host, utm_source, utm_medium, utm_campaign, page, country)
      VALUES (?1, ?2, ?3, ?4, ?5,
        CASE WHEN EXISTS (SELECT 1 FROM pill_events WHERE visitor_id = ?2) THEN 0 ELSE 1 END,
        ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
    `).bind(
      eventId,
      visitorId,
      sessionId,
      choice,
      raw.first_visit ? 1 : 0,
      elapsed,
      text(raw.device, 20),
      text(raw.referrer_host, 180),
      text(raw.utm_source, 100),
      text(raw.utm_medium, 100),
      text(raw.utm_campaign, 160),
      text(raw.page, 180) || '/',
      text(request.cf?.country, 8),
    ).run();
  } catch (error) {
    console.error('Could not save pill analytics event:', error);
  }

  return empty();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const db = env.TW_ANALYTICS;

  if (url.searchParams.get('health') === '1') {
    const tokenSet = Boolean(env.PILL_STATS_TOKEN);
    if (!db) return json({ ok: false, binding: 'TW_ANALYTICS', error: 'binding missing', stats_key_set: tokenSet }, 503);
    try {
      await ensureSchema(db);
      const row = await db.prepare('SELECT COUNT(*) AS rows FROM pill_events').first();
      return json({ ok: true, binding: 'TW_ANALYTICS', table: 'pill_events', rows: Number(row?.rows || 0), stats_key_set: tokenSet });
    } catch (error) {
      return json({ ok: false, binding: 'TW_ANALYTICS', error: String(error?.message || error), stats_key_set: tokenSet }, 500);
    }
  }

  if (!(await isUnlocked(request, env))) return json({ error: 'not authorized' }, 401);
  if (!db) return json({ error: 'analytics database not configured' }, 503);

  await ensureSchema(db);
  // Daily buckets follow the viewer's time zone (minutes east of UTC, e.g. -420 for Phoenix).
  const tz = Math.max(-840, Math.min(840, Math.round(Number(url.searchParams.get('tz')) || 0)));
  const shift = `'${tz >= 0 ? '+' : ''}${tz} minutes'`;
  const all = (sql) => db.prepare(sql).all().then((r) => r.results);
  const one = (sql) => db.prepare(sql).first();

  const [totals, overall, firstChoice, firstTimers, returning, switchers, decision, devices, countries, referrers, campaigns, daily, recent] =
    await Promise.all([
      one(`SELECT COUNT(*) AS clicks, COUNT(DISTINCT visitor_id) AS people,
             SUM(created_at >= datetime('now', '-1 day')) AS last_24h,
             MIN(created_at) AS since FROM pill_events`),
      all(`SELECT choice, COUNT(*) AS clicks, COUNT(DISTINCT visitor_id) AS people FROM pill_events GROUP BY choice`),
      all(`SELECT choice, COUNT(*) AS people FROM pill_events WHERE first_choice = 1 GROUP BY choice`),
      all(`SELECT choice, COUNT(*) AS people FROM pill_events WHERE first_choice = 1 AND first_visit = 1 GROUP BY choice`),
      all(`SELECT choice, COUNT(*) AS people FROM pill_events WHERE first_choice = 1 AND first_visit = 0 GROUP BY choice`),
      one(`SELECT COUNT(*) AS people FROM (SELECT visitor_id FROM pill_events GROUP BY visitor_id HAVING COUNT(DISTINCT choice) > 1)`),
      // Median-ish without outliers: someone who left the tab open for an hour shouldn't skew it.
      all(`SELECT choice, ROUND(AVG(elapsed_ms)) AS avg_ms, COUNT(*) AS n FROM pill_events
           WHERE elapsed_ms IS NOT NULL AND elapsed_ms < 600000 AND first_choice = 1 GROUP BY choice`),
      all(`SELECT device AS label, choice, COUNT(*) AS clicks FROM pill_events WHERE device <> '' GROUP BY device, choice`),
      all(`SELECT country AS label, choice, COUNT(*) AS clicks FROM pill_events WHERE country <> '' GROUP BY country, choice`),
      all(`SELECT referrer_host AS label, choice, COUNT(*) AS clicks FROM pill_events WHERE referrer_host <> '' GROUP BY referrer_host, choice`),
      all(`SELECT utm_campaign AS label, choice, COUNT(*) AS clicks FROM pill_events WHERE utm_campaign <> '' GROUP BY utm_campaign, choice`),
      all(`SELECT date(created_at, ${shift}) AS day, choice, COUNT(*) AS clicks FROM pill_events
           WHERE created_at >= datetime('now', '-31 days') GROUP BY day, choice ORDER BY day`),
      all(`SELECT choice, country, device, first_choice, created_at FROM pill_events ORDER BY id DESC LIMIT 25`),
    ]);

  return json({
    generated_at: new Date().toISOString(),
    totals: { clicks: totals?.clicks || 0, people: totals?.people || 0, last_24h: totals?.last_24h || 0, since: totals?.since || null },
    overall,
    first_choice: firstChoice,
    first_time_first_choice: firstTimers,
    returning_first_choice: returning,
    switchers: Number(switchers?.people || 0),
    decision_time: decision,
    devices,
    countries,
    referrers,
    campaigns,
    last_30_days: daily,
    recent,
  });
}

// ---- Who may see the stats (shared with functions/rabbithole.js) ----
// A browser is unlocked by visiting /rabbithole?key=<PILL_STATS_TOKEN> once. That sets an HttpOnly
// cookie holding a hash of the key (never the key itself); changing the secret logs everyone out.
export const COOKIE = 'tw_rabbithole';

// Keys are compared loosely so a quote can be typed naturally: case, spaces and punctuation
// don't matter ("Hello, world!" = "hello-world" = "helloworld").
const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const sha256 = async (value) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tw-rabbithole:${normalize(value)}`)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');

// Constant-time comparison so a value can't be guessed one character at a time.
function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const cookieValueFor = (key) => sha256(key);

export async function isKey(candidate, env) {
  const expected = env.PILL_STATS_TOKEN || '';
  return Boolean(expected && candidate) && same(await sha256(candidate), await sha256(expected));
}

export async function isUnlocked(request, env) {
  const expected = env.PILL_STATS_TOKEN || '';
  if (!expected) return false;
  const want = await sha256(expected);
  const cookie = (request.headers.get('Cookie') || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
  if (cookie && same(cookie, want)) return true;
  const bearer = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/, '');
  return isKey(bearer, env);
}

function empty() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
