# Task 7: Schema Design (Normalization)

**Agent:** data-engineer

**Objective:** Design a normalized relational schema for an event management system.

---

## Input Specification

**Requirement:** Design a schema for event management that includes:
- Events: event_id, name, date, organizer, capacity
- Attendees: attendee_id, name, email, event_id
- Tickets: ticket_id, attendee_id, event_id, price, status
- Ensure no redundancy, proper relationships, suitable indexes

---

## Output Specification

Generate SQL CREATE TABLE statements that:
- ✅ Define all three tables with proper column types
- ✅ Set primary keys (UUID or auto-increment)
- ✅ Set foreign keys to enforce referential integrity
- ✅ Add constraints (NOT NULL, UNIQUE, CHECK)
- ✅ Include indexes on:
  - Primary keys
  - Foreign keys
  - Columns used in WHERE/JOIN (event_id, email, status)
- ✅ Include comments explaining design decisions
- ✅ Ensure 3NF normalization (no redundant data)

---

## Success Criteria

- ✅ SQL syntax is correct (can be parsed)
- ✅ Tables are normalized (no data redundancy)
- ✅ Foreign keys prevent orphaned records
- ✅ Indexes placed appropriately on:
  - Primary keys
  - Foreign keys (user_id, event_id in tickets)
  - Query columns (status on tickets, email on attendees)
- ✅ Constraints enforced (NOT NULL on required fields, UNIQUE on email)
- ✅ Comments explain each table's purpose
- ✅ No obvious performance issues or anti-patterns

---

## Notes

- Use UUID for primary keys (or explain if using auto-increment)
- Assume PostgreSQL or MySQL syntax
- Include CASCADE or SET NULL for foreign key delete behavior (document choice)
- Design for typical queries: "Get all attendees for event X", "Find tickets by email", "List all events"
- Document normalization rationale in comments
