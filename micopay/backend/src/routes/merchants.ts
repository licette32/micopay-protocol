import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getOrCreateMerchantConfig, updateMerchantConfig } from '../services/merchant.service.js';

export async function merchantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/merchants/me/config', async (request) => {
    const config = await getOrCreateMerchantConfig(request.user.id);
    return {
      config,
      daily_cap_reset_timezone: 'UTC',
      daily_cap_reset_time: '00:00',
      daily_cap_reset_note: 'Daily cap usage resets every day at 00:00 UTC.',
    };
  });

  app.put('/merchants/me/config', {
    schema: {
      body: {
        type: 'object',
        required: ['rate_percent', 'min_trade_mxn', 'max_trade_mxn', 'daily_cap_mxn'],
        properties: {
          rate_percent: { type: 'number', minimum: 0, maximum: 100 },
          min_trade_mxn: { type: 'integer', minimum: 100, maximum: 50000 },
          max_trade_mxn: { type: 'integer', minimum: 100, maximum: 50000 },
          daily_cap_mxn: { type: 'integer', minimum: 100 },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    const body = request.body as {
      rate_percent: number;
      min_trade_mxn: number;
      max_trade_mxn: number;
      daily_cap_mxn: number;
    };

    const config = await updateMerchantConfig(request.user.id, {
      ratePercent: body.rate_percent,
      minTradeMxn: body.min_trade_mxn,
      maxTradeMxn: body.max_trade_mxn,
      dailyCapMxn: body.daily_cap_mxn,
    });

    return {
      config,
      daily_cap_reset_timezone: 'UTC',
      daily_cap_reset_time: '00:00',
      daily_cap_reset_note: 'Daily cap usage resets every day at 00:00 UTC.',
    };
  });
}
