-- =============================================================================
-- Migration: 003_create_tickets_table
-- Date: 2026-04-30
-- Description:
--   Creates the tickets table -- junction-with-attributes between events and
--   attendees. Idempotent.
--
--   FK behavior:
--     event_id    -> events(id)    ON DELETE RESTRICT
--     attendee_id -> attendees(id) ON DELETE CASCADE
-- =============================================================================

BEGIN;

-- UP -------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tickets (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID            NOT NULL,
    attendee_id     UUID            NOT NULL,
    price           DECIMAL(10, 2)  NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',
    purchased_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Foreign keys (idempotent).
DO $$
BEGIN
    ALTER TABLE tickets
        ADD CONSTRAINT tickets_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE tickets
        ADD CONSTRAINT tickets_attendee_id_fkey
        FOREIGN KEY (attendee_id) REFERENCES attendees(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CHECK constraints (idempotent).
DO $$
BEGIN
    ALTER TABLE tickets
        ADD CONSTRAINT tickets_price_nonneg_chk CHECK (price >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE tickets
        ADD CONSTRAINT tickets_status_allowed_chk
        CHECK (status IN ('pending', 'confirmed', 'cancelled'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS tickets_set_updated_at ON tickets;
CREATE TRIGGER tickets_set_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  tickets         IS 'Tickets purchased by attendees for events.';
COMMENT ON COLUMN tickets.price   IS 'Price at purchase time (denormalized -- documented).';
COMMENT ON COLUMN tickets.status  IS 'Lifecycle: pending | confirmed | cancelled.';

COMMIT;

-- DOWN -----------------------------------------------------------------------
-- BEGIN;
-- DROP TRIGGER IF EXISTS tickets_set_updated_at ON tickets;
-- DROP TABLE  IF EXISTS tickets;
-- COMMIT;
