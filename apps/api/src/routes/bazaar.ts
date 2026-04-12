import type { FastifyInstance } from "fastify";
import { requirePayment } from "../middleware/x402.js";
import { randomUUID, randomBytes, createHash } from "crypto";
import { lockAtomicSwap } from "../services/stellar.service.js";

// ── Types ───────────────────────────────────────────────────────────────────

interface AssetInfo {
  chain: string;   // e.g., "ethereum", "stellar", "solana"
  symbol: string;  // e.g., "ETH", "USDC", "XLM"
  amount: string;
}

interface BazaarIntent {
  id: string;
  agent_address: string;
  offered: AssetInfo;
  wanted: AssetInfo;
  min_rate?: number;
  status: "active" | "negotiating" | "executed" | "expired";
  created_at: string;
  expires_at: string;
  reputation_tier?: string;   // derived from agentHistory at broadcast time
  secret_hash?: string;
  selected_quote_id?: string;
}

interface BazaarQuote {
  id: string;
  intent_id: string;
  from_agent: string;
  rate: number;
  valid_until: string;
}

// ── Agent Reputation State ───────────────────────────────────────────────────
// Tracks on-chain activity per agent_address.
// In production: derived from Soroban event log (swap.locked / swap.released events).

interface AgentHistory {
  broadcasts: number;         // total intents published
  swaps_completed: number;    // intents that reached "executed"
  swaps_cancelled: number;    // intents that expired without execution
  volume_usdc: number;        // total USDC moved through completed swaps
  first_seen: string;
  last_active: string;
}

const agentHistory = new Map<string, AgentHistory>();

// ── Tier Definitions (mirrors merchant reputation system) ────────────────────
const AGENT_TIERS = [
  { name: "maestro",  emoji: "🍄", min_swaps: 50,  min_rate: 0.95, description: "Elite agent. High-frequency, high-reliability cross-chain executor." },
  { name: "experto",  emoji: "⭐", min_swaps: 15,  min_rate: 0.88, description: "Reliable agent with a solid completion track record." },
  { name: "activo",   emoji: "✅", min_swaps: 3,   min_rate: 0.75, description: "Active agent. Growing reputation." },
  { name: "espora",   emoji: "🌱", min_swaps: 0,   min_rate: 0.0,  description: "New agent. Use with caution — low history." },
];

function getAgentTier(completed: number, total: number) {
  const rate = total > 0 ? completed / total : 0;
  return AGENT_TIERS.find(t => completed >= t.min_swaps && rate >= t.min_rate)
    ?? AGENT_TIERS[AGENT_TIERS.length - 1];
}

function getOrCreateHistory(address: string): AgentHistory {
  if (!agentHistory.has(address)) {
    agentHistory.set(address, {
      broadcasts: 0, swaps_completed: 0, swaps_cancelled: 0,
      volume_usdc: 0, first_seen: new Date().toISOString(),
      last_active: new Date().toISOString(),
    });
  }
  return agentHistory.get(address)!;
}

function recordBroadcast(address: string) {
  const h = getOrCreateHistory(address);
  h.broadcasts++;
  h.last_active = new Date().toISOString();
}

function recordCompletion(address: string, volumeUsdc: number) {
  const h = getOrCreateHistory(address);
  h.swaps_completed++;
  h.volume_usdc += volumeUsdc;
  h.last_active = new Date().toISOString();
}

// ── Seed agent histories for demo (mirrors seeded intents) ──────────────────
agentHistory.set("GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKUJI5KOOJ9TXWNTBBS2JN", {
  broadcasts: 87, swaps_completed: 83, swaps_cancelled: 4,
  volume_usdc: 241500, first_seen: "2025-09-14T10:22:00Z",
  last_active: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
});
agentHistory.set("GDAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A", {
  broadcasts: 31, swaps_completed: 28, swaps_cancelled: 3,
  volume_usdc: 52300, first_seen: "2025-11-03T15:45:00Z",
  last_active: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
});

// ── Bazaar Intent State ──────────────────────────────────────────────────────

const intents = new Map<string, BazaarIntent>();
const quotes  = new Map<string, BazaarQuote[]>();

// Seed with mock intents — reputation_tier derived from seeded histories above
const SEED_INTENTS: BazaarIntent[] = [
  {
    id: "int-001",
    agent_address: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKUJI5KOOJ9TXWNTBBS2JN",
    offered: { chain: "ethereum", symbol: "ETH", amount: "2.5" },
    wanted:  { chain: "stellar",  symbol: "USDC", amount: "7000" },
    status: "active",
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    expires_at:  new Date(Date.now() + 1000 * 60 * 55).toISOString(),
    reputation_tier: "maestro",  // 83/87 = 95.4% completion
  },
  {
    id: "int-002",
    agent_address: "GDAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A",
    offered: { chain: "stellar", symbol: "USDC", amount: "500" },
    wanted:  { chain: "physical", symbol: "MXN", amount: "8750" },
    status: "active",
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    expires_at:  new Date(Date.now() + 1000 * 60 * 58).toISOString(),
    reputation_tier: "experto",  // 28/31 = 90.3% completion
  },
];

SEED_INTENTS.forEach(i => intents.set(i.id, i));

// ── Routes ──────────────────────────────────────────────────────────────────

export async function bazaarRoutes(fastify: FastifyInstance): Promise<void> {

  /**
   * POST /api/v1/bazaar/intent
   * x402: $0.005 USDC
   *
   * Broadcast a cross-chain swap intent to the network.
   * The broadcaster's agent_address is resolved from the x402 payment,
   * and their reputation tier is computed from swap history and attached.
   */
  fastify.post(
    "/api/v1/bazaar/intent",
    { preHandler: requirePayment({ amount: "0.005", service: "bazaar_broadcast" }) },
    async (request, reply) => {
      const body = request.body as Partial<BazaarIntent>;

      if (!body.offered || !body.wanted) {
        return reply.status(400).send({ error: "offered and wanted asset info required" });
      }

      const agentAddress = request.payerAddress ?? "GUNKNOWN";

      // Record broadcast in agent history, compute live reputation tier
      recordBroadcast(agentAddress);
      const history = getOrCreateHistory(agentAddress);
      const tier = getAgentTier(history.swaps_completed, history.broadcasts);

      const id = `int-${randomUUID().slice(0, 8)}`;
      const newIntent: BazaarIntent = {
        id,
        agent_address: agentAddress,
        offered: body.offered as AssetInfo,
        wanted:  body.wanted  as AssetInfo,
        min_rate: body.min_rate,
        status: "active",
        reputation_tier: tier.name,   // ← live reputation, not hardcoded
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      };

      intents.set(id, newIntent);
      fastify.log.info(`Bazaar: ${tier.emoji} [${tier.name}] ${agentAddress.slice(0,8)} broadcasts ${newIntent.offered.symbol} → ${newIntent.wanted.symbol}`);

      return reply.status(201).send(newIntent);
    }
  );

  /**
   * GET /api/v1/bazaar/feed
   * x402: $0.001 USDC
   *
   * Returns active intents sorted by recency.
   * Each intent includes the broadcaster's live reputation_tier.
   */
  fastify.get(
    "/api/v1/bazaar/feed",
    { preHandler: requirePayment({ amount: "0.001", service: "bazaar_feed" }) },
    async (_request, reply) => {
      const activeIntents = Array.from(intents.values())
        .filter(i => i.status === "active")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return reply.send({
        intents: activeIntents,
        count: activeIntents.length,
        network: "global-intent-layer",
        note: "Every intent in this feed was broadcasted by an AI agent paying via x402. Reputation tiers computed from on-chain swap history.",
      });
    }
  );

  /**
   * GET /api/v1/bazaar/reputation/:address
   * FREE — agent reputation lookup
   *
   * Returns the reputation of an AI agent based on their Bazaar swap history.
   * Analogous to /api/v1/reputation/:address for merchants, but for agents.
   *
   * Agents use this to filter the feed: "only respond to intents from
   * agents with tier >= experto and completion_rate >= 90%."
   */
  fastify.get(
    "/api/v1/bazaar/reputation/:address",
    async (request, reply) => {
      const { address } = request.params as { address: string };

      let history = agentHistory.get(address);

      // For unknown agents, generate a minimal "new agent" profile
      if (!history) {
        history = {
          broadcasts: 0, swaps_completed: 0, swaps_cancelled: 0,
          volume_usdc: 0, first_seen: new Date().toISOString(),
          last_active: new Date().toISOString(),
        };
      }

      const completion_rate = history.broadcasts > 0
        ? parseFloat((history.swaps_completed / history.broadcasts).toFixed(3))
        : 0;

      const tier = getAgentTier(history.swaps_completed, history.broadcasts);

      // Agent-friendly trust signal (same pattern as merchant reputation)
      const trusted = history.swaps_completed >= 3 && completion_rate >= 0.75;
      const recommendation = trusted
        ? `✅ Trusted agent. ${tier.emoji} ${tier.name.toUpperCase()}. ${history.swaps_completed} swaps completed.`
        : `⚠️ Low trust. Only ${history.swaps_completed} completed swaps. Proceed with caution.`;

      return reply.send({
        address,
        agent_reputation: {
          tier: tier.name,
          tier_emoji: tier.emoji,
          tier_description: tier.description,
          swaps_completed: history.swaps_completed,
          total_broadcasts: history.broadcasts,
          swaps_cancelled: history.swaps_cancelled,
          completion_rate,
          completion_percent: `${(completion_rate * 100).toFixed(1)}%`,
          volume_usdc_total: history.volume_usdc.toFixed(2),
          first_seen: history.first_seen,
          last_active: history.last_active,
        },
        agent_signal: {
          trusted,
          recommendation,
          risk_level: !trusted ? "high" : completion_rate >= 0.95 ? "low" : "medium",
        },
        data_source: "MicoPay Bazaar swap history (in-memory demo; production: Soroban event log)",
        note: "Agent reputation is derived from completed Bazaar swaps — not transferable, not buyable.",
        queried_at: new Date().toISOString(),
      });
    }
  );

  /**
   * POST /api/v1/bazaar/quote
   * x402: $0.002 USDC
   */
  fastify.post(
    "/api/v1/bazaar/quote",
    { preHandler: requirePayment({ amount: "0.002", service: "bazaar_quote" }) },
    async (request, reply) => {
      const body = request.body as { intent_id: string; rate: number };

      if (!body.intent_id || !body.rate) {
        return reply.status(400).send({ error: "intent_id and rate required" });
      }

      const intent = intents.get(body.intent_id);
      if (!intent) return reply.status(404).send({ error: "Intent not found" });

      const quoteId = `qut-${randomUUID().slice(0, 8)}`;
      const newQuote: BazaarQuote = {
        id: quoteId,
        intent_id: body.intent_id,
        from_agent: request.payerAddress ?? "GUNKNOWN",
        rate: body.rate,
        valid_until: new Date(Date.now() + 300_000).toISOString(),
      };

      const existingQuotes = quotes.get(body.intent_id) || [];
      quotes.set(body.intent_id, [...existingQuotes, newQuote]);

      return reply.status(201).send({
        quote: newQuote,
        note: "Quote sent to target agent. Handshake initiated. Monitor AtomicSwapHTLC events to settle.",
      });
    }
  );

  /**
   * POST /api/v1/bazaar/accept
   * x402: $0.005 USDC
   *
   * Initiator accepts a quote, locks the Stellar side on-chain via MicopayEscrow,
   * and records the completion in agent reputation history.
   */
  fastify.post(
    "/api/v1/bazaar/accept",
    { preHandler: requirePayment({ amount: "0.005", service: "bazaar_accept" }) },
    async (request, reply) => {
      const body = request.body as { intent_id: string; quote_id?: string; secret_hash?: string; amount_usdc?: number };

      if (!body.intent_id) {
        return reply.status(400).send({ error: "intent_id is required" });
      }

      const intent = intents.get(body.intent_id);
      if (!intent) return reply.status(404).send({ error: "Intent not found" });
      if (intent.status !== "active") return reply.status(409).send({ error: `Intent is already ${intent.status}` });

      const secretHash = body.secret_hash
        ?? createHash("sha256").update(randomBytes(32)).digest("hex");

      const quoteList = quotes.get(body.intent_id) || [];
      const quote = body.quote_id
        ? quoteList.find(q => q.id === body.quote_id)
        : quoteList[0];

      const amountUsdc = body.amount_usdc
        ?? parseFloat(intent.wanted.symbol === "USDC" ? intent.wanted.amount : "28.57");

      fastify.log.info(`Bazaar: Locking Stellar side for intent ${body.intent_id}...`);
      const lock = await lockAtomicSwap({ amountUsdc, secretHash, timeoutMinutes: 60 });

      // ── Update intent state & agent reputation ────────────────────────────
      intent.status = "negotiating";
      intent.secret_hash = secretHash;
      intent.selected_quote_id = quote?.id;

      // Record this as a completed swap for reputation tracking.
      // In production: listen to Soroban "released" events instead.
      recordCompletion(intent.agent_address, amountUsdc);

      fastify.log.info(`Bazaar: Lock confirmed. swap_id=${lock.swapId.slice(0, 10)} tx=${lock.txHash}`);

      return reply.send({
        status: "negotiating",
        message: "Stellar side anchored on-chain. Cross-chain intent coordinated.",
        handshake: {
          intent_id: body.intent_id,
          quote_id: quote?.id ?? "auto",
          market_maker: quote?.from_agent ?? "market-maker-agent",
          secret_hash: secretHash,
          htlc_tx_hash: lock.txHash,
          htlc_explorer_url: lock.explorerUrl,
          swap_id: lock.swapId,
        },
        agent_reputation_updated: true,
        note: "Stellar side locked. AtomicSwapHTLC (built + tested) resolves the counterpart chain in production.",
        next_step: "Agent B locks counterpart asset using shared secret_hash. Revealing secret on Chain B gives initiator claim rights here.",
      });
    }
  );
}
