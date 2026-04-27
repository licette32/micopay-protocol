import db from "../db/schema.js";
import { logAuditEvent } from "./audit.service.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";

interface ActiveUserRow {
  id: string;
  username: string;
  stellar_address: string;
  phone_hash: string | null;
  deleted_at: string | null;
}

const ACTIVE_TRADE_STATUSES = ["pending", "locked", "revealing"] as const;

export async function deleteAccount(userId: string, confirmUsername: string) {
  const user = await db.getOne<ActiveUserRow>(
    "SELECT id, username, stellar_address, phone_hash, deleted_at FROM users WHERE id = $1 AND deleted_at IS NULL",
    [userId],
  );

  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (user.username !== confirmUsername) {
    throw new ConflictError(
      "Confirmation username does not match the current account",
    );
  }

  const activeTrades = await db.getMany<{ id: string }>(
    `SELECT id FROM trades
     WHERE (seller_id = $1 OR buyer_id = $1)
       AND status IN ('pending', 'locked', 'revealing')`,
    [userId],
  );

  if (activeTrades.length > 0) {
    throw new ConflictError(
      "Finish or cancel all active trades before deleting your account",
    );
  }

  await db.execute(
    `UPDATE users
     SET deleted_at = NOW(),
         deleted_username = $2,
         deleted_stellar_address = $3,
         deleted_phone_hash = $4,
         username = NULL,
         stellar_address = NULL,
         phone_hash = NULL
     WHERE id = $1`,
    [userId, user.username, user.stellar_address, user.phone_hash],
  );

  await logAuditEvent({
    action: "account.deleted",
    actorUserId: userId,
    entityType: "user",
    entityId: userId,
    details: {
      activeTradeCount: activeTrades.length,
      deletedUsername: user.username,
    },
  });

  return { status: "deleted" as const };
}
