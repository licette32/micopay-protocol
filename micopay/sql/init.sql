-- Micopay MVP — Schema simplificado
-- Solo las tablas necesarias para el flujo del trade

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- USERS
-- ================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stellar_address VARCHAR(56) UNIQUE,
  username        VARCHAR(30) UNIQUE,
  phone_hash      VARCHAR(64) UNIQUE,
  deleted_username        VARCHAR(30),
  deleted_stellar_address VARCHAR(56),
  deleted_phone_hash      VARCHAR(64),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_stellar ON users (stellar_address);

-- ================================================
-- AUDIT LOG
-- ================================================
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          VARCHAR(64) NOT NULL,
  actor_user_id   UUID REFERENCES users(id),
  entity_type     VARCHAR(32) NOT NULL,
  entity_id       UUID NOT NULL,
  details         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log (actor_user_id, created_at);

-- ================================================
-- WALLETS
-- ================================================
CREATE TABLE wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id),
  stellar_address VARCHAR(56) NOT NULL,
  wallet_type     VARCHAR(15) DEFAULT 'self_custodial',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TRADES
-- ================================================
CREATE TABLE trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  seller_id       UUID NOT NULL REFERENCES users(id),
  buyer_id        UUID NOT NULL REFERENCES users(id),

  amount_mxn      INTEGER NOT NULL,
  amount_stroops  BIGINT NOT NULL,
  seller_fee_mxn  INTEGER NOT NULL DEFAULT 0,
  platform_fee_mxn INTEGER NOT NULL DEFAULT 0,

  -- HTLC
  secret_hash     VARCHAR(64) NOT NULL,
  secret_enc      BYTEA,
  secret_nonce    BYTEA,

  -- Estado
  status          VARCHAR(12) DEFAULT 'pending'
                  CHECK (status IN (
                    'pending', 'locked', 'revealing',
                    'completed', 'cancelled', 'refunded'
                  )),

  -- Stellar
  stellar_trade_id VARCHAR(64),
  lock_tx_hash    VARCHAR(64),
  release_tx_hash VARCHAR(64),

  -- Timestamps
  locked_at       TIMESTAMPTZ,
  reveal_requested_at TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_seller ON trades (seller_id, status);
CREATE INDEX idx_trades_buyer ON trades (buyer_id, status);
CREATE INDEX idx_trades_status ON trades (status, expires_at)
  WHERE status IN ('locked', 'revealing');

-- ================================================
-- SECRET ACCESS LOG
-- ================================================
CREATE TABLE secret_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id        UUID NOT NULL REFERENCES trades(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  ip_address      INET NOT NULL,
  user_agent      TEXT,
  accessed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_secret_access_trade ON secret_access_log (trade_id);
