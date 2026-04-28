CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id        UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  from_state      VARCHAR(12) NOT NULL,
  to_state        VARCHAR(12) NOT NULL,
  actor           TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_trade_time ON audit_log (trade_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_audit_log_trade_to_state ON audit_log (trade_id, to_state);
