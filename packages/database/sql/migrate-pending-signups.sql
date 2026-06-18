-- Registros pendientes de pago (signup + PayMatuByte)
CREATE TABLE IF NOT EXISTS pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_enc TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  payment_reference TEXT NOT NULL UNIQUE,
  link_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  user_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_ref ON pending_signups(payment_reference);
