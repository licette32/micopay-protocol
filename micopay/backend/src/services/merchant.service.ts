import db from '../db/schema.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const GLOBAL_MIN_AMOUNT_MXN = 100;
export const GLOBAL_MAX_AMOUNT_MXN = 50000;

export interface MerchantConfig {
  user_id: string;
  rate_percent: number;
  min_trade_mxn: number;
  max_trade_mxn: number;
  daily_cap_mxn: number;
  updated_at: string;
}

export interface UpdateMerchantConfigInput {
  ratePercent: number;
  minTradeMxn: number;
  maxTradeMxn: number;
  dailyCapMxn: number;
}

const DEFAULT_CONFIG = {
  rate_percent: 1.0,
  min_trade_mxn: 100,
  max_trade_mxn: 50000,
  daily_cap_mxn: 250000,
};

function validateConfig(input: UpdateMerchantConfigInput) {
  const { ratePercent, minTradeMxn, maxTradeMxn, dailyCapMxn } = input;

  if (ratePercent < 0 || ratePercent > 100) {
    throw new BadRequestError('rate_percent must be between 0 and 100');
  }

  if (minTradeMxn < GLOBAL_MIN_AMOUNT_MXN || minTradeMxn > GLOBAL_MAX_AMOUNT_MXN) {
    throw new BadRequestError(`min_trade_mxn must be between ${GLOBAL_MIN_AMOUNT_MXN} and ${GLOBAL_MAX_AMOUNT_MXN}`);
  }

  if (maxTradeMxn < GLOBAL_MIN_AMOUNT_MXN || maxTradeMxn > GLOBAL_MAX_AMOUNT_MXN) {
    throw new BadRequestError(`max_trade_mxn must be between ${GLOBAL_MIN_AMOUNT_MXN} and ${GLOBAL_MAX_AMOUNT_MXN}`);
  }

  if (minTradeMxn > maxTradeMxn) {
    throw new BadRequestError('min_trade_mxn cannot exceed max_trade_mxn');
  }

  if (dailyCapMxn < maxTradeMxn) {
    throw new BadRequestError('daily_cap_mxn must be greater than or equal to max_trade_mxn');
  }
}

export async function getOrCreateMerchantConfig(userId: string): Promise<MerchantConfig> {
  const user = await db.getOne('SELECT id FROM users WHERE id = $1', [userId]);
  if (!user) throw new NotFoundError('Merchant not found');

  const existing = await db.getOne<MerchantConfig>(
    'SELECT user_id, rate_percent, min_trade_mxn, max_trade_mxn, daily_cap_mxn, updated_at FROM merchant_configs WHERE user_id = $1',
    [userId],
  );
  if (existing) return existing;

  const created = await db.getOne<MerchantConfig>(
    `INSERT INTO merchant_configs (user_id, rate_percent, min_trade_mxn, max_trade_mxn, daily_cap_mxn, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING user_id, rate_percent, min_trade_mxn, max_trade_mxn, daily_cap_mxn, updated_at`,
    [
      userId,
      DEFAULT_CONFIG.rate_percent,
      DEFAULT_CONFIG.min_trade_mxn,
      DEFAULT_CONFIG.max_trade_mxn,
      DEFAULT_CONFIG.daily_cap_mxn,
    ],
  );

  return created!;
}

export async function updateMerchantConfig(userId: string, input: UpdateMerchantConfigInput): Promise<MerchantConfig> {
  validateConfig(input);

  await getOrCreateMerchantConfig(userId);

  const updated = await db.getOne<MerchantConfig>(
    `UPDATE merchant_configs
     SET rate_percent = $2,
         min_trade_mxn = $3,
         max_trade_mxn = $4,
         daily_cap_mxn = $5,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING user_id, rate_percent, min_trade_mxn, max_trade_mxn, daily_cap_mxn, updated_at`,
    [userId, input.ratePercent, input.minTradeMxn, input.maxTradeMxn, input.dailyCapMxn],
  );

  return updated!;
}
