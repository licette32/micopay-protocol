import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { tradeRoutes } from './routes/trades.js';
import { stellarRoutes } from './routes/stellar.js';
import { defiRoutes } from './routes/defi.js';
import { merchantRoutes } from './routes/merchants.js';
import { AppError } from './utils/errors.js';
import { Keypair } from '@stellar/stellar-sdk';

const app = Fastify({
  logger: process.env.NODE_ENV === 'development' ? {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss Z' },
    },
  } : {
    level: 'info',
    formatters: {
      bindings: (o) => ({ ...o, service: 'micopay-backend' }),
    },
  },
});

// --- Plugins ---

// CORS — Allow all origins for the hackathon deployment
app.register(fastifyCors, { 
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// JWT
app.register(fastifyJwt, {
  secret: config.jwtSecret,
});

// Rate limit (optional — gracefully skip if not available)
try {
  const rateLimit = await import('@fastify/rate-limit');
  app.register(rateLimit.default, { global: false });
  } catch {
    app.log.warn({ category: 'http' }, '⚠️  @fastify/rate-limit not installed, skipping rate limiting');
  }

// --- Global error handler ---
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: error.name,
      message: error.message,
    });
    return;
  }

  // Fastify validation errors
  if (error.validation) {
    reply.status(400).send({
      error: 'ValidationError',
      message: error.message,
    });
    return;
  }

  // Unknown errors
  request.log.error(error);
  reply.status(500).send({
    error: 'InternalServerError',
    message: 'Something went wrong',
  });
});

// --- Routes ---

app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  mockStellar: config.mockStellar,
  configCheck: {
    hasPlatformKey: !!config.platformSecretKey,
    hasContractId: !!config.escrowContractId,
    hasDbUrl: !!config.databaseUrl,
    hasSecretKey: !!config.secretEncryptionKey,
  }
}));

// Platform account balance from Horizon (public, no auth needed)
app.get('/account/balance', async (request) => {
  try {
    if (!config.platformSecretKey) {
      return { xlm: '0', address: 'Billetera no configurada', status: 'setup_required' };
    }
    const keypair = Keypair.fromSecret(config.platformSecretKey);
    const address = keypair.publicKey();
    const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
    if (!res.ok) return { xlm: '0', address, status: 'not_found_on_chain' };
    const data = await res.json() as { balances: { asset_type: string; balance: string }[] };
    const xlm = data.balances.find((b) => b.asset_type === 'native')?.balance ?? '0';
    return { xlm, address, status: 'ok' };
  } catch (err: any) {
    request.log.error({ err: err.message, category: 'stellar.balance' }, '[Stellar] Balance error');
    return { xlm: '0', address: 'Error', error: err.message };
  }
});

app.register(authRoutes, { prefix: '' });
app.register(userRoutes, { prefix: '' });
app.register(tradeRoutes, { prefix: '' });
app.register(stellarRoutes, { prefix: '' });
app.register(defiRoutes, { prefix: '' });
app.register(merchantRoutes, { prefix: '' });

// --- Start server ---

async function start() {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info({ category: 'http', port: config.port }, '🍄 Micopay MVP Backend running');
    app.log.info({ category: 'http', mockStellar: config.mockStellar }, `Mock Stellar: ${config.mockStellar ? 'ON (no on-chain verification)' : 'OFF (real Soroban RPC)'}`);
    app.log.info({ category: 'http', database: config.databaseUrl.replace(/\/\/.*@/, '//***@') }, 'Database connected');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
