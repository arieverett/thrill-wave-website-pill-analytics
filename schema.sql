-- Cloudflare D1 (SQLite) schema for the red / blue pill analytics.
-- functions/api/pill.js creates this on first use, so running it by hand is optional:
--   npx wrangler d1 execute <database-name> --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS pill_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,          -- random per click, makes retries idempotent
  visitor_id TEXT NOT NULL,               -- random browser ID from localStorage, never tied to a person
  session_id TEXT NOT NULL,               -- random per tab session
  choice TEXT NOT NULL CHECK (choice IN ('red', 'blue')),
  first_visit INTEGER NOT NULL CHECK (first_visit IN (0, 1)),   -- browser had no ID before this page view
  first_choice INTEGER NOT NULL CHECK (first_choice IN (0, 1)), -- this visitor's first pick ever
  elapsed_ms INTEGER,                     -- page load to click
  device TEXT,                            -- mobile / tablet / desktop
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  page TEXT NOT NULL DEFAULT '/',
  country TEXT,                           -- from Cloudflare's request.cf, no IP stored
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS pill_events_visitor ON pill_events(visitor_id);
CREATE INDEX IF NOT EXISTS pill_events_created ON pill_events(created_at);

-- A few of the questions the dashboard answers, as plain SQL:

-- Red vs blue, one vote per person (their first pick)
-- SELECT choice, COUNT(*) AS people FROM pill_events WHERE first_choice = 1 GROUP BY choice;

-- Every click, repeats included
-- SELECT choice, COUNT(*) AS clicks FROM pill_events GROUP BY choice;

-- People who took both pills
-- SELECT COUNT(*) FROM (SELECT visitor_id FROM pill_events GROUP BY visitor_id HAVING COUNT(DISTINCT choice) > 1);
