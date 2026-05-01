-- =============================================================================
-- Event Management System -- Master Schema
-- Target: PostgreSQL 14+
-- =============================================================================
-- Purpose:
--   Defines a 3NF relational schema for managing events, attendees, and tickets.
--   This file is idempotent: re-running it on an existing database is safe.
--
-- Design principles:
--   * UUID primary keys (gen_random_uuid) -- portable, opaque, mergeable across shards.
--   * TIMESTAMPTZ for all temporal columns -- store in UTC, render in client TZ.
--   * DECIMAL(10,2) for monetary values -- never FLOAT/REAL for money.
--   * NOT NULL by default; nullability is an explicit, documented exception.
--   * CHECK constraints encode business rules at the database (last line of defense).
--   * Foreign keys with explicit ON DELETE behavior -- never let cascades be implicit.
--   * Single source of truth: capacity is stored on events; tickets sold is COUNT(*) of tickets.
-- =============================================================================

-- pgcrypto provides gen_random_uuid(). Built-in on PG 13+ but extension call is
-- still required if not already enabled.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Table 1: events
-- Purpose: One row per scheduled event. Parent of tickets.
-- Relationships:
--   events 1 -- N tickets (via tickets.event_id, ON DELETE RESTRICT)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    -- Surrogate key. UUID is opaque and avoids leaking row counts via sequential IDs.
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Human-readable event name. VARCHAR(255) is comfortably wide; not a TEXT
    -- column because we want a hard upper bound for index/UI sanity.
    name            VARCHAR(255)    NOT NULL,

    -- Event start instant. TIMESTAMPTZ stores UTC under the hood so events
    -- that cross DST boundaries do not drift.
    event_date      TIMESTAMPTZ     NOT NULL,

    -- Organizer name. Kept as a VARCHAR for now; see SCHEMA_DESIGN.md for the
    -- migration path to a full users/organizers table when scale demands it.
    organizer       VARCHAR(255)    NOT NULL,

    -- Maximum number of tickets allowed. Enforced via CHECK + application-level
    -- "tickets sold < capacity" guard during ticket insertion.
    capacity        INTEGER         NOT NULL,

    -- Audit columns. updated_at is maintained by a trigger (see below).
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Capacity must be a positive integer. 0 is rejected because a 0-capacity
    -- event is functionally a deleted event -- delete the row instead.
    CONSTRAINT events_capacity_positive_chk CHECK (capacity > 0)
);

COMMENT ON TABLE  events                IS 'Scheduled events. Parent of tickets.';
COMMENT ON COLUMN events.id             IS 'Surrogate UUID primary key.';
COMMENT ON COLUMN events.name           IS 'Display name of the event.';
COMMENT ON COLUMN events.event_date     IS 'Event start time in UTC (TIMESTAMPTZ).';
COMMENT ON COLUMN events.organizer      IS 'Organizer display name. See SCHEMA_DESIGN.md for FK migration plan.';
COMMENT ON COLUMN events.capacity       IS 'Max tickets sellable. Must be > 0.';

-- -----------------------------------------------------------------------------
-- Table 2: attendees
-- Purpose: One row per unique person who has ever bought a ticket.
-- Relationships:
--   attendees 1 -- N tickets (via tickets.attendee_id, ON DELETE CASCADE)
--
-- Normalization note:
--   attendees is intentionally decoupled from events. A single attendee can
--   buy tickets to many events without duplicating their email/name. This is
--   what keeps the schema in 3NF: the attendee's identity does not depend on
--   any particular event.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendees (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    name            VARCHAR(255)    NOT NULL,

    -- Email is GLOBALLY unique. Rationale (see SCHEMA_DESIGN.md):
    --   * One email = one person account.
    --   * Same person attending many events => many tickets, one attendee row.
    --   * Per-event uniqueness would force duplicate attendee rows and break 3NF.
    -- VARCHAR(320) is the RFC 5321 maximum (64 local + @ + 255 domain).
    email           VARCHAR(320)    NOT NULL,

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Citext would be an alternative (case-insensitive). We instead enforce
    -- application-side lowercasing + a CHECK that the stored value is already
    -- lowercase, which keeps the column a plain VARCHAR (more portable).
    CONSTRAINT attendees_email_lowercase_chk CHECK (email = LOWER(email)),
    CONSTRAINT attendees_email_format_chk    CHECK (email LIKE '%_@_%.__%'),
    CONSTRAINT attendees_email_unique        UNIQUE (email)
);

COMMENT ON TABLE  attendees             IS 'Globally unique people who can purchase tickets.';
COMMENT ON COLUMN attendees.email       IS 'RFC-5321-bounded email, stored lowercase, globally unique.';

-- -----------------------------------------------------------------------------
-- Table 3: tickets
-- Purpose: Junction-with-attributes between events and attendees.
--          Each row is one purchased ticket with its own price and lifecycle.
-- Relationships:
--   tickets N -- 1 events    (RESTRICT -- cannot delete an event with tickets)
--   tickets N -- 1 attendees (CASCADE  -- if attendee is wiped, tickets go too)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- FK to events. RESTRICT prevents accidental loss of historical sales data
    -- when an event row is deleted -- you must explicitly cancel the tickets first.
    event_id        UUID            NOT NULL
        REFERENCES events(id) ON DELETE RESTRICT ON UPDATE CASCADE,

    -- FK to attendees. CASCADE on delete: when a person exercises a "delete my
    -- account" right (GDPR/CCPA), their tickets must go with them.
    attendee_id     UUID            NOT NULL
        REFERENCES attendees(id) ON DELETE CASCADE ON UPDATE CASCADE,

    -- Price at time of purchase. Stored on the ticket (not derived from the
    -- event) so historical pricing is preserved if the event price changes.
    -- This is documented denormalization for an audit/financial requirement.
    price           DECIMAL(10, 2)  NOT NULL,

    -- Lifecycle state. VARCHAR + CHECK is preferred over a PG ENUM because
    -- adding new statuses later is a single ALTER vs. an ENUM migration dance.
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',

    -- Audit timestamps.
    purchased_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT tickets_price_nonneg_chk     CHECK (price >= 0),
    CONSTRAINT tickets_status_allowed_chk   CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

COMMENT ON TABLE  tickets               IS 'Tickets purchased by attendees for events.';
COMMENT ON COLUMN tickets.price         IS 'Price at purchase time (denormalized -- documented).';
COMMENT ON COLUMN tickets.status        IS 'Lifecycle: pending | confirmed | cancelled.';

-- -----------------------------------------------------------------------------
-- updated_at trigger function
-- Reusable -- attach to any table with an updated_at column.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_set_updated_at    ON events;
DROP TRIGGER IF EXISTS attendees_set_updated_at ON attendees;
DROP TRIGGER IF EXISTS tickets_set_updated_at   ON tickets;

CREATE TRIGGER events_set_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER attendees_set_updated_at
    BEFORE UPDATE ON attendees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tickets_set_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes are defined in indexes.sql so they can be reviewed and tuned in isolation.
