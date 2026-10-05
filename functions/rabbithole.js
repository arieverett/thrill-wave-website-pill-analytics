// Cloudflare Pages Function: /rabbithole, the private dashboard for the red / blue pill easter egg.
//
// Unlisted on purpose: it is served by this function (not a site page), so it never enters the build,
// sitemap, menu or search. A browser without the unlock cookie sees a "Knock, knock" key screen.
//
//   /rabbithole?key=<PILL_STATS_TOKEN>   unlocks this browser for a year, then redirects to /rabbithole
//                                        (the key screen sends people here; a wrong key goes back with ?denied=1)
//   /rabbithole?logout=1                 locks this browser again and returns to the key screen
//
// The numbers come from /api/pill, which checks the same cookie.

import { COOKIE, cookieValueFor, isKey, isUnlocked } from './api/pill.js';

const PRIVATE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
const go = (location, setCookie) => new Response(null, { status: 303, headers: { ...PRIVATE, Location: location, 'Set-Cookie': setCookie } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (url.searchParams.has('logout')) return go('/rabbithole', cookie('', 0));

  const key = url.searchParams.get('key');
  if (key !== null) {
    if (await isKey(key, env)) return go('/rabbithole', cookie(await cookieValueFor(key), 60 * 60 * 24 * 365));
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing a little
    return go('/rabbithole?denied=1', cookie('', 0));
  }

  const mode = (await isUnlocked(request, env)) ? 'open' : 'locked';
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  return new Response(PAGE.replaceAll('__NONCE__', nonce).replace('__MODE__', mode), {
    headers: {
      ...PRIVATE,
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Down the Rabbit Hole</title>
<meta name="description" content="Who took the red pill, and who kept scrolling.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Thrill Wave">
<meta property="og:title" content="Down the Rabbit Hole">
<meta property="og:description" content="Who took the red pill, and who kept scrolling.">
<meta property="og:url" content="https://thrillwave.com/rabbithole">
<meta property="og:image" content="https://thrillwave.com/images/og/rabbithole.jpg?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="480">
<meta property="og:image:alt" content="Down the rabbit hole: a red pill with a rabbit and a blue pill with a steak, over green Matrix code">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://thrillwave.com/images/og/rabbithole.jpg?v=2">
<link rel="icon" href="/images/rabbithole/favicon.ico?v=1" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/images/rabbithole/favicon-32x32.png?v=1">
<link rel="icon" type="image/png" sizes="16x16" href="/images/rabbithole/favicon-16x16.png?v=1">
<link rel="apple-touch-icon" sizes="180x180" href="/images/rabbithole/apple-touch-icon.png?v=1">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" nonce="__NONCE__">
<style nonce="__NONCE__">
:root {
  --bg: #000; --panel: #070a07; --line: #1a241a; --fg: #e8f5e9; --muted: #7d9a80; --dim: #3c4f3e;
  --green: #5dd068; --red: #ff2d2d; --blue: #3d8bff;
  --font: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--bg); color: var(--fg); font: 14px/1.5 var(--font); }
body { min-height: 100vh; }
#rain { position: fixed; inset: 0; width: 100%; height: 100%; opacity: .16; pointer-events: none; z-index: 0; }
.wrap { position: relative; z-index: 1; max-width: 1080px; margin: 0 auto; padding: 28px 16px 64px; }
header { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: baseline; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 28px; }
.brand { color: var(--green); font-weight: 700; letter-spacing: .14em; font-size: 13px; }
.brand b { color: var(--fg); }
.brand-emoji { letter-spacing: .2em; margin-left: .35em; }
.status { color: var(--muted); font-size: 12px; }
.status .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--green); margin-right: 6px; box-shadow: 0 0 8px var(--green); animation: pulse 2s infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.tools { display: flex; flex-wrap: wrap; gap: 8px; }
button, .btn { text-decoration: none; font: inherit; font-size: 12px; color: var(--green); background: transparent; border: 1px solid var(--dim); border-radius: 4px; padding: 6px 10px; cursor: pointer; }
button:hover { border-color: var(--green); }
button[aria-pressed="true"] { background: var(--green); color: #000; border-color: var(--green); }
h1 { font-size: clamp(22px, 4vw, 34px); font-weight: 700; letter-spacing: -.01em; margin-bottom: 6px; }
h2 { font-size: 12px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--green); margin-bottom: 14px; }
.sub { color: var(--muted); margin-bottom: 26px; }
.caret::after { content: '_'; color: var(--green); animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.panel { background: color-mix(in srgb, var(--panel) 88%, transparent); border: 1px solid var(--line); border-radius: 8px; padding: 20px; }
.grid { display: grid; gap: 16px; }
.g2 { grid-template-columns: 1fr 1fr; }
@media (max-width: 760px) { .g2 { grid-template-columns: 1fr; } }
.tiles { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin: 16px 0; }
.tile .k { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.tile .v { font-size: 30px; font-weight: 700; line-height: 1.2; margin-top: 4px; }
.tile .n { font-size: 12px; color: var(--muted); }
section { margin-top: 16px; }
.grid > section { margin-top: 0; }
.g2 { margin-top: 16px; }

/* The big split */
.split-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 12px; }
.side { display: flex; flex-direction: column; }
.side.right { align-items: flex-end; text-align: right; }
.side .pct { font-size: clamp(44px, 9vw, 84px); font-weight: 700; line-height: 1; }
.side .lab { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-top: 6px; }
.side .lab i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
.red i, .sw-red { background: var(--red); box-shadow: 0 0 10px var(--red); }
.blue i, .sw-blue { background: var(--blue); box-shadow: 0 0 10px var(--blue); }
.bar { display: flex; gap: 2px; height: 14px; border-radius: 7px; overflow: hidden; background: var(--line); }
.bar span { display: block; height: 100%; transition: flex-grow .8s ease; min-width: 0; }
.bar .r { background: var(--red); } .bar .b { background: var(--blue); }
.bar.big { height: 22px; border-radius: 11px; }
.note { color: var(--muted); font-size: 12px; margin-top: 10px; }
.allclicks { margin-top: 22px; padding-top: 18px; border-top: 1px dashed var(--line); }
.allclicks .row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.allclicks .row-head b { font-size: 20px; letter-spacing: 0; color: var(--fg); }
.allclicks .row-head .cr, .allclicks .row-head .cb { font-weight: 700; }
.allclicks .bar { height: 12px; }
@media (max-width: 560px) { .allclicks .row-head { flex-wrap: wrap; } .allclicks .row-head > span:nth-child(2) { order: -1; width: 100%; } }

/* Breakdown rows */
.rows { display: grid; gap: 10px; }
.row > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row { display: grid; grid-template-columns: minmax(0, 1.2fr) 2fr auto; gap: 10px; align-items: center; font-size: 13px; }
.row .bar { height: 8px; }
.row .c { color: var(--muted); font-size: 12px; white-space: nowrap; text-align: right; }
.row .c .rc { color: var(--fg); }
.empty { color: var(--muted); font-size: 13px; }

/* Trend chart */
.chart { position: relative; }
.chart svg { display: block; width: 100%; height: 220px; overflow: visible; }
.legend { display: flex; gap: 16px; font-size: 12px; color: var(--muted); margin-bottom: 10px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.tip { position: absolute; pointer-events: none; background: #000; border: 1px solid var(--dim); border-radius: 6px; padding: 8px 10px; font-size: 12px; white-space: nowrap; transform: translate(-50%, -100%); opacity: 0; transition: opacity .12s; }
.tip.on { opacity: 1; }
.cr { color: var(--red); } .cb { color: var(--blue); }

/* Live feed */
.feed { list-style: none; display: grid; gap: 4px; font-size: 13px; max-height: 360px; overflow: auto; }
.feed li { display: grid; grid-template-columns: 14px 64px 1fr auto; gap: 10px; align-items: center; padding: 6px 4px; border-bottom: 1px dashed var(--line); }
.feed li.new { animation: flash 1.6s ease-out; }
@keyframes flash { from { background: color-mix(in srgb, var(--green) 25%, transparent); } }
.feed .sw { width: 10px; height: 10px; border-radius: 50%; }
.feed .when { color: var(--muted); font-size: 12px; }
.feed .meta { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { color: var(--green); font-size: 11px; margin-left: 6px; }

/* Lock screen */
.lock { max-width: 460px; margin: 12vh auto 0; }
.lock form { display: flex; gap: 8px; margin-top: 18px; }
.lock input { flex: 1; min-width: 0; font: inherit; color: var(--fg); background: #000; border: 1px solid var(--dim); border-radius: 4px; padding: 10px 12px; }
/* 16px stops phone browsers zooming in when the box is tapped */
@media (hover: none), (pointer: coarse), (max-width: 760px) { .lock input, .lock button { font-size: 16px; } }
.lock input:focus, button:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
.err { color: var(--red); font-size: 12px; margin-top: 10px; min-height: 18px; }
[hidden] { display: none !important; }
table.sr { position: absolute; left: -9999px; }
@media (max-width: 560px) { .feed li { grid-template-columns: 14px 52px 1fr; } .feed .when { grid-column: 3; } }
@media (prefers-reduced-motion: reduce) { #rain { display: none; } * { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<canvas id="rain" aria-hidden="true"></canvas>
<div class="wrap">
  <header>
    <div class="brand">THRILL WAVE <b>//</b> THE RABBIT HOLE <span class="brand-emoji" aria-hidden="true">🐇 🥩</span></div>
    <div class="status" id="status"><span class="dot"></span>Offline</div>
    <div class="tools" id="tools" hidden>
      <button type="button" id="refresh">Refresh</button>
      <button type="button" id="ignore" aria-pressed="false" title="Stop counting pill clicks from this browser">Ignore my clicks</button>
      <a class="btn" href="/rabbithole?logout=1">Lock</a>
    </div>
  </header>

  <div class="lock" id="lock" hidden>
    <h1 class="caret">Knock, knock</h1>
    <p class="sub">Enter the key to see who took which pill. It's a line from the movie, and capitals, spaces and punctuation don't matter.</p>
    <form id="login">
      <input type="password" id="key" autocomplete="current-password" placeholder="The key" aria-label="Key" required>
      <button type="submit">Jack in</button>
    </form>
    <p class="err" id="err" role="alert"></p>
  </div>

  <main id="dash" hidden>
    <h1 class="caret" id="headline">Following the white rabbit</h1>
    <p class="sub" id="since"></p>

    <section class="panel">
      <h2>First pick, one vote per person</h2>
      <div class="split-head">
        <div class="side red"><span class="pct" id="pRed">0%</span><span class="lab"><i></i>Red pill</span></div>
        <div class="side right blue"><span class="pct" id="pBlue">0%</span><span class="lab"><i></i>Blue pill</span></div>
      </div>
      <div class="bar big" role="img" id="bigBar" aria-label="Red versus blue"><span class="r" id="bRed"></span><span class="b" id="bBlue"></span></div>
      <p class="note" id="bigNote"></p>
      <div class="allclicks">
        <div class="row-head"><span><b id="acRedPct">0%</b> red</span><span>All clicks, repeats included</span><span>blue <b id="acBluePct">0%</b></span></div>
        <div class="bar" role="img" id="acBar" aria-label="All clicks, red versus blue"><span class="r" id="acRed"></span><span class="b" id="acBlue"></span></div>
        <p class="note" id="acNote"></p>
      </div>
    </section>

    <div class="grid tiles" id="tiles"></div>

    <section class="panel">
      <h2>Last 30 days</h2>
      <div class="legend"><span><i class="sw-red"></i>Red</span><span><i class="sw-blue"></i>Blue</span></div>
      <div class="chart" id="chart"><svg id="svg" role="img" aria-label="Pill clicks per day, last 30 days"></svg><div class="tip" id="tip"></div></div>
      <table class="sr" id="trendTable"></table>
    </section>

    <div class="grid g2">
      <section class="panel"><h2>New vs returning</h2><div class="rows" id="newret"></div></section>
      <section class="panel"><h2>Device</h2><div class="rows" id="devices"></div></section>
      <section class="panel"><h2>Country</h2><div class="rows" id="countries"></div></section>
      <section class="panel"><h2>Came from</h2><div class="rows" id="referrers"></div></section>
    </div>

    <section class="panel">
      <h2>Live feed</h2>
      <ul class="feed" id="feed"></ul>
    </section>
  </main>
</div>

<script nonce="__NONCE__">
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };
  const fmt = (n) => Number(n || 0).toLocaleString();
  const pct = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : 0);
  const sumBy = (rows, choice, field = 'people') => rows.filter((r) => r.choice === choice).reduce((t, r) => t + Number(r[field] || 0), 0);
  const regions = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; } })();
  const flag = (cc) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) + ' ' : '');
  const country = (cc) => (cc === 'T1' ? 'Tor' : cc === 'XX' ? 'Unknown' : flag(cc) + (regions?.of(cc) || cc));
  const utc = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
  const ago = (s) => {
    const sec = Math.max(0, (Date.now() - utc(s)) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    return Math.floor(sec / 86400) + 'd ago';
  };

  // ---- Matrix rain, quietly in the background ----
  const rain = () => {
    const cv = $('rain'), cx = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cols = [], size = 16;
    const resize = () => { cv.width = innerWidth; cv.height = innerHeight; cols = Array(Math.ceil(innerWidth / size)).fill(0).map(() => Math.random() * -50); };
    resize(); addEventListener('resize', resize);
    const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789THRILWAVE';
    const tick = () => {
      cx.fillStyle = 'rgba(0,0,0,.08)'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.font = size + 'px monospace';
      cols.forEach((y, i) => {
        cx.fillStyle = Math.random() < .015 ? '#ff2d2d' : Math.random() < .015 ? '#3d8bff' : '#5dd068';
        cx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, y * size);
        cols[i] = y * size > cv.height && Math.random() > .975 ? 0 : y + 1;
      });
    };
    setInterval(tick, 70);
  };

  // ---- Locked out (cookie expired or key changed): go back to the plain 404 ----
  const locked = () => location.replace('/rabbithole');
  $('refresh').addEventListener('click', () => load());

  // Opt this browser out of the counts (the homepage beacon reads the same flag).
  const ignoreBtn = $('ignore');
  const paintIgnore = () => { const on = store.get('tw_pill_ignore') === '1'; ignoreBtn.setAttribute('aria-pressed', on); ignoreBtn.textContent = on ? 'Ignoring my clicks' : 'Ignore my clicks'; };
  ignoreBtn.addEventListener('click', () => { store.set('tw_pill_ignore', store.get('tw_pill_ignore') === '1' ? null : '1'); paintIgnore(); });
  paintIgnore();

  // ---- Data ----
  let seen = new Set(), firstLoad = true, lastTrend = null, resizeT;
  async function load() {
    try {
      const res = await fetch('/api/pill?tz=' + -new Date().getTimezoneOffset(), { cache: 'no-store', credentials: 'same-origin' });
      if (res.status === 401) return locked();
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      $('dash').hidden = false; $('tools').hidden = false;
      render(data);
      $('status').innerHTML = '<span class="dot"></span>Live · updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (err) {
      $('status').innerHTML = '<span class="dot"></span>Signal lost (' + esc(err.message) + ')';
    }
  }

  function render(d) {
    const red = sumBy(d.first_choice, 'red'), blue = sumBy(d.first_choice, 'blue');
    const pr = pct(red, blue), pb = red + blue ? 100 - pr : 0;
    const t = d.totals;

    $('headline').textContent = !t.people ? 'Nobody has chosen yet' : pr === pb ? 'Dead even' : pr > pb ? 'The red pill is winning' : 'Most people stay in the Matrix';
    $('since').textContent = t.since ? 'Counting since ' + utc(t.since).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) + '.' : 'Waiting for the first click on the homepage.';
    $('pRed').textContent = pr + '%'; $('pBlue').textContent = pb + '%';
    $('bRed').style.flexGrow = red || (red + blue ? 0 : 1);
    $('bBlue').style.flexGrow = blue || (red + blue ? 0 : 1);
    $('bigBar').setAttribute('aria-label', 'Red ' + red + ' people, blue ' + blue + ' people');
    $('bigNote').textContent = fmt(red) + ' chose red first, ' + fmt(blue) + ' chose blue first.';

    // Every click of all time, repeats included.
    const cr = sumBy(d.overall, 'red', 'clicks'), cb = sumBy(d.overall, 'blue', 'clicks');
    const acr = pct(cr, cb), acb = cr + cb ? 100 - acr : 0;
    $('acRedPct').textContent = acr + '%'; $('acBluePct').textContent = acb + '%';
    $('acRed').style.flexGrow = cr || (cr + cb ? 0 : 1);
    $('acBlue').style.flexGrow = cb || (cr + cb ? 0 : 1);
    $('acBar').setAttribute('aria-label', 'All clicks: red ' + cr + ', blue ' + cb);
    $('acNote').textContent = fmt(cr) + ' red clicks and ' + fmt(cb) + ' blue clicks in total.';

    const avg = (c) => { const r = d.decision_time.find((x) => x.choice === c); return r?.avg_ms ? (r.avg_ms / 1000).toFixed(1) + 's' : '–'; };
    const tiles = [
      ['People', fmt(t.people), 'chose a pill'],
      ['Clicks', fmt(t.clicks), 'all picks, repeats included'],
      ['Last 24 hours', fmt(t.last_24h), 'clicks'],
      ['Switched', fmt(d.switchers), 'took both pills'],
      ['Time to red', avg('red'), 'from page load'],
      ['Time to blue', avg('blue'), 'from page load'],
    ];
    $('tiles').innerHTML = tiles.map(([k, v, n]) => '<div class="panel tile"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="n">' + n + '</div></div>').join('');

    // Breakdown rows: one split bar per label, biggest first.
    const rows = (el, data, label = (x) => x, field = 'clicks', limit = 8) => {
      const by = new Map();
      data.forEach((r) => { const o = by.get(r.label) || { red: 0, blue: 0 }; o[r.choice] += Number(r[field] || 0); by.set(r.label, o); });
      const list = [...by].sort((a, b) => b[1].red + b[1].blue - (a[1].red + a[1].blue)).slice(0, limit);
      $(el).innerHTML = list.length ? list.map(([k, v]) =>
        '<div class="row"><span>' + esc(label(k)) + '</span><div class="bar" role="img" aria-label="red ' + v.red + ', blue ' + v.blue + '"><span class="r" data-g="' + v.red + '"></span><span class="b" data-g="' + v.blue + '"></span></div><span class="c"><span class="rc">' + v.red + '</span> / ' + v.blue + '</span></div>'
      ).join('') : '<p class="empty">Nothing yet.</p>';
      $(el).querySelectorAll('[data-g]').forEach((b) => { b.style.flexGrow = b.dataset.g; });
    };
    rows('newret', [
      ...d.first_time_first_choice.map((r) => ({ label: 'First visit', choice: r.choice, clicks: r.people })),
      ...d.returning_first_choice.map((r) => ({ label: 'Returning', choice: r.choice, clicks: r.people })),
    ]);
    rows('devices', d.devices, (x) => x[0].toUpperCase() + x.slice(1));
    rows('countries', d.countries, country);
    rows('referrers', [...d.referrers, ...d.campaigns.map((c) => ({ ...c, label: 'campaign: ' + c.label }))], (x) => x.replace(/^www\\./, ''));

    lastTrend = d.last_30_days;
    trend(lastTrend);
    feed(d.recent);
  }

  // ---- 30-day stacked bars with a hover tooltip ----
  function trend(rows) {
    const days = [];
    const iso = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    for (let i = 29; i >= 0; i--) days.push(iso(new Date(Date.now() - i * 864e5)));
    const data = days.map((day) => ({ day, red: Number(rows.find((r) => r.day === day && r.choice === 'red')?.clicks || 0), blue: Number(rows.find((r) => r.day === day && r.choice === 'blue')?.clicks || 0) }));
    const svg = $('svg'), W = $('chart').clientWidth || 800, H = 220, top = 10, bottom = 24, left = 28;
    const max = Math.max(4, ...data.map((d) => d.red + d.blue));
    const step = Math.ceil(max / 4), yMax = step * 4;
    const y = (v) => top + (H - top - bottom) * (1 - v / yMax);
    const bw = (W - left) / data.length, gap = Math.min(4, bw * .25);
    const label = (s) => new Date(s + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
    let out = '';
    for (let v = 0; v <= yMax; v += step) out += '<line x1="' + left + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#1a241a"/><text x="' + (left - 6) + '" y="' + (y(v) + 4) + '" fill="#7d9a80" font-size="10" text-anchor="end">' + v + '</text>';
    data.forEach((d, i) => {
      const x = left + i * bw + gap / 2, w = bw - gap;
      const yb = y(d.blue), yr = y(d.blue + d.red);
      if (d.blue) out += '<rect x="' + x + '" y="' + yb + '" width="' + w + '" height="' + (y(0) - yb) + '" fill="#3d8bff" rx="' + (d.red ? 0 : 2) + '"/>';
      if (d.red) out += '<rect x="' + x + '" y="' + yr + '" width="' + w + '" height="' + Math.max(0, y(d.blue) - yr - (d.blue ? 2 : 0)) + '" fill="#ff2d2d" rx="2"/>';
      if ((i % 7 === 1 && i < data.length - 4) || i === data.length - 1) out += '<text x="' + (x + w / 2) + '" y="' + (H - 6) + '" fill="#7d9a80" font-size="10" text-anchor="middle">' + label(d.day) + '</text>';
      out += '<rect class="hit" data-i="' + i + '" x="' + (left + i * bw) + '" y="0" width="' + bw + '" height="' + H + '" fill="transparent"/>';
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = out;
    const tip = $('tip');
    svg.querySelectorAll('.hit').forEach((r) => {
      r.addEventListener('pointerenter', () => {
        const d = data[r.dataset.i];
        tip.innerHTML = '<b>' + label(d.day) + '</b><br><span class="cr">●</span> Red ' + d.red + ' &nbsp; <span class="cb">●</span> Blue ' + d.blue;
        tip.style.left = (Number(r.getAttribute('x')) + bw / 2) / W * 100 + '%';
        tip.style.top = Math.max(0, y(d.red + d.blue) - 8) + 'px';
        tip.classList.add('on');
      });
      r.addEventListener('pointerleave', () => tip.classList.remove('on'));
    });
    $('trendTable').innerHTML = '<tr><th>Day</th><th>Red</th><th>Blue</th></tr>' + data.map((d) => '<tr><td>' + d.day + '</td><td>' + d.red + '</td><td>' + d.blue + '</td></tr>').join('');
  }

  function feed(list) {
    const el = $('feed');
    if (!list.length) { el.innerHTML = '<li><span></span><span></span><span class="meta">No picks yet. Go click a pill on the homepage (from a browser that isn\\'t ignored).</span></li>'; return; }
    el.innerHTML = list.map((r) => {
      const id = r.created_at + r.choice + r.country + r.device;
      const isNew = !firstLoad && !seen.has(id);
      seen.add(id);
      return '<li class="' + (isNew ? 'new' : '') + '"><span class="sw sw-' + r.choice + '"></span><b>' + r.choice.toUpperCase() + '</b><span class="meta">' + esc(r.country ? country(r.country) : 'Somewhere') + ' · ' + esc(r.device || 'device?') + (r.first_choice ? '<span class="tag">first pick</span>' : '') + '</span><span class="when">' + ago(r.created_at) + '</span></li>';
    }).join('');
    firstLoad = false;
  }

  rain();
  if ('__MODE__' === 'locked') {
    $('status').innerHTML = '<span class="dot"></span>Locked';
    $('lock').hidden = false;
    if (new URLSearchParams(location.search).has('denied')) {
      $('err').textContent = "That's not it. Try again.";
      history.replaceState(null, '', '/rabbithole');
    }
    $('login').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('key').value.trim();
      if (v) location.assign('/rabbithole?key=' + encodeURIComponent(v));
    });
    // Put the cursor in the box on computers only: on phones it pops the keyboard up and shifts the page.
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) $('key').focus();
  } else {
    load();
    setInterval(() => { if (!document.hidden) load(); }, 30000);
  }
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (lastTrend) trend(lastTrend); }, 150); });
})();
</script>
</body>
</html>`;
