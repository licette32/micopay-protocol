# Micopay Protocol — Visión y Posicionamiento

---

## De dónde venimos

Micopay nació como un protocolo P2P de intercambio crypto-a-efectivo en México. La idea era simple: conectar a personas que tienen stablecoins con personas que tienen efectivo, usando HTLCs en Soroban como escrow trustless. Un "LocalBitcoins" descentralizado para mercados emergentes.

Construimos:
- Un contrato HTLC en Soroban con escrow, disputas, y emergency refunds
- Un sistema de reputación de 4 niveles (Espora → Micelio → Hongo → Maestro) con NFTs soulbound
- Integración con anchors mexicanos (Etherfuse para CETES, AlfredPay para USDC)
- Path payments vía Stellar DEX
- Settlement SPEI
- Un backend spec de 98KB con 20 secciones técnicas

Todo esto sigue siendo válido. Pero para el hackathon "Stellar Hacks: Agents", necesitamos un cambio de narrativa.

---

## A dónde vamos

Micopay ya no se presenta como una "app de intercambio P2P." Se presenta como **infraestructura de servicios pagados para agentes de IA en Stellar.**

El P2P cash es un caso de uso — uno de varios que corren sobre nuestra infraestructura. El producto real es:

### Una red de microservicios x402

Cada capacidad de Micopay se expone como un endpoint HTTP que un agente puede descubrir, pagar por request (en USDC sobre Stellar), y componer con otros servicios. Sin API keys. Sin suscripciones. Sin onboarding.

Servicios:
- **Matching Engine** — buscar contrapartes para swaps
- **Swap Coordinator** — atomic swaps cross-chain con agente autónomo
- **Reputation Service** — scores on-chain enriquecidos
- **Price Oracle** — cotizaciones y exchange rates
- **Fund Micopay** — el proyecto se financia con su propia tech

### Atomic swaps coordinados por IA

El HTLC que construimos para P2P cash es el mismo primitivo que permite atomic swaps cross-chain. Lo generalizamos en un trait compartido (`HashedTimeLock`) con dos implementaciones:
- `MicopayEscrow` para el caso P2P (con disputas, fees, reputación)
- `AtomicSwapHTLC` para swaps cross-chain (limpio, sin lógica de negocio)

Un agente de IA coordina los swaps: Claude entiende la intención y planifica, un executor determinístico monitorea cadenas y ejecuta transacciones. El LLM nunca toca fondos.

### Un proyecto que se financia a sí mismo

El endpoint Fund Micopay permite que cualquier agente done USDC al proyecto usando la misma infraestructura x402 que demuestra. Es meta-demo: prueba que la tecnología funciona en 10 segundos.

---

## Por qué esto importa

### Para el hackathon

Los tracks que el hackathon pide explícitamente y que cubrimos:

| Track del hackathon | Qué tenemos |
|----|----|
| "Paid agent services / APIs" | Todos nuestros endpoints son pay-per-request vía x402 |
| "Agent-to-agent payments" | El swap coordinator es un agente que paga a otros servicios |
| "Rating, reputation, and trust" | ReputationRegistry on-chain con 4 niveles |
| "Agent marketplaces / discovery" | OpenClaw SKILL.md + endpoint /services |
| "DeFi integrations" | Atomic swaps cross-chain via HTLCs |
| "Bazaar-style discoverability" | Service discovery endpoint + SKILL.md |

### Para el mercado real

La visión de largo plazo no cambia — queremos conectar la economía informal de mercados emergentes con la economía digital global. Lo que cambia es la arquitectura: en vez de construir una app monolítica, construimos primitivos que cualquiera puede componer.

Un agente de OpenClaw puede usar nuestro matching engine para encontrar contrapartes. Un agente de un wallet como Lobstr puede usar nuestro swap coordinator para ofrecer cross-chain a sus usuarios. Un protocolo DeFi puede usar nuestra reputación como input para su scoring crediticio.

Cada uso genera revenue vía x402. No necesitamos que los usuarios usen "la app de Micopay" — necesitamos que los agentes usen nuestros servicios.

---

## Principios de diseño

### 1. Payment IS authentication

No hay API keys. No hay OAuth. No hay registro. Si puedes pagar, puedes usar el servicio. x402 es el mecanismo de autenticación y autorización.

Esto es deliberado: reduce la fricción a cero para agentes autónomos, elimina la necesidad de gestionar cuentas de usuarios-agentes, y genera revenue desde el primer request.

### 2. El LLM planifica, el código ejecuta

Claude es bueno entendiendo intenciones ambiguas y razonando sobre tradeoffs. Es malo ejecutando transacciones financieras de forma predecible. Por eso la separación es estricta:
- Intent Parser (Claude): entiende qué quiere el usuario, consulta estado real, produce un plan
- Swap Executor (código): recibe el plan y lo sigue exactamente, sin ambigüedad, sin hallucination

Los fondos del usuario dependen del executor. No hay LLM en ese path.

### 3. Dos contratos, un primitivo

El HTLC es un primitivo criptográfico — no una aplicación. Las aplicaciones se construyen encima:
- MicopayEscrow es una aplicación P2P con protecciones humanas
- AtomicSwapHTLC es una aplicación de swaps para agentes autónomos
- Ambas comparten el trait HashedTimeLock

Nuevos casos de uso (lending, options, escrow multi-party) se pueden construir implementando el mismo trait.

### 4. Cross-chain sin bridges

Los atomic swaps no requieren bridges custodiales ni comités de validadores. La atomicidad viene de la criptografía pura: el mismo secreto desbloquea fondos en dos cadenas. Si una parte revela el secreto en una cadena, la otra parte puede usarlo en la otra. No hay tercero de confianza.

### 5. El proyecto come su propia comida

Fund Micopay no es un gimmick — es la prueba de que la infraestructura funciona. Si un agente puede pagar x402 para financiar el proyecto, puede pagar x402 para cualquier servicio. La demostración más convincente de un protocolo de pagos es usarlo para pagarse a sí mismo.

---

## Lo que ya tenemos (assets del repo anterior)

Del `micopay-mvp` existente, reutilizamos directamente:

| Asset | Estado | Acción |
|-------|--------|--------|
| Contrato HTLC en Soroban (Rust) | Funcional, acoplado a P2P | Refactorear para implementar trait |
| Backend spec v1.3 (98KB) | Completo | Extraer lo relevante, descartar P2P-specific |
| Schema de DB (PostgreSQL) | Completo | Reutilizar tables de trades, reputation, wallets |
| Generación y cifrado de secretos | Completo | Reutilizar directamente |
| Sistema de reputación (4 niveles) | Completo | Reutilizar directamente |
| Path payments / DEX routing | Completo | Reutilizar para price oracle |
| Integración Etherfuse + AlfredPay | Documentado | Roadmap post-hackathon |
| Frontend "Emerald Horizon" | Funcional | Simplificar a dashboard mínimo |

Lo que NO reutilizamos:
- El flujo de QR/efectivo como feature principal (se convierte en un caso de uso)
- La carpeta `stitch_remix_of_micopay` (descartada)
- El README actual (reescrito completamente)

---

## Roadmap post-hackathon

### Corto plazo (1-3 meses)

- Adapter EVM real (Base/Ethereum) para atomic swaps cross-chain production
- Settlement SPEI integrado para que operadores de servicios reciban pesos
- Más servicios x402: validación de RFC, consulta CURP, tipo de cambio Banxico
- Market maker automatizado para mantener liquidez en swaps

### Mediano plazo (3-6 meses)

- Blend Capital integration (yield on escrow — v2 de la spec)
- Etherfuse CETES para savings (ya documentado en spec v1.3)
- Múltiples cadenas destino: Solana, Arbitrum, Polygon
- Agent reputation cross-chain (transferir score entre cadenas)

### Largo plazo (6-12 meses)

- Micopay como protocolo descentralizado (governance token, DAO)
- Red de agentes P2P de efectivo coordinada por agentes de IA
- API marketplace donde cualquiera publica servicios x402 sobre nuestra infra
- Interoperability con otros protocolos x402/MPP (Stripe, Coinbase)

---

## Mensaje final

Micopay empezó con un HTLC para que alguien pudiera intercambiar pesos por crypto sin necesitar un banco. Descubrimos que ese primitivo es la base de algo más grande: una red de servicios pagados para agentes de IA, donde la coordinación cross-chain, la reputación, y el settlement real se manejan como microservicios que cualquier agente puede componer.

El hackathon es el punto de inflexión donde dejamos de ser una app y empezamos a ser un protocolo.
