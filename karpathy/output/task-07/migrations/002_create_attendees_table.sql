-- =============================================================================
-- Migration: 002_create_attendees_table
-- Date: 2026-04-30
-- Description:
--   Creates the attendees table -- globally unique people identified by email.
--   Idempotent. Depends on the shared set_updated_at() function from 001.
-- =============================================================================

BEGIN;

-- UP -------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS attendees (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    email           VARCHAR(320)    NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Constraints added one-by-one so the migration is fully re-runnable.
DO $$
BEGIN
    ALTER TABLE attendees
        ADD CONSTRAINT attendees_email_lowercase_chk CHECK (email = LOWER(email));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE attendees
        ADD CONSTRAINT attendees_email_format_chk CHECK (email LIKE '%_@_%.__%');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE attendees
        ADD CONSTRAINT attendees_email_unique UNIQUE (email);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS attendees_set_updated_at ON attendees;
CREATE TRIGGER attendees_set_updated_at
    BEFORE UPDATE ON attendees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  attendees       IS 'Globally unique people who can purchase tickets.';
COMMENT ON COLUMN attendees.email IS 'RFC-5321-bounded email, lowercase, globally unique.';

COMMIT;

-- DOWN -----------------------------------------------------------------------
-- BEGIN;
-- DROP TRIGGER IF EXISTS attendees_set_updated_at ON attendees;
-- DROP TABLE  IF EXISTS attendees;
-- COMMIT;
