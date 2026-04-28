import db from './schema.js';

export interface TradeAuditEventInput {
  tradeId: string;
  fromState: string;
  toState: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface TradeAuditEvent {
  id: string;
  trade_id: string;
  from_state: string;
  to_state: string;
  actor: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export async function insertTradeAuditEvent(input: TradeAuditEventInput): Promise<TradeAuditEvent> {
  const { tradeId, fromState, toState, actor, metadata = {} } = input;

  const event = await db.getOne<TradeAuditEvent>(
    `INSERT INTO audit_log (trade_id, from_state, to_state, actor, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, trade_id, from_state, to_state, actor, metadata, occurred_at`,
    [tradeId, fromState, toState, actor, metadata],
  );

  if (!event) {
    throw new Error('Failed to insert trade audit event');
  }

  return event;
}

export async function getTradeAuditTrail(tradeId: string): Promise<TradeAuditEvent[]> {
  return db.getMany<TradeAuditEvent>(
    `SELECT id, trade_id, from_state, to_state, actor, metadata, occurred_at
     FROM audit_log
     WHERE trade_id = $1
     ORDER BY occurred_at ASC, id ASC`,
    [tradeId],
  );
}
