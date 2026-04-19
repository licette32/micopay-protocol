# Micopay Protocol — Plan de Commits y Git Workflow

---

## Convenciones

**Commits:** conventional commits con scope
```
feat(contracts): add HashedTimeLock trait
fix(api): handle x402 payment timeout edge case
refactor(agent): extract tool definitions to separate module
docs: write ARCHITECTURE.md
test(sdk): add integration tests for AtomicSwapClient
chore: configure turborepo build pipeline
```

**Branches:**
- `main` — siempre deployable, merges al terminar cada feature
- `feat/htlc-contracts` — Día 1-2
- `feat/x402-api` — Día 3
- `feat/agent-core` — Día 4-7
- `feat/openclaw-skill` — Día 8
- `feat/fund-micopay` — Día 8-9
- `feat/demo-dashboard` — Día 9-10

**Regla:** cada commit compila. Nunca commitear código roto.

---

## Día 1 — Monorepo + Contratos

```bash
# Branch: feat/htlc-contracts

# Morning
git commit -m "chore: initialize monorepo with turborepo and npm workspaces"
git commit -m "chore: add rust toolchain config for soroban contracts"
git commit -m "feat(contracts): add htlc-core crate with HashedTimeLock trait and shared types"

# Afternoon
git commit -m "feat(contracts): implement AtomicSwapHTLC with lock, release, refund"
git commit -m "feat(contracts): add timeout asymmetry validation (initiator > counterparty)"
git commit -m "test(contracts): add unit tests for atomic-swap lock and release flow"
git commit -m "test(contracts): add timeout validation and refund tests"
```

**Entregable del día:** dos crates compilando, tests pasando, trait definido.

---

## Día 2 — SDK + Refactor Escrow

```bash
# Branch: feat/htlc-contracts (continua)

# Morning
git commit -m "refactor(contracts): extract micopay-escrow to implement HashedTimeLock trait"
git commit -m "test(contracts): verify micopay-escrow backward compatibility after refactor"

# Afternoon — switch to packages
git commit -m "feat(types): define SwapPlan, SwapStatus, CounterpartyInfo, AgentIntent"
git commit -m "feat(types): add x402 payment types (PaymentChallenge, PaymentReceipt)"
git commit -m "feat(sdk): add stellar helpers (buildSorobanTx, submitTx, waitForConfirmation)"
git commit -m "feat(sdk): add AtomicSwapClient wrapping contract interactions"
git commit -m "test(sdk): add integration test — lock and release on stellar testnet"

# Merge
git checkout main && git merge feat/htlc-contracts
```

**Entregable del día:** SDK funcional que puede hacer lock/release contra testnet.

---

## Día 3 — API + x402

```bash
# Branch: feat/x402-api

# Morning
git commit -m "feat(api): initialize fastify server with cors, logging, and health endpoint"
git commit -m "feat(api): add database schema with drizzle (swaps, reputation, funding tables)"
git commit -m "feat(api): integrate stellar-mpp-sdk as x402 payment middleware"

# Afternoon
git commit -m "feat(api): add GET /swaps/search endpoint with x402 gate ($0.001)"
git commit -m "feat(api): add GET /reputation/:address endpoint with x402 gate ($0.0005)"
git commit -m "feat(api): add POST /fund endpoint with x402 gate (min $0.10)"
git commit -m "feat(api): add GET /health with system status and contract connectivity"
git commit -m "test(api): verify x402 flow — request without payment returns 402"

# Merge
git checkout main && git merge feat/x402-api
```

**Entregable del día:** API en pie, x402 funcionando, Fund Micopay endpoint activo.

---

## Día 4 — Intent Parser (Claude)

```bash
# Branch: feat/agent-core

# Morning
git commit -m "feat(agent): add system prompt for swap planning agent"
git commit -m "feat(agent): define tool schemas (search_swaps, get_reputation, calculate_timeouts)"
git commit -m "feat(agent): implement intent parser with claude API and function calling"

# Afternoon
git commit -m "feat(agent): add tool handlers connecting to live API endpoints"
git commit -m "test(agent): test intent parsing with 'quiero cambiar USDC por ETH'"
git commit -m "test(agent): test intent parsing with 'tengo 2000 pesos quiero ETH'"
git commit -m "feat(agent): add error handling for claude API failures and malformed responses"
```

**Entregable del día:** intent parser que toma lenguaje natural y produce SwapPlan.

---

## Día 5 — Strategy Engine

```bash
# Branch: feat/agent-core (continua)

# Morning
git commit -m "feat(agent): add counterparty selector (score + rate + completion_rate)"
git commit -m "feat(agent): add timeout calculator based on network congestion"
git commit -m "feat(agent): add risk assessor for swap evaluation"

# Afternoon
git commit -m "feat(agent): integrate strategy engine with intent parser pipeline"
git commit -m "test(agent): test strategy selection with multiple counterparties"
git commit -m "feat(agent): add fallback heuristics when claude API is slow"
```

**Entregable del día:** pipeline completo intent → strategy → plan.

---

## Día 6 — Swap Executor

```bash
# Branch: feat/agent-core (continua)

# Morning
git commit -m "feat(agent): implement StellarAdapter for chain A interactions"
git commit -m "feat(agent): implement MockChainBAdapter (second HTLC on testnet)"
git commit -m "feat(agent): implement secret management (generate, sha256, encrypt AES-256-GCM)"

# Afternoon
git commit -m "feat(agent): implement SwapExecutor core loop (lock → monitor → release)"
git commit -m "feat(agent): add chain B monitoring with polling (detect secret revelation)"
git commit -m "feat(agent): add refund handler for timeout scenarios"
git commit -m "test(agent): test executor with simulated counterparty on testnet"
```

**Entregable del día:** executor que coordina un swap entre dos contratos HTLC.

---

## Día 7 — Integración

```bash
# Branch: feat/agent-core (continua)

# Morning
git commit -m "feat(api): add POST /swaps/plan endpoint calling intent parser"
git commit -m "feat(api): add POST /swaps/execute endpoint triggering executor"
git commit -m "feat(api): add GET /swaps/:id/status endpoint with swap state polling"

# Afternoon
git commit -m "feat(api): wire x402 to plan ($0.01) and execute ($0.05) endpoints"
git commit -m "test: end-to-end test — search → plan → execute → complete on testnet"
git commit -m "fix: various integration fixes from e2e testing"

# Merge
git checkout main && git merge feat/agent-core
```

**Entregable del día:** flujo completo funcionando end-to-end con x402.

---

## Día 8 — OpenClaw Skill + Fund Polish

```bash
# Branch: feat/openclaw-skill

# Morning
git commit -m "feat(skill): add SKILL.md with full endpoint documentation"
git commit -m "feat(api): serve SKILL.md at GET /skill.md for agent discovery"
git commit -m "feat(api): add GET /services endpoint for programmatic discovery"

# Afternoon (branch: feat/fund-micopay)
git commit -m "feat(api): add funding_contributions table and queries"
git commit -m "feat(api): add fund endpoint response with supporter_id and totals"
git commit -m "feat(api): add optional message field to fund endpoint"
git commit -m "test: verify fund endpoint with real x402 payment on testnet"

# Merge both
git checkout main && git merge feat/openclaw-skill
git checkout main && git merge feat/fund-micopay
```

**Entregable del día:** SKILL.md publicado, Fund Micopay completo.

---

## Día 9 — Dashboard

```bash
# Branch: feat/demo-dashboard

# Morning
git commit -m "feat(web): initialize react app with vite and tailwind"
git commit -m "feat(web): add fund counter widget (total USDC, supporter count)"
git commit -m "feat(web): add live transaction feed with stellar expert links"

# Afternoon
git commit -m "feat(web): add swap status panel showing active swap lifecycle"
git commit -m "feat(web): add polling for real-time updates"
git commit -m "feat(web): add service catalog view from /services endpoint"

# Merge
git checkout main && git merge feat/demo-dashboard
```

**Entregable del día:** dashboard visual para el demo.

---

## Día 10 — Demo Flow + Deploy

```bash
# Morning
git commit -m "feat(scripts): add deploy-contracts.sh for testnet deployment"
git commit -m "feat(scripts): add fund-testnet.sh to seed wallets"
git commit -m "feat(scripts): add demo.sh running full swap lifecycle"

# Afternoon
git commit -m "fix: integration fixes from full demo rehearsal"
git commit -m "chore: configure render/railway deployment for api and web"
git commit -m "test: verify deployed endpoints respond correctly with x402"
```

**Entregable del día:** demo funciona end-to-end en entorno deployado.

---

## Día 11 — Documentación

```bash
git commit -m "docs: write comprehensive README with quick start and API catalog"
git commit -m "docs: write ARCHITECTURE.md with system diagrams"
git commit -m "docs: write AGENT_DESIGN.md explaining LLM vs deterministic split"
git commit -m "docs: write ATOMIC_SWAPS.md with cross-chain flow explanation"
git commit -m "docs: add X402_ENDPOINTS.md with pricing table"
git commit -m "chore: clean up code, add inline comments to complex sections"
```

**Entregable del día:** repo documentado y limpio.

---

## Día 12 — Video + Submission

```bash
git commit -m "docs: add demo video link to README"
git commit -m "chore: final pre-submission cleanup"
git commit -m "chore: verify all tests pass and endpoints respond"
```

**Demo video (max 5 min):**
1. (0:00-0:30) Intro — qué es Micopay Protocol, qué problema resuelve
2. (0:30-1:30) Mostrar SKILL.md y service discovery
3. (1:30-3:00) Swap demo — agente planifica con Claude, executor ejecuta en testnet
4. (3:00-4:00) Fund Micopay en vivo — agente paga, dashboard actualiza, verificar en Stellar Expert
5. (4:00-5:00) Arquitectura — explicar separación LLM/executor, contratos, x402

**Submission en DoraHacks:**
- [ ] GitHub link
- [ ] Demo video link
- [ ] Description alineada con "Paid agent services" y "Agent wallets, coordination"

---

## Total: ~65 commits en 12 días

Distribuidos de forma creíble: más commits en días de desarrollo (6-8 por día), menos en días de docs/video (3-4 por día).
