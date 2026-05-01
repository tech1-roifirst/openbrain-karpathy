-- Events table — schema for the ETL pipeline.
-- Idempotency hinges on a UNIQUE constraint on `external_id`.

CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY,
  external_id   VARCHAR(255) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  "date"        TIMESTAMPTZ  NOT NULL,
  location      VARCHAR(255) NOT NULL,
  latitude      DECIMAL(10, 8) NOT NULL,
  longitude     DECIMAL(11, 8) NOT NULL,
  processed_at  TIMESTAMPTZ  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT events_name_not_empty     CHECK (length(trim(name))     > 0),
  CONSTRAINT events_location_not_empty CHECK (length(trim(location)) > 0)
);

CREATE INDEX IF NOT EXISTS events_date_idx        ON events ("date");
CREATE INDEX IF NOT EXISTS events_processed_at_idx ON events (processed_at);
