import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { UpstreamError } from '../utils/errors.js';

export async function stellarRoutes(app: FastifyInstance) {
  /**
   * POST /stellar/submit
   * Relay a signed transaction to Stellar.
   * Rate limited (10 per minute per IP).
   */
  app.post('/stellar/submit', {
    preHandler: [authMiddleware],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['xdr'],
        properties: {
          xdr: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { xdr } = request.body as { xdr: string };

    try {
      const { TransactionBuilder, Networks, rpc: rpcModule } = await import('@stellar/stellar-sdk');
      const { config } = await import('../config.js');

      if (config.mockStellar) {
        // In mock mode, just return a fake hash
        const fakeHash = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        return { hash: fakeHash, status: 'PENDING' };
      }

      const networkPassphrase =
        config.stellarNetwork === 'TESTNET' ? Networks.TESTNET : Networks.PUBLIC;

      const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
      const rpc = new rpcModule.Server(config.stellarRpcUrl);
      const result = await rpc.sendTransaction(tx);

      return { hash: result.hash, status: result.status };
    } catch (err: any) {
      throw new UpstreamError(
        'STELLAR_SUBMIT_FAILED',
        'Error al enviar la transacción a Stellar.',
        err.message || 'Failed to submit transaction'
      );
    }
  });
}
