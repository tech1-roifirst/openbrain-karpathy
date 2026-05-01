-- =============================================================================
-- Migration: 004_create_indexes
-- Date: 2026-04-30
-- Description:
--   Adds secondary indexes to support the five required query patterns. All
--   CREATE INDEX statements are IF NOT EXISTS, so this migration is idempotent.
--
--   Note: For very large existing tables in production we would prefer
--   CREATE INDEX CONCURRENTLY, which cannot run inside a transaction block.
--   This migration uses standard CREATE INDEX so it can run inside BEGIN/COMMIT
--   alongside the table-creation migrations on a fresh database.
-- =============================================================================

BEGIN;

-- UP -------------------------------------------------------------------------

-- events
CREATE INDEX IF NOT EXISTS idx_events_event_date    ON events    (event_date);
CREATE INDEX IF NOT EXISTS idx_events_organizer     ON events    (organizer);

-- attendees
-- (attendees.email already has a unique B-tree via the UNIQUE constraint.)

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_event_id        ON tickets (event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attendee_id     ON tickets (attendee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status          ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_event_attendee  ON tickets (event_id, attendee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_status    ON tickets (event_id, status);

COMMIT;

-- DOWN -----------------------------------------------------------------------
-- BEGIN;
-- DROP INDEX IF EXISTS idx_tickets_event_status;
-- DROP INDEX IF EXISTS idx_tickets_event_attendee;
-- DROP INDEX IF EXISTS idx_tickets_status;
-- DROP INDEX IF EXISTS idx_tickets_attendee_id;
-- DROP INDEX IF EXISTS idx_tickets_event_id;
-- DROP INDEX IF EXISTS idx_events_organizer;
-- DROP INDEX IF EXISTS idx_events_event_date;
-- COMMIT;
