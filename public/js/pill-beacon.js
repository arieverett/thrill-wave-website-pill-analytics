// pill-beacon.js: the browser half of the red / blue pill analytics on thrillwave.com.
// Drop it on any page whose buttons carry data-pill-choice="red" or data-pill-choice="blue".
// No dependencies. Load it with <script src="/js/pill-beacon.js" defer></script>.

(() => {
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------------------------------------------------------------------
// Matrix easter egg analytics: record red / blue pill choices with a tiny first-party beacon.
// A random browser ID in localStorage distinguishes first-time from returning browsers; it is
// not tied to a name/email and is never sent anywhere except our own /api/pill endpoint.
// ---------------------------------------------------------------------------
const pillChoices = $$('[data-pill-choice]');
// Team browsers can opt out from the dashboard at /construct, so our own clicks don't count.
let pillIgnored = false;
try { pillIgnored = localStorage.getItem('tw_pill_ignore') === '1'; } catch { /* storage blocked */ }
if (pillChoices.length && !pillIgnored) {
  const randomId = () => crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const visitorKey = 'tw_visitor_v1';
  const sessionKey = 'tw_session_v1';
  let visitorId;
  let sessionId;
  let firstVisit = false;

  try {
    visitorId = localStorage.getItem(visitorKey);
    if (!visitorId) {
      firstVisit = true;
      visitorId = randomId();
      localStorage.setItem(visitorKey, visitorId);
    }
  } catch {
    firstVisit = true;
    visitorId = randomId();
  }

  try {
    sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = randomId();
      sessionStorage.setItem(sessionKey, sessionId);
    }
  } catch {
    sessionId = randomId();
  }

  const loadedAt = performance.now();
  const params = new URLSearchParams(location.search);
  let referrerHost = '';
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    if (host && host !== location.hostname && host !== `www.${location.hostname}`) referrerHost = host;
  } catch { /* malformed referrer: leave blank */ }

  const device = navigator.userAgentData?.mobile
    ? 'mobile'
    : innerWidth < 700
      ? 'mobile'
      : innerWidth < 1100
        ? 'tablet'
        : 'desktop';

  const sendChoice = (choice) => {
    const payload = {
      event_id: randomId(),
      visitor_id: visitorId,
      session_id: sessionId,
      choice,
      first_visit: firstVisit,
      elapsed_ms: Math.max(0, Math.round(performance.now() - loadedAt)),
      device,
      referrer_host: referrerHost,
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      page: location.pathname,
    };
    fetch('/api/pill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  };

  // One event per page view and pill, so double clicks and back-button returns don't inflate counts.
  const sent = new Set();
  const onPick = (pill) => (e) => {
    if (e.type === 'auxclick' && e.button !== 1) return; // middle click opens a new tab: still a choice
    const choice = pill.dataset.pillChoice;
    if (sent.has(choice)) return;
    sent.add(choice);
    sendChoice(choice);
  };
  pillChoices.forEach((pill) => {
    pill.addEventListener('click', onPick(pill));
    pill.addEventListener('auxclick', onPick(pill));
  });
  // Coming back with the browser's Back button restores the page from memory: treat it as a fresh view.
  addEventListener('pageshow', (e) => { if (e.persisted) sent.clear(); });
}
})();
