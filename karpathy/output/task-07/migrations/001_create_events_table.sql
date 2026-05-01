-- =============================================================================
-- Migration: 001_create_events_table
-- Date: 2026-04-30
-- Description:
--   Creates the events table -- root entity for scheduled events. Idempotent.
--   Also installs the shared set_updated_at() trigger function (used by
--   subsequent migrations as well) and attaches it to events.
-- =============================================================================

BEGIN;

-- UP -------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS events (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    event_date      TIMESTAMPTZ     NOT NULL,
    organizer       VARCHAR(255)    NOT NULL,
    capacity        INTEGER         NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Constraint added separately so re-runs do not blow up on duplicate_object.
DO $$
BEGIN
    ALTER TABLE events
        ADD CONSTRAINT events_capacity_positive_chk CHECK (capacity > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Shared trigger function (used by attendees and tickets too -- defined here
-- because migration 001 must be runnable before 002/003 exist).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_set_updated_at ON events;
CREATE TRIGGER events_set_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  events            IS 'Scheduled events. Parent of tickets.';
COMMENT ON COLUMN events.event_date IS 'Event start in UTC (TIMESTAMPTZ).';
COMMENT ON COLUMN events.capacity   IS 'Max tickets sellable. CHECK > 0.';

COMMIT;

-- DOWN -----------------------------------------------------------------------
-- BEGIN;
-- DROP TRIGGER IF EXISTS events_set_updated_at ON events;
-- DROP TABLE  IF EXISTS events;
-- -- set_updated_at() is intentionally left in place; later migrations may use it.
-- COMMIT;
