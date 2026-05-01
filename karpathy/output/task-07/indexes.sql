-- =============================================================================
-- Event Management System -- Indexes
-- Target: PostgreSQL 14+
-- =============================================================================
-- All CREATE INDEX statements are IF NOT EXISTS so this file is idempotent.
--
-- General notes:
--   * Primary keys are indexed automatically (B-tree on id).
--   * UNIQUE constraints (attendees.email) are also indexed automatically.
--   * Every foreign key column SHOULD have its own index, otherwise:
--       (a) JOIN events->tickets and attendees->tickets will be sequential scans, and
--       (b) cascade/restrict checks on parent DELETE/UPDATE will full-scan the child.
--   * Composite indexes follow left-prefix rule -- order columns by selectivity
--     and by how queries actually filter.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- events
-- -----------------------------------------------------------------------------

-- Q3: "List all upcoming events" -- WHERE event_date >= NOW() ORDER BY event_date
-- A B-tree on event_date supports both the range filter and the ORDER BY without
-- a separate sort step.
CREATE INDEX IF NOT EXISTS idx_events_event_date
    ON events (event_date);

-- Q5: "Get all events organized by a specific person" -- WHERE organizer = ?
-- Organizer cardinality is unknown a priori; in production we would consider a
-- LOWER(organizer) functional index, but for the spec a plain B-tree is correct.
CREATE INDEX IF NOT EXISTS idx_events_organizer
    ON events (organizer);

-- -----------------------------------------------------------------------------
-- attendees
-- -----------------------------------------------------------------------------

-- attendees.email is already UNIQUE -> a unique B-tree index exists by virtue
-- of the constraint. We do NOT redundantly create another index here.
-- Q2 ("find tickets by email") will hit the unique index for the attendee
-- lookup, then the FK index on tickets.attendee_id for the join.

-- -----------------------------------------------------------------------------
-- tickets
-- -----------------------------------------------------------------------------

-- FK index #1: tickets.event_id
-- Required for:
--   * Q1 "all attendees for a specific event" (JOIN events->tickets->attendees)
--   * Q4 "ticket count by status for an event" (filter by event_id, aggregate by status)
--   * Cascade integrity checks when an event row is updated.
CREATE INDEX IF NOT EXISTS idx_tickets_event_id
    ON tickets (event_id);

-- FK index #2: tickets.attendee_id
-- Required for:
--   * Q2 "all tickets for a user by email" (after attendee lookup, join here)
--   * Cascade DELETE when an attendee row is removed -- without this index,
--     the cascade does a sequential scan of tickets per delete.
CREATE INDEX IF NOT EXISTS idx_tickets_attendee_id
    ON tickets (attendee_id);

-- Status filter index.
-- Q4 "ticket count by status for an event" filters by status as part of the
-- aggregation. Status has very low cardinality (3 values) so a plain B-tree
-- is not the most selective. We use a composite below for the common case;
-- this single-column index is still useful for global "all cancelled tickets"
-- reporting queries that don't scope by event.
CREATE INDEX IF NOT EXISTS idx_tickets_status
    ON tickets (status);

-- Composite index for JOIN efficiency.
-- Many event-management queries look like:
--   SELECT ... FROM tickets WHERE event_id = ? AND attendee_id = ?
--   SELECT ... FROM tickets WHERE event_id = ? GROUP BY attendee_id
-- A composite (event_id, attendee_id) index is a covering index for both
-- of those access shapes (left-prefix on event_id supports the WHERE-only
-- form too, so this index makes idx_tickets_event_id partially redundant --
-- we keep both because PG planner sometimes prefers the narrower single-column
-- index for very selective scans, and the storage cost is small at this scale).
CREATE INDEX IF NOT EXISTS idx_tickets_event_attendee
    ON tickets (event_id, attendee_id);

-- Composite index for per-event status reports.
-- Q4 "Get ticket count by status for an event" runs:
--   SELECT status, COUNT(*) FROM tickets WHERE event_id = ? GROUP BY status
-- (event_id, status) lets PG do an index-only scan + GroupAggregate without
-- touching the heap.
CREATE INDEX IF NOT EXISTS idx_tickets_event_status
    ON tickets (event_id, status);

-- =============================================================================
-- Performance impact summary
-- =============================================================================
-- WRITE COST: each ticket INSERT now updates 5 indexes (PK + 4 secondaries).
-- For an event-ticketing workload reads massively outnumber writes, so this
-- trade-off is correct. If write throughput becomes a bottleneck, the first
-- index to drop is idx_tickets_status (lowest selectivity, narrowest use case).
--
-- READ EXPECTATIONS (rough, on a 1M-ticket / 10K-event / 100K-attendee dataset):
--   Q1 attendees-for-event       : ~O(log N + K)  via idx_tickets_event_id
--   Q2 tickets-for-email         : ~O(log N)      via attendees_email_unique + FK index
--   Q3 upcoming-events           : ~O(log N + K)  via idx_events_event_date (range scan)
--   Q4 status-counts-per-event   : ~O(log N + S)  via idx_tickets_event_status (index-only)
--   Q5 events-by-organizer       : ~O(log N + K)  via idx_events_organizer
-- =============================================================================
