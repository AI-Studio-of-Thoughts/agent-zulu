-- Agent Zulu — Neon Database Schema
-- Run this in your Neon SQL editor to set up the tables.

-- Session logs: sovereign training telemetry (opt-in)
CREATE TABLE IF NOT EXISTS session_logs (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  TEXT        NOT NULL,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  user_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_logs_session_idx ON session_logs (session_id);
CREATE INDEX IF NOT EXISTS session_logs_created_idx ON session_logs (created_at DESC);

-- Community logs: anonymous ubuntu flywheel data (opt-in)
CREATE TABLE IF NOT EXISTS community_logs (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type   TEXT        NOT NULL,
  payload      JSONB                DEFAULT '{}',
  language     TEXT                 DEFAULT 'isizulu',
  region       TEXT                 DEFAULT 'unknown',
  session_hash TEXT        NOT NULL,
  device_hash  TEXT                 DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS community_logs_created_idx ON community_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS community_logs_language_idx ON community_logs (language);
CREATE INDEX IF NOT EXISTS community_logs_region_idx  ON community_logs (region);
