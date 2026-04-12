import type { FastifyInstance } from "fastify";
import { requirePayment } from "../middleware/x402.js";

// ── Tier definitions ─────────────────────────────────────────────────────────
const TIERS = [
  { name: "maestro",  emoji: "🍄", min_trades: 100, min_completion: 0.95, description: "Top-tier merchant. Trusted by AI agents." },
  { name: "experto",  emoji: "⭐", min_trades: 30,  min_completion: 0.88, description: "Reliable merchant with solid track record." },
  { name: "activo",   emoji: "✅", min_trades: 10,  min_completion: 0.80, description: "Active merchant. Growing reputation." },
  { name: "espora",   emoji: "🌱", min_trades: 0,   min_completion: 0.0,  description: "New merchant. Use with caution." },
];

function getTier(trades: number, completion: number) {
  return TIERS.find((t) => trades >= t.min_trades && completion >= t.min_completion) ?? TIERS[TIERS.length - 1];
}

// ── Seeded mock reputation data keyed by Stellar address ─────────────────────
// In production: query MicoPay P2P backend + on-chain NFT soulbound data
const KNOWN_MERCHANTS: Record<string, {
  name: string;
  location: string;
  trades_completed: number;
  completion_rate: number;
  avg_time_minutes: number;
  volume_usdc: string;
  on_chain_since: string;
  nft_token_id?: string;
}> = {
  "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKUJI5KOOJ9TXWNTBBS2JN": {
    name: "Farmacia Guadalupe",
    location: "Roma Norte, CDMX",
    trades_completed: 312,
    completion_rate: 0.98,
    avg_time_minutes: 4,
    volume_usdc: "8420.50",
    on_chain_since: "2025-09-14T10:22:00Z",
    nft_token_id: "MCR-MAESTRO-0001",
  },
  "GDAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A": {
    name: "Tienda Don Pepe",
    location: "Roma Norte, CDMX",
    trades_completed: 89,
    completion_rate: 0.94,
    avg_time_minutes: 7,
    volume_usdc: "2310.75",
    on_chain_since: "2025-11-03T15:45:00Z",
  },
  "GBZXN7PIRZGNMHGA7MUUUF4GWMTISGNQ5E72TFL6GDWPE6K4RCAVOALV": {
    name: "Abarrotes La Esperanza",
    location: "Hipódromo Condesa, CDMX",
    trades_completed: 54,
    completion_rate: 0.91,
    avg_time_minutes: 10,
    volume_usdc: "1180.20",
    on_chain_since: "2025-12-01T09:00:00Z",
  },
  "GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4B": {
    name: "Mini Super Estrella",
    location: "Hipódromo, CDMX",
    trades_completed: 8,
    completion_rate: 0.71,
    avg_time_minutes: 18,
    volume_usdc: "145.00",
    on_chain_since: "2026-01-20T12:30:00Z",
  },
};

function buildReputationFromAddress(address: string) {
  // For unknown addresses, derive pseudo-random reputation from address characters
  const seed = address.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const trades = (seed % 50) + 5;
  const completion = 0.70 + ((seed % 25) / 100);
  return {
    name: `Merchant ${address.slice(0, 6)}...${address.slice(-4)}`,
    location: "México",
    trades_completed: trades,
    completion_rate: parseFloat(completion.toFixed(2)),
    avg_time_minutes: 8 + (seed % 12),
    volume_usdc: ((trades * 25) + (seed % 100)).toFixed(2),
    on_chain_since: "2026-01-01T00:00:00Z",
    nft_token_id: undefined,
  };
}

export async function reputationRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/reputation/:address
   * x402: $0.0005 USDC
   *
   * Returns the on-chain reputation of a MicoPay merchant.
   * The reputation is derived from completed trades recorded on Stellar
   * and an optional NFT soulbound badge that cannot be transferred.
   *
   * AI agents use this to decide whether to trust a merchant before
   * initiating a cash exchange on behalf of a user.
   */
  fastify.get(
    "/api/v1/reputation/:address",
    { preHandler: requirePayment({ amount: "0.0005", service: "reputation" }) },
    async (request, reply) => {
      const { address } = request.params as { address: string };

      // Basic Stellar address validation
      if (!address.startsWith("G") || address.length !== 56) {
        return reply.status(400).send({
          error: "Invalid Stellar address",
          hint: "Stellar addresses start with G and are 56 characters long",
        });
      }

      const data = KNOWN_MERCHANTS[address] ?? buildReputationFromAddress(address);
      const tier = getTier(data.trades_completed, data.completion_rate);

      // Agent-friendly decision signal
      const trusted = data.completion_rate >= 0.88 && data.trades_completed >= 10;
      const recommendation = trusted
        ? `✅ Trusted. ${tier.emoji} ${tier.name.toUpperCase()} merchant. Send user with confidence.`
        : `⚠️ Low trust. Only ${data.trades_completed} trades, ${(data.completion_rate * 100).toFixed(0)}% completion. Consider alternatives.`;

      return reply.send({
        address,
        merchant: {
          name: data.name,
          location: data.location,
        },
        reputation: {
          tier: tier.name,
          tier_emoji: tier.emoji,
          tier_description: tier.description,
          trades_completed: data.trades_completed,
          completion_rate: data.completion_rate,
          completion_percent: `${(data.completion_rate * 100).toFixed(1)}%`,
          avg_time_minutes: data.avg_time_minutes,
          total_volume_usdc: data.volume_usdc,
          on_chain_since: data.on_chain_since,
          nft_soulbound: data.nft_token_id
            ? {
                token_id: data.nft_token_id,
                transferable: false,
                status: "planned",
                note: "Token ID reserved for a non-transferable Soroban badge contract (not yet deployed). Reputation is derived from MicoPay P2P trade history.",
              }
            : null,
        },
        agent_signal: {
          trusted,
          recommendation,
          risk_level: trusted
            ? data.completion_rate >= 0.95 ? "low" : "medium"
            : "high",
        },
        data_source: "MicoPay P2P trade history (testnet demo data)",
        queried_at: new Date().toISOString(),
      });
    }
  );
}
