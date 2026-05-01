-- =============================================================================
-- Event Management System -- Validation Queries
-- Target: PostgreSQL 14+
-- =============================================================================
-- Purpose:
--   Verify schema correctness, exercise referential integrity, demonstrate
--   the five required query patterns, and provide negative-test cases that
--   MUST be rejected by the schema.
--
-- Usage:
--   Run schema.sql + indexes.sql first (or migrations 001-004), then run
--   sections of this file interactively in psql.
-- =============================================================================


-- =============================================================================
-- SECTION A. Schema introspection -- structural correctness
-- =============================================================================

-- A.1 Confirm the three expected tables exist.
SELECT table_name
FROM   information_schema.tables
WHERE  table_schema = 'public'
  AND  table_name IN ('events', 'attendees', 'tickets')
ORDER  BY table_name;
-- Expect: 3 rows.

-- A.2 Confirm primary keys exist on all three tables.
SELECT tc.table_name, tc.constraint_name, kcu.column_name
FROM   information_schema.table_constraints tc
JOIN   information_schema.key_column_usage  kcu USING (constraint_name, table_schema)
WHERE  tc.table_schema = 'public'
  AND  tc.constraint_type = 'PRIMARY KEY'
  AND  tc.table_name IN ('events','attendees','tickets')
ORDER  BY tc.table_name;
-- Expect: 3 rows, each with column_name = 'id'.

-- A.3 Confirm foreign keys exist with the right ON DELETE behavior.
SELECT
    con.conname               AS constraint_name,
    cl.relname                AS child_table,
    pl.relname                AS parent_table,
    con.confdeltype           AS on_delete  -- 'r'=RESTRICT 'c'=CASCADE 'n'=SET NULL 'a'=NO ACTION 'd'=SET DEFAULT
FROM   pg_constraint con
JOIN   pg_class      cl ON cl.oid = con.conrelid
JOIN   pg_class      pl ON pl.oid = con.confrelid
WHERE  con.contype = 'f'
  AND  cl.relname = 'tickets'
ORDER  BY con.conname;
-- Expect:
--   tickets_attendee_id_fkey -> attendees, on_delete = 'c'
--   tickets_event_id_fkey    -> events,    on_delete = 'r'

-- A.4 Confirm the expected indexes are present.
SELECT indexname
FROM   pg_indexes
WHERE  schemaname = 'public'
  AND  tablename IN ('events','attendees','tickets')
ORDER  BY tablename, indexname;
-- Expect at minimum:
--   events_pkey, idx_events_event_date, idx_events_organizer,
--   attendees_pkey, attendees_email_unique,
--   tickets_pkey, idx_tickets_event_id, idx_tickets_attendee_id,
--   idx_tickets_status, idx_tickets_event_attendee, idx_tickets_event_status


-- =============================================================================
-- SECTION B. Sample data load (idempotent via fixed UUIDs + ON CONFLICT)
-- =============================================================================

INSERT INTO events (id, name, event_date, organizer, capacity) VALUES
  ('11111111-1111-1111-1111-111111111111', 'PG Day NYC',     '2026-09-12 09:00:00+00', 'Alice Adams', 300),
  ('22222222-2222-2222-2222-222222222222', 'SQL Tuning 101', '2026-10-04 14:00:00+00', 'Alice Adams', 50),
  ('33333333-3333-3333-3333-333333333333', 'Past Conference','2025-01-10 09:00:00+00', 'Dan Daniels', 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO attendees (id, name, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bob Builder', 'bob@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Carol Coder', 'carol@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Dee Dev',     'dee@example.com')
ON CONFLICT (email) DO NOTHING;

INSERT INTO tickets (id, event_id, attendee_id, price, status) VALUES
  ('ddddddd1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 199.00, 'confirmed'),
  ('ddddddd1-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  79.00, 'pending'),
  ('ddddddd1-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 199.00, 'confirmed'),
  ('ddddddd1-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 199.00, 'cancelled')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- SECTION C. The five required query patterns
-- =============================================================================

-- C.1 Q1: All attendees for a specific event.
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.id, a.name, a.email, t.status, t.price
FROM   attendees a
JOIN   tickets   t ON t.attendee_id = a.id
WHERE  t.event_id = '11111111-1111-1111-1111-111111111111'
ORDER  BY a.name;

-- C.2 Q2: All tickets for a user by email.
EXPLAIN (ANALYZE, BUFFERS)
SELECT t.id, t.event_id, t.status, t.price, t.purchased_at
FROM   attendees a
JOIN   tickets   t ON t.attendee_id = a.id
WHERE  a.email = 'bob@example.com';

-- C.3 Q3: List all upcoming events.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, event_date, organizer, capacity
FROM   events
WHERE  event_date >= NOW()
ORDER  BY event_date ASC;

-- C.4 Q4: Ticket count by status for an event.
EXPLAIN (ANALYZE, BUFFERS)
SELECT status, COUNT(*) AS ticket_count
FROM   tickets
WHERE  event_id = '11111111-1111-1111-1111-111111111111'
GROUP  BY status
ORDER  BY status;

-- C.5 Q5: All events organized by a specific person.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, event_date, capacity
FROM   events
WHERE  organizer = 'Alice Adams'
ORDER  BY event_date DESC;


-- =============================================================================
-- SECTION D. Referential integrity -- positive checks
-- =============================================================================

-- D.1 No orphaned tickets pointing at a nonexistent event.
SELECT COUNT(*) AS orphan_event_fk
FROM   tickets t
LEFT   JOIN events e ON e.id = t.event_id
WHERE  e.id IS NULL;
-- Expect: 0.

-- D.2 No orphaned tickets pointing at a nonexistent attendee.
SELECT COUNT(*) AS orphan_attendee_fk
FROM   tickets t
LEFT   JOIN attendees a ON a.id = t.attendee_id
WHERE  a.id IS NULL;
-- Expect: 0.

-- D.3 No tickets sold beyond an event's capacity (business invariant).
SELECT e.id, e.name, e.capacity,
       COUNT(*) FILTER (WHERE t.status <> 'cancelled') AS active_tickets
FROM   events e
JOIN   tickets t ON t.event_id = e.id
GROUP  BY e.id, e.name, e.capacity
HAVING COUNT(*) FILTER (WHERE t.status <> 'cancelled') > e.capacity;
-- Expect: 0 rows.

-- D.4 Email uniqueness invariant.
SELECT email, COUNT(*) AS dup
FROM   attendees
GROUP  BY email
HAVING COUNT(*) > 1;
-- Expect: 0 rows.


-- =============================================================================
-- SECTION E. Negative tests -- the schema MUST reject these
-- =============================================================================
-- Run each in its own transaction and confirm it errors. Wrapped in DO blocks
-- so you can paste the file in one go without aborting the surrounding work.

-- E.1 Capacity must be positive.
DO $$
BEGIN
    BEGIN
        INSERT INTO events (name, event_date, organizer, capacity)
        VALUES ('Bad Capacity', NOW(), 'X', 0);
        RAISE EXCEPTION 'TEST FAILED: capacity=0 was accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK: capacity=0 rejected by events_capacity_positive_chk';
    END;
END $$;

-- E.2 Price must be non-negative.
DO $$
BEGIN
    BEGIN
        INSERT INTO tickets (event_id, attendee_id, price, status)
        VALUES ('11111111-1111-1111-1111-111111111111',
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                -1.00, 'pending');
        RAISE EXCEPTION 'TEST FAILED: negative price was accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK: negative price rejected by tickets_price_nonneg_chk';
    END;
END $$;

-- E.3 Status must be one of the allowed values.
DO $$
BEGIN
    BEGIN
        INSERT INTO tickets (event_id, attendee_id, price, status)
        VALUES ('11111111-1111-1111-1111-111111111111',
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                10.00, 'refunded');
        RAISE EXCEPTION 'TEST FAILED: invalid status was accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK: invalid status rejected by tickets_status_allowed_chk';
    END;
END $$;

-- E.4 Email must be globally unique.
DO $$
BEGIN
    BEGIN
        INSERT INTO attendees (name, email) VALUES ('Bob Clone', 'bob@example.com');
        RAISE EXCEPTION 'TEST FAILED: duplicate email was accepted';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK: duplicate email rejected by attendees_email_unique';
    END;
END $$;

-- E.5 Email must be lowercase (CHECK).
DO $$
BEGIN
    BEGIN
        INSERT INTO attendees (name, email) VALUES ('Mixed Case', 'NotLower@Example.com');
        RAISE EXCEPTION 'TEST FAILED: mixed-case email was accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK: mixed-case email rejected by attendees_email_lowercase_chk';
    END;
END $$;

-- E.6 Cannot delete an event that has tickets (ON DELETE RESTRICT).
DO $$
BEGIN
    BEGIN
        DELETE FROM events WHERE id = '11111111-1111-1111-1111-111111111111';
        RAISE EXCEPTION 'TEST FAILED: event with tickets was deleted';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'OK: event delete blocked by tickets_event_id_fkey RESTRICT';
    END;
END $$;

-- E.7 Tickets cannot reference a nonexistent event.
DO $$
BEGIN
    BEGIN
        INSERT INTO tickets (event_id, attendee_id, price, status)
        VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff',
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                10.00, 'pending');
        RAISE EXCEPTION 'TEST FAILED: ticket with bogus event_id was accepted';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'OK: bogus event_id rejected by FK';
    END;
END $$;


-- =============================================================================
-- SECTION F. CASCADE behavior on attendees
-- =============================================================================
-- Confirm: deleting an attendee cascades into their tickets.
-- We use a throwaway attendee so the demo data above stays intact.

INSERT INTO attendees (id, name, email)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Temp Tester', 'temp@example.com')
ON CONFLICT (email) DO NOTHING;

INSERT INTO tickets (id, event_id, attendee_id, price, status)
VALUES ('ddddddd1-0000-0000-0000-0000000000ff',
        '22222222-2222-2222-2222-222222222222',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        49.00, 'pending')
ON CONFLICT (id) DO NOTHING;

SELECT COUNT(*) AS temp_tickets_before FROM tickets
WHERE  attendee_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
-- Expect: 1.

DELETE FROM attendees WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

SELECT COUNT(*) AS temp_tickets_after FROM tickets
WHERE  attendee_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
-- Expect: 0 -- cascade removed the child rows.


-- =============================================================================
-- SECTION G. updated_at trigger
-- =============================================================================
-- Confirm updated_at moves forward on UPDATE.

WITH before AS (
    SELECT updated_at AS ts FROM events
    WHERE id = '11111111-1111-1111-1111-111111111111'
)
SELECT 'before' AS phase, ts FROM before;

UPDATE events SET name = name WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT 'after' AS phase, updated_at FROM events
WHERE id = '11111111-1111-1111-1111-111111111111';
-- Expect: 'after' updated_at strictly greater than 'before' ts.
