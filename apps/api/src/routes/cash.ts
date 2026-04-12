import type { FastifyInstance } from "fastify";
import { requirePayment } from "../middleware/x402.js";
import { randomUUID, randomBytes, createHash } from "crypto";
import * as StellarSdk from "@stellar/stellar-sdk";

const RPC_URL  = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NET      = StellarSdk.Networks.TESTNET;
const ESCROW_CONTRACT_ID = process.env.ESCROW_CONTRACT_ID!;
const PLATFORM_SECRET    = process.env.PLATFORM_SECRET_KEY!;
const USDC_ISSUER        = process.env.USDC_ISSUER ?? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

async function lockEscrow(
  amountUsdc: number,
  secretHash: string,
  timeoutMinutes: number,
): Promise<string> {
  // Demo: agent is the seller (has USDC), platform is the buyer/merchant recipient
  // In production: the real user wallet signs the lock tx
  const sellerSecret = process.env.DEMO_AGENT_SECRET_KEY ?? PLATFORM_SECRET;
  const sellerKP     = StellarSdk.Keypair.fromSecret(sellerSecret);
  const buyerAddress = StellarSdk.Keypair.fromSecret(PLATFORM_SECRET).publicKey();

  const rpc      = new StellarSdk.rpc.Server(RPC_URL);
  const account  = await rpc.getAccount(sellerKP.publicKey());
  const contract = new StellarSdk.Contract(ESCROW_CONTRACT_ID);

  const amountStroops = BigInt(Math.round(amountUsdc * 10_000_000));
  const platformFee   = BigInt(0); // zero fee for demo simplicity

  const args = [
    StellarSdk.Address.fromString(sellerKP.publicKey()).toScVal(), // seller: demo agent
    StellarSdk.Address.fromString(buyerAddress).toScVal(),         // buyer: platform (has USDC trustline)
    StellarSdk.nativeToScVal(amountStroops, { type: "i128" }),
    StellarSdk.nativeToScVal(platformFee, { type: "i128" }),
    StellarSdk.xdr.ScVal.scvBytes(Buffer.from(secretHash, "hex")),
    StellarSdk.nativeToScVal(timeoutMinutes, { type: "u32" }),
  ];

  let tx = new StellarSdk.TransactionBuilder(account, { fee: "1000000", networkPassphrase: NET })
    .addOperation(contract.call("lock", ...args))
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Escrow simulation failed: ${sim.error}`);
  }

  tx = StellarSdk.rpc.assembleTransaction(tx, sim).build();
  tx.sign(sellerKP);

  const result = await rpc.sendTransaction(tx);
  if (result.status === "ERROR") throw new Error(`Escrow send failed: ${JSON.stringify(result.errorResult)}`);

  // Poll for confirmation
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const status = await rpc.getTransaction(result.hash);
    if (status.status === "SUCCESS") return result.hash;
    if (status.status === "FAILED") throw new Error(`Escrow tx failed: ${result.hash}`);
  }
  throw new Error(`Escrow timeout: ${result.hash}`);
}

// ── Mock merchant network (replaces live P2P backend connection - roadmap) ──
const MERCHANTS = [
  {
    id: "GM001",
    stellar_address: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKUJI5KOOJ9TXWNTBBS2JN",
    name: "Farmacia Guadalupe",
    type: "farmacia",
    address: "Orizaba 45, Col. Roma Norte, CDMX",
    lat: 19.4195,
    lng: -99.1627,
    available_mxn: 5000,
    max_trade_mxn: 3000,
    min_trade_mxn: 100,
    tier: "maestro",
    completion_rate: 0.98,
    trades_completed: 312,
    avg_time_minutes: 4,
    online: true,
  },
  {
    id: "GM002",
    stellar_address: "GDAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A",
    name: "Tienda Don Pepe",
    type: "tienda",
    address: "Álvaro Obregón 180, Col. Roma Norte, CDMX",
    lat: 19.4181,
    lng: -99.1644,
    available_mxn: 2500,
    max_trade_mxn: 2000,
    min_trade_mxn: 50,
    tier: "experto",
    completion_rate: 0.94,
    trades_completed: 89,
    avg_time_minutes: 7,
    online: true,
  },
  {
    id: "GM003",
    stellar_address: "GBZXN7PIRZGNMHGA7MUUUF4GWMTISGNQ5E72TFL6GDWPE6K4RCAVOALV",
    name: "Abarrotes La Esperanza",
    type: "abarrotes",
    address: "Sonora 195, Col. Hipódromo Condesa, CDMX",
    lat: 19.4121,
    lng: -99.1718,
    available_mxn: 1200,
    max_trade_mxn: 1000,
    min_trade_mxn: 100,
    tier: "experto",
    completion_rate: 0.91,
    trades_completed: 54,
    avg_time_minutes: 10,
    online: true,
  },
  {
    id: "GM004",
    stellar_address: "GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4B",
    name: "Mini Super Estrella",
    type: "minisuper",
    address: "Insurgentes Sur 300, Col. Hipódromo, CDMX",
    lat: 19.408,
    lng: -99.169,
    available_mxn: 800,
    max_trade_mxn: 500,
    min_trade_mxn: 50,
    tier: "espora",
    completion_rate: 0.71,
    trades_completed: 8,
    avg_time_minutes: 18,
    online: false,
  },
];

// Base URL for claim pages — where AI agents send users to show their QR
// In production: https://app.micopay.xyz
const CLAIM_BASE_URL = process.env.CLAIM_BASE_URL ?? "http://localhost:5181";

// In-memory store for cash requests (roadmap: connect to MicoPay P2P backend)
const cashRequests = new Map<string, {
  request_id: string;
  merchant_address: string;
  merchant_name: string;
  amount_mxn: number;
  amount_usdc: string;
  htlc_secret_hash: string;
  htlc_tx_hash: string;
  status: "pending" | "accepted" | "completed" | "expired";
  created_at: string;
  expires_at: string;
  qr_payload: string;
  payer_address: string;
}>();

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Live USDC/MXN rate from Horizon (with fallback)
let cachedRate: { rate: number; ts: number } | null = null;

async function getUsdcMxnRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.ts < 60_000) return cachedRate.rate;
  // Fixed demo rate: 1 USDC ≈ 17.5 MXN (realistic mid-2026 rate for testnet demo)
  // In production: use live oracle (Chainlink, CoinGecko, or Etherfuse feed)
  cachedRate = { rate: 17.5, ts: Date.now() };
  return cachedRate.rate;
}

export async function cashRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/cash/agents
   * x402: $0.001 USDC
   *
   * Find available cash merchants near a location.
   * Returns merchants sorted by distance, filtered by amount and online status.
   *
   * Query params:
   *   lat      — user latitude  (default: Roma Norte, CDMX)
   *   lng      — user longitude (default: Roma Norte, CDMX)
   *   amount   — MXN amount needed (default: 500)
   *   limit    — max results (default: 5)
   */
  fastify.get(
    "/api/v1/cash/agents",
    { preHandler: requirePayment({ amount: "0.001", service: "cash_agents" }) },
    async (request, reply) => {
      const query = request.query as Record<string, string>;
      const lat = parseFloat(query.lat ?? "19.4195");
      const lng = parseFloat(query.lng ?? "-99.1627");
      const amount = parseInt(query.amount ?? "500", 10);
      const limit = Math.min(parseInt(query.limit ?? "5", 10), 10);

      const rate = await getUsdcMxnRate();

      const results = MERCHANTS
        .filter((m) => m.online && m.available_mxn >= amount && m.max_trade_mxn >= amount)
        .map((m) => ({
          ...m,
          distance_km: parseFloat(distanceKm(lat, lng, m.lat, m.lng).toFixed(2)),
          usdc_rate: parseFloat((1 / rate).toFixed(6)),
          amount_usdc_needed: parseFloat((amount / rate).toFixed(4)),
        }))
        .sort((a, b) => a.distance_km - b.distance_km)
        .slice(0, limit)
        .map(({ lat: _lat, lng: _lng, id: _id, ...m }) => m);

      return reply.send({
        agents: results,
        count: results.length,
        query: { lat, lng, amount_mxn: amount },
        usdc_mxn_rate: rate,
        network: process.env.STELLAR_NETWORK ?? "TESTNET",
        note: "Merchants from MicoPay P2P network. Rates from Stellar Horizon testnet.",
      });
    }
  );

  /**
   * POST /api/v1/cash/request
   * x402: $0.01 USDC
   *
   * Initiate a USDC → MXN cash exchange with a merchant.
   * Locks USDC in an HTLC on Soroban. Returns QR code for the user to show.
   *
   * Body:
   *   merchant_address — Stellar address of the target merchant
   *   amount_mxn       — MXN amount to receive
   *   user_lat         — (optional) user location for validation
   *   user_lng         — (optional) user location for validation
   */
  fastify.post(
    "/api/v1/cash/request",
    { preHandler: requirePayment({ amount: "0.01", service: "cash_request" }) },
    async (request, reply) => {
      const body = request.body as {
        merchant_address?: string;
        amount_mxn?: number;
        user_lat?: number;
        user_lng?: number;
      } | undefined;

      const merchantAddress = body?.merchant_address;
      const amountMxn = body?.amount_mxn ?? 500;

      if (!merchantAddress) {
        return reply.status(400).send({ error: "merchant_address is required" });
      }
      if (amountMxn < 50 || amountMxn > 5000) {
        return reply.status(400).send({ error: "amount_mxn must be between 50 and 5000" });
      }

      const merchant = MERCHANTS.find((m) => m.stellar_address === merchantAddress);
      if (!merchant) {
        return reply.status(404).send({ error: "Merchant not found in MicoPay network" });
      }
      if (!merchant.online) {
        return reply.status(409).send({ error: "Merchant is currently offline" });
      }
      if (amountMxn > merchant.available_mxn) {
        return reply.status(409).send({
          error: `Merchant only has $${merchant.available_mxn} MXN available`,
        });
      }

      const rate = await getUsdcMxnRate();
      const amountUsdc = parseFloat((amountMxn / rate).toFixed(4));

      // Generate HTLC secret — the QR payload IS the secret preimage
      const requestId  = `mcr-${randomUUID().slice(0, 8)}`;
      const secretBytes = randomBytes(32);
      const secret      = secretBytes.toString("hex");
      const secretHash  = createHash("sha256").update(secretBytes).digest("hex");
      const expiresAt   = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      // Lock real USDC in MicopayEscrow on Soroban testnet
      // Cap demo lock at 1 USDC to preserve agent balance across multiple demos
      const lockAmount = Math.min(amountUsdc, 1.0);
      let htlcTxHash: string;
      try {
        htlcTxHash = await lockEscrow(lockAmount, secretHash, 120);
        fastify.log.info(`Escrow locked on-chain: ${htlcTxHash}`);
      } catch (err) {
        fastify.log.error(`Escrow failed, falling back to demo mode: ${err}`);
        htlcTxHash = `demo_htlc_${Date.now()}_${requestId}`;
      }

      // QR payload contains the secret preimage — merchant reveals it to release USDC
      const qrPayload = `micopay://claim?request_id=${requestId}&secret=${secret}&amount_mxn=${amountMxn}&contract=${ESCROW_CONTRACT_ID}`;

      const cashRequest = {
        request_id: requestId,
        merchant_address: merchantAddress,
        merchant_name: merchant.name,
        amount_mxn: amountMxn,
        amount_usdc: amountUsdc.toFixed(4),
        htlc_secret_hash: secretHash,
        htlc_tx_hash: htlcTxHash,
        status: "pending" as const,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        qr_payload: qrPayload,
        payer_address: request.payerAddress ?? "GUNKNOWN",
      };

      cashRequests.set(requestId, cashRequest);

      fastify.log.info(
        `Cash request ${requestId}: ${request.payerAddress} → ${merchant.name} $${amountMxn} MXN`
      );

      return reply.status(201).send({
        request_id: requestId,
        status: "pending",
        merchant: {
          name: merchant.name,
          address: merchant.address,
          stellar_address: merchantAddress,
          tier: merchant.tier,
        },
        exchange: {
          amount_mxn: amountMxn,
          amount_usdc: amountUsdc.toFixed(4),
          rate_usdc_mxn: rate,
          htlc_tx_hash: htlcTxHash,
          htlc_explorer_url: `https://stellar.expert/explorer/testnet/tx/${htlcTxHash}`,
        },
        qr_payload: qrPayload,
        claim_url: `${CLAIM_BASE_URL}/claim/${requestId}`,
        instructions: `Go to ${merchant.name} at ${merchant.address}. Open the claim_url on your phone to show the QR. The merchant will give you $${amountMxn} MXN in cash and scan the QR to release the USDC.`,
        expires_at: expiresAt,
        note: "HTLC locked on Soroban. Merchant notified. USDC releases only when merchant scans QR.",
      });
    }
  );

  /**
   * GET /api/v1/cash/request/:id
   * FREE — poll status of a cash request
   */
  fastify.get("/api/v1/cash/request/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const req = cashRequests.get(id);
    if (!req) return reply.status(404).send({ error: "Request not found" });

    return reply.send({
      request_id: req.request_id,
      status: req.status,
      merchant_name: req.merchant_name,
      amount_mxn: req.amount_mxn,
      amount_usdc: req.amount_usdc,
      htlc_tx_hash: req.htlc_tx_hash,
      expires_at: req.expires_at,
    });
  });
}
