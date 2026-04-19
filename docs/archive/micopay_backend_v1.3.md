# 🍄 Micopay — Backend Spec v1.4

**Spec técnica del servidor, contratos Soroban, payment rails y arquitectura de datos**
Abril 2026

---

> **Audiencia de este documento**
> Desarrollador(es) backend. Asume conocimiento de Node.js/TypeScript, PostgreSQL, y conceptos básicos de blockchain. No asume conocimiento de Stellar — todos los conceptos de Soroban están explicados.

---

> **Changelog v1.3 → v1.4**
> - **CORRECCIÓN ARQUITECTURA:** Blend Capital **no** hace yield automático sobre fondos bloqueados en escrow. La integración correcta es DeFi voluntario: el usuario elige desde la pantalla Explorar si quiere depositar activos idle en Blend (yield) o pedir un préstamo colateralizado. Sin composabilidad forzada con HTLC.
> - **CORRECCIÓN FLUJO CETES:** El flujo primario para comprar CETES es un **swap directo en el DEX de Stellar** (XLM/USDC/MXNe → CETES token) — sin KYC, sin SPEI, sin intermediario. El flujo SPEI se mantiene como opción secundaria para usuarios que vienen desde fiat y no tienen cripto (sección 10.3 / Card "Conecta tu Banco").
> - Secciones 18 y 19 reescritas completamente para reflejar la visión correcta del producto: DeFi accesible desde la pantalla Explorar, sin acoplamiento al escrow.

> **Changelog v1.2 → v1.3**
> - **CRITICAL:** Etherfuse es anchor nativo en Stellar (no requiere bridge Solana). Sección 19 reescrita completamente — CETES se emiten directamente en Stellar vía SPEI. Movido de v3 a v2.
> - Agregado AlfredPay como anchor USDC vía SPEI (SEP-compliant)
> - Referenciado el Regional Starter Pack de SDF como librería de integración con anchors
> - Actualizada tabla de servicios externos con anchors concretos (Etherfuse, AlfredPay)
> - Actualizada sección Payment Rails con anchors específicos para México

> **Changelog v1.1 → v1.2**
> - Agregada sección de Payment Rails (SEP-24 SPEI anchor, path payments, Stellar DEX routing, cross-border)
> - Agregados endpoints de wallet payments (`/payments/*`) y savings (`/savings/*`)
> - Expandida sección de Blend Capital con flujo técnico concreto, DB schema y endpoints (v2)
> - Expandida sección de Etherfuse con flujo de integración vía API, tabla `savings_positions` y endpoints (v3)
> - Actualizado diagrama de arquitectura para reflejar payment rails + DeFi layer
> - Agregadas tablas `payment_transactions` y `savings_positions` al esquema
> - Agregadas variables de entorno para SPEI anchor, Blend y Etherfuse
> - Expandido glosario con SEP-24, path payment, stablebond, SAC, anchor

> **Changelog v1.0 → v1.1**
> - Corregido el orden de generación del secreto HTLC (el hash se genera *antes* del lock, el secreto cifrado se almacena *después* de confirmar on-chain)
> - Corregida la serialización de Stellar Addresses (StrKey, no base64)
> - Agregada sección de Onboarding de Cuentas Stellar (funding, trustlines, anti-Sybil)
> - Agregada sección de TTL Management para datos en Soroban
> - Agregada tabla `user_devices` para tokens FCM
> - Agregada tabla `secret_access_log` al esquema
> - Hardened WebSocket chat (validación, rate limit, try/catch)
> - Fee dinámico en transacciones Soroban (reemplaza fee fijo)
> - Rate limiting en `/stellar/submit` y WebSocket
> - Agregado mecanismo de Emergency Refund con timelock absoluto
> - Clarificada terminología: "Self-Custodial Wallets" (no "Custodiales")
> - Clarificado status de Blend y Etherfuse (roadmap futuro, no v1)
> - Abstracción de capa geoespacial para futura migración a PostGIS

---

## Tabla de contenido

1. [Stack y Dependencias](#1-stack-y-dependencias)
2. [Arquitectura General](#2-arquitectura-general)
3. [Base de Datos — Esquema Completo](#3-base-de-datos--esquema-completo)
4. [API REST — Endpoints](#4-api-rest--endpoints)
5. [El Secreto y el Mecanismo QR](#5-el-secreto-y-el-mecanismo-qr)
6. [Integración con Stellar / Soroban](#6-integración-con-stellar--soroban)
7. [Contratos Soroban](#7-contratos-soroban)
8. [Onboarding de Cuentas Stellar](#8-onboarding-de-cuentas-stellar)
9. [Gestión de Wallets Self-Custodial](#9-gestión-de-wallets-self-custodial)
10. [Payment Rails — Stellar Native](#10-payment-rails--stellar-native)
11. [TTL Management en Soroban](#11-ttl-management-en-soroban)
12. [Sistema de Ubicación y Privacidad](#12-sistema-de-ubicación-y-privacidad)
13. [Notificaciones Push](#13-notificaciones-push)
14. [Chat Cifrado Efímero](#14-chat-cifrado-efímero)
15. [Jobs y Workers](#15-jobs-y-workers)
16. [Seguridad](#16-seguridad)
17. [Variables de Entorno](#17-variables-de-entorno)
18. [Blend Capital — Yield on Escrow (v2)](#18-blend-capital--yield-on-escrow-v2)
19. [Etherfuse — CETES Stablebonds (v2)](#19-etherfuse--cetes-stablebonds-v2)
20. [Glosario Técnico](#20-glosario-técnico)

---

## 1. Stack y Dependencias

### 1.1 Runtime y framework

```
Node.js 20+ (LTS)
TypeScript 5+
Fastify 4+ (más rápido que Express, mejor tipado)
```

> Por qué Fastify sobre Express: mejor performance en endpoints de alta frecuencia (consultas de mapa), soporte nativo de TypeScript, validación de schemas integrada con JSON Schema.

### 1.2 Dependencias principales

```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "^12.x",
    "fastify": "^4.x",
    "@fastify/jwt": "^8.x",
    "@fastify/rate-limit": "^9.x",
    "@fastify/websocket": "^10.x",
    "pg": "^8.x",
    "drizzle-orm": "^0.30.x",
    "bullmq": "^5.x",
    "ioredis": "^5.x",
    "tweetnacl": "^1.x",
    "libsodium-wrappers": "^0.7.x"
  },
  "dependenciesV2": {
    "@blend-capital/blend-sdk": "^1.x"
  }
}
```

> **Dependencias por fase:**
> - **v1 (actual):** todo lo listado en `dependencies`. Cubre P2P escrow, payment rails (SPEI vía AlfredPay/Etherfuse), wallet, reputación.
> - **v2:** se agrega `@blend-capital/blend-sdk` para yield-on-escrow + Etherfuse CETES savings. Ver secciones 18 y 19.
>
> **Nota:** la integración con anchors (Etherfuse, AlfredPay) se hace vía REST API y la librería portable del [Regional Starter Pack](https://github.com/ElliotFriend/regional-starter-pack) — copiar `src/lib/anchors/` al proyecto. No requiere SDK adicional.

### 1.3 Servicios externos

| Servicio | Uso | Plan inicial |
|---|---|---|
| PostgreSQL 15+ (con PostGIS extension) | Base de datos principal + queries geoespaciales | Railway / Supabase free tier |
| Redis | Queue de jobs + cache de ubicaciones | Redis Cloud 30MB free |
| Stellar RPC | Consultas y submit de transacciones Soroban | SDF public RPC (gratuito) |
| Stellar Horizon | Consultas de account, balances, historial de pagos | SDF public Horizon |
| Etherfuse (anchor) | On/off ramp MXN↔CETES vía SPEI. CETES emitidos nativamente en Stellar. | Sandbox gratis, mainnet requiere KYB |
| AlfredPay (anchor) | On/off ramp MXN↔USDC vía SPEI. USDC nativo en Stellar. | Sandbox gratis, prod requiere onboarding |
| Mapbox | Tiles del mapa (frontend consume directo) | Free tier 25k MAU |
| Firebase FCM | Notificaciones push | Gratis |
| Resend / SendGrid | Emails transaccionales | Gratis hasta 100/día |

> **Regional Starter Pack:** la integración con anchors (Etherfuse, AlfredPay) se basa en la librería portable del [Stellar Regional Starter Pack](https://regional-starter-pack.vercel.app/) de SDF. El código en `src/lib/anchors/` implementa una interfaz `Anchor` compartida con clientes TypeScript para cada proveedor, incluyendo implementaciones de SEP-1, 6, 10, 12, 24, 31 y 38. Copiar directamente al proyecto.

> **PostGIS:** aunque para el MVP usamos Haversine puro, la extensión PostGIS está habilitada desde el inicio para facilitar la migración futura. Ver sección 12.6 para el plan de migración.

---

## 2. Arquitectura General

```
App móvil (React Native)
    │
    ├── REST API (Fastify)          ← este servidor
    │       │
    │       ├── PostgreSQL          ← datos de negocio
    │       ├── Redis               ← jobs + ubicaciones en caché
    │       └── Stellar RPC         ← blockchain
    │
    ├── WebSocket (para chat y notificaciones de trade)
    │
    └── Stellar Network (directo desde el cliente para tx firmadas)
         │
         ├── Payment Rails (v1)
         │     ├── MXNe / USDC (SAC tokens)
         │     ├── SPEI Anchor (SEP-24 on/off ramp)
         │     ├── Path Payments (Stellar DEX routing)
         │     └── Cross-border (vía anchors globales)
         │
         ├── Soroban Contracts (v1)
         │     ├── EscrowFactory
         │     ├── ReputationRegistry
         │     └── MicopayNFT
         │
         └── DeFi Layer — Explorar (roadmap v2)
               ├── Blend Capital (préstamos colateralizados + yield voluntario)
               └── Etherfuse (CETES — swap DEX directo + on-ramp SPEI opcional)
```

### 2.1 Principio de diseño: el servidor nunca firma

El servidor **nunca firma transacciones de usuarios**. Solo:
- Construye la transacción (el XDR sin firmar)
- Se la devuelve al cliente para que la firme con su keypair
- Recibe el XDR firmado y hace submit a Stellar

La excepción son las operaciones administrativas (resolver disputas, suspender usuarios, emergency refunds) que usan el keypair del admin, almacenado en variables de entorno cifradas.

### 2.2 El secreto del HTLC: el servidor SÍ lo conoce

El servidor genera el secreto HTLC y lo custodia cifrado en la DB. Esto es necesario porque:
1. Si el vendedor pierde el teléfono durante un trade activo, el soporte puede ayudar
2. Si hay una disputa, los admins pueden verificar si el secreto fue revelado
3. Permite regenerar el QR si expiró la sesión del vendedor

Ver sección 5 para el manejo completo del secreto.

> **⚠️ Orden crítico:** el `secret_hash` se genera **ANTES** de construir la tx de lock (porque el contrato lo necesita como parámetro). El `secret` cifrado se almacena en la DB **DESPUÉS** de confirmar que el lock ocurrió on-chain. Ver sección 5.3 para el flujo completo.

---

## 3. Base de Datos — Esquema Completo

### 3.1 Tabla `users`

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stellar_address VARCHAR(56) UNIQUE NOT NULL,   -- G... address
  username        VARCHAR(30) UNIQUE NOT NULL,
  phone_hash      VARCHAR(64) UNIQUE,             -- hash del teléfono, no el teléfono
  kyc_level       SMALLINT DEFAULT 0,             -- 0=ninguno, 1=telefono, 2=INE, 3=CURP
  reputation_score INTEGER DEFAULT 0,
  reputation_level VARCHAR(10) DEFAULT 'espora',  -- espora|micelio|hongo|maestro
  trade_count     INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  is_suspended    BOOLEAN DEFAULT false,
  suspended_until TIMESTAMPTZ,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Onboarding Stellar
  account_funded  BOOLEAN DEFAULT false,           -- ¿cuenta ya fondeada con XLM?
  has_mxne_trustline BOOLEAN DEFAULT false,        -- ¿trustline a MXNe activa?
  has_usdc_trustline BOOLEAN DEFAULT false,        -- ¿trustline a USDC activa?
  
  -- Ubicación borrosa (nunca exacta)
  fuzzy_lat       NUMERIC(6,3),   -- 3 decimales = ~111m precisión
  fuzzy_lng       NUMERIC(6,3),
  location_updated_at TIMESTAMPTZ
);

CREATE INDEX idx_users_location ON users (fuzzy_lat, fuzzy_lng)
  WHERE is_active = true AND is_suspended = false;
CREATE INDEX idx_users_stellar ON users (stellar_address);
```

### 3.2 Tabla `offers`

Una oferta es lo que aparece en el mapa. Un usuario puede tener máximo 1 oferta activa a la vez.

```sql
CREATE TABLE offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(4) NOT NULL CHECK (type IN ('sell', 'buy')),
  -- sell = tiene cripto, quiere efectivo
  -- buy  = tiene efectivo, quiere cripto
  
  asset           VARCHAR(10) DEFAULT 'MXNe',     -- MXNe | USDC
  min_amount      INTEGER NOT NULL,               -- en pesos MXN
  max_amount      INTEGER NOT NULL,
  fee_percent     NUMERIC(4,2) NOT NULL,          -- 0.00 a 5.00
  
  status          VARCHAR(10) DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'expired', 'cancelled')),
  
  -- La oferta expira automáticamente
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Snapshot de ubicación al momento de publicar
  fuzzy_lat       NUMERIC(6,3) NOT NULL,
  fuzzy_lng       NUMERIC(6,3) NOT NULL
);

CREATE INDEX idx_offers_active ON offers (fuzzy_lat, fuzzy_lng)
  WHERE status = 'active';
CREATE INDEX idx_offers_user ON offers (user_id, status);
```

### 3.3 Tabla `trades`

```sql
CREATE TABLE trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partes
  seller_id       UUID NOT NULL REFERENCES users(id),
  buyer_id        UUID NOT NULL REFERENCES users(id),
  offer_id        UUID REFERENCES offers(id),
  
  -- Montos
  amount_mxn      INTEGER NOT NULL,               -- monto en pesos acordado
  amount_stroops  BIGINT NOT NULL,                -- equivalente en MXNe (stroops)
  seller_fee_mxn  INTEGER NOT NULL,               -- fee del proveedor
  platform_fee_mxn INTEGER NOT NULL,              -- comisión Micopay
  
  -- HTLC
  secret_hash     VARCHAR(64) NOT NULL,           -- sha256 en hex, lo conoce el contrato
  secret_enc      BYTEA,                          -- secreto cifrado con AES-256-GCM
  secret_nonce    BYTEA,                          -- nonce del cifrado
  -- El secreto plaintext NUNCA se almacena. Solo la versión cifrada.
  
  -- Estado
  status          VARCHAR(12) DEFAULT 'pending'
                  CHECK (status IN (
                    'pending',    -- match hecho, esperando que vendedor bloquee
                    'locked',     -- fondos en escrow on-chain
                    'revealing',  -- vendedor confirmó recibir efectivo, QR visible
                    'completed',  -- secreto revelado, fondos liberados
                    'cancelled',  -- timeout o cancelación
                    'disputed',   -- en disputa
                    'refunded'    -- fondos devueltos
                  )),
  
  -- Stellar
  stellar_trade_id VARCHAR(64),                   -- ID del trade en el contrato Soroban
  lock_tx_hash    VARCHAR(64),                    -- hash de la tx de bloqueo
  release_tx_hash VARCHAR(64),                    -- hash de la tx de liberación
  
  -- Timeouts
  locked_at       TIMESTAMPTZ,
  reveal_requested_at TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,                    -- cuando se auto-cancela
  -- Emergency refund: timeout absoluto de 72h desde locked_at
  -- Si el trade lleva >72h en cualquier estado activo, se fuerza refund.
  absolute_timeout_at TIMESTAMPTZ,                -- locked_at + 72 hours
  
  -- Soroban TTL tracking
  soroban_ttl_last_bumped TIMESTAMPTZ,            -- última vez que se extendió el TTL
  soroban_ttl_expires_at  TIMESTAMPTZ,            -- estimación de cuándo expira el TTL
  
  -- Ratings post-trade
  seller_rating   SMALLINT CHECK (seller_rating BETWEEN 1 AND 5),
  buyer_rating    SMALLINT CHECK (buyer_rating BETWEEN 1 AND 5),
  seller_rated_at TIMESTAMPTZ,
  buyer_rated_at  TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_seller ON trades (seller_id, status);
CREATE INDEX idx_trades_buyer ON trades (buyer_id, status);
CREATE INDEX idx_trades_status ON trades (status, expires_at)
  WHERE status IN ('locked', 'revealing', 'disputed');
CREATE INDEX idx_trades_ttl ON trades (soroban_ttl_expires_at)
  WHERE status IN ('locked', 'revealing', 'disputed');
CREATE INDEX idx_trades_absolute_timeout ON trades (absolute_timeout_at)
  WHERE status IN ('locked', 'revealing', 'disputed');
```

### 3.4 Tabla `dispute_events`

```sql
CREATE TABLE dispute_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id        UUID NOT NULL REFERENCES trades(id),
  reported_by     UUID NOT NULL REFERENCES users(id),
  reason          TEXT,
  evidence_urls   TEXT[],                         -- fotos subidas como evidencia
  resolved_by     UUID REFERENCES users(id),      -- admin que resolvió
  resolution      VARCHAR(10),                    -- 'seller_wins' | 'buyer_wins'
  resolution_note TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
```

### 3.5 Tabla `reputation_events`

```sql
CREATE TABLE reputation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  trade_id        UUID REFERENCES trades(id),
  event_type      VARCHAR(30) NOT NULL,
  -- 'trade_completed' | 'rating_received' | 'no_show' |
  -- 'dispute_lost' | 'dispute_won' | 'weekly_active'
  delta           INTEGER NOT NULL,               -- positivo o negativo
  score_after     INTEGER NOT NULL,
  level_before    VARCHAR(10),
  level_after     VARCHAR(10),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rep_events_user ON reputation_events (user_id, created_at DESC);
```

### 3.6 Tabla `wallets`

```sql
CREATE TABLE wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id),
  stellar_address VARCHAR(56) NOT NULL,
  
  -- La clave privada NUNCA se almacena en el servidor.
  -- Se almacena solo en el dispositivo del usuario, cifrada con biometrics.
  wallet_type     VARCHAR(15) DEFAULT 'self_custodial'
                  CHECK (wallet_type IN ('self_custodial', 'external')),
  external_wallet VARCHAR(20),                    -- 'freighter'|'lobstr'|'xbull' si es external
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

> **Terminología:** las wallets donde la clave privada vive en el dispositivo del usuario son **self-custodial** (el usuario se custodia a sí mismo). "Custodial" implica que un tercero (el servidor) tiene la clave — que NO es nuestro caso. Esta distinción es importante legal y técnicamente.

### 3.7 Tabla `user_devices` (tokens FCM para push notifications)

```sql
CREATE TABLE user_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  fcm_token       TEXT NOT NULL,
  device_platform VARCHAR(10) CHECK (device_platform IN ('ios', 'android')),
  device_name     VARCHAR(50),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_devices_user ON user_devices (user_id, is_active)
  WHERE is_active = true;
CREATE UNIQUE INDEX idx_user_devices_token ON user_devices (fcm_token);
```

### 3.8 Tabla `secret_access_log` (auditoría de accesos al secreto HTLC)

```sql
CREATE TABLE secret_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id        UUID NOT NULL REFERENCES trades(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  ip_address      INET NOT NULL,
  user_agent      TEXT,
  accessed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_secret_access_trade ON secret_access_log (trade_id);
```

### 3.9 Tabla `chat_messages` (efímera — se borra al terminar el trade)

```sql
CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id        UUID NOT NULL REFERENCES trades(id),
  sender_id       UUID NOT NULL REFERENCES users(id),
  text            VARCHAR(500) NOT NULL,          -- máximo 500 chars por mensaje
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_trade ON chat_messages (trade_id, created_at);
```

### 3.10 Tabla `account_funding_log` (anti-Sybil tracking)

```sql
CREATE TABLE account_funding_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  stellar_address VARCHAR(56) NOT NULL,
  xlm_amount      NUMERIC(10,7) NOT NULL,         -- XLM enviado
  tx_hash         VARCHAR(64) NOT NULL,
  phone_hash      VARCHAR(64),                     -- hash del teléfono al momento del funding
  ip_address      INET,
  funded_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Para detectar funding masivo desde la misma IP
CREATE INDEX idx_funding_ip ON account_funding_log (ip_address, funded_at);
```

### 3.11 Tabla `payment_transactions` (historial de pagos del wallet)

```sql
CREATE TABLE payment_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(15) NOT NULL
                  CHECK (type IN ('send', 'receive', 'path_send', 'path_receive',
                                   'deposit', 'withdraw')),
  -- send/receive = pago directo MXNe o USDC
  -- path_send/path_receive = path payment vía DEX
  -- deposit/withdraw = on/off ramp SPEI (SEP-24)
  
  send_asset      VARCHAR(10),                    -- asset enviado (MXNe, USDC, XLM)
  send_amount     NUMERIC(20,7),                  -- monto enviado
  dest_asset      VARCHAR(10),                    -- asset recibido (puede diferir en path payments)
  dest_amount     NUMERIC(20,7),                  -- monto recibido
  
  counterparty_address VARCHAR(56),               -- dirección Stellar de la contraparte
  counterparty_user_id UUID REFERENCES users(id), -- si es usuario Micopay, referencia
  
  stellar_tx_hash VARCHAR(64),
  memo            VARCHAR(28),                    -- Stellar memo
  status          VARCHAR(12) DEFAULT 'pending'
                  CHECK (status IN ('pending', 'submitted', 'completed', 'failed')),
  
  -- Para on/off ramp (SEP-24)
  anchor_tx_id    VARCHAR(64),                    -- ID de la transacción en el anchor
  bank_clabe      VARCHAR(18),                    -- CLABE destino (solo withdrawals)
  
  fee_xlm         NUMERIC(10,7),
  exchange_rate   NUMERIC(12,6),                  -- tipo de cambio si aplica (path payments)
  path_assets     TEXT[],                         -- ruta del DEX: ['MXNe', 'XLM', 'USDC']
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_payments_user ON payment_transactions (user_id, created_at DESC);
CREATE INDEX idx_payments_status ON payment_transactions (status)
  WHERE status IN ('pending', 'submitted');
```

### 3.12 Tabla `savings_positions` (Blend / Etherfuse — v2-v3)

```sql
CREATE TABLE savings_positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  
  provider        VARCHAR(12) NOT NULL
                  CHECK (provider IN ('blend', 'etherfuse')),
  -- blend = Blend Capital lending pool (Soroban, v2)
  -- etherfuse = CETES stablebonds (Solana vía API, v3)
  
  asset_deposited VARCHAR(10) NOT NULL,           -- MXNe | USDC
  amount_deposited NUMERIC(20,7) NOT NULL,
  
  -- Para Blend
  blend_pool_id   VARCHAR(64),                    -- Soroban contract address del pool
  btoken_amount   NUMERIC(20,7),                  -- bTokens recibidos al depositar
  
  -- Para Etherfuse
  etherfuse_bond_id VARCHAR(64),                  -- ID del bono en Etherfuse
  cetes_rate       NUMERIC(6,4),                  -- tasa CETES al momento del depósito (e.g. 11.25%)
  maturity_date    DATE,                          -- fecha de vencimiento del CETE
  
  -- Estado
  status          VARCHAR(12) DEFAULT 'active'
                  CHECK (status IN ('active', 'withdrawing', 'completed', 'failed')),
  
  -- Yield tracking
  estimated_apy   NUMERIC(6,4),                   -- APY estimado al momento del depósito
  accrued_yield   NUMERIC(20,7) DEFAULT 0,        -- yield acumulado (actualizado periódicamente)
  
  deposit_tx_hash VARCHAR(64),
  withdraw_tx_hash VARCHAR(64),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  withdrawn_at    TIMESTAMPTZ
);

CREATE INDEX idx_savings_user ON savings_positions (user_id, status)
  WHERE status = 'active';
CREATE INDEX idx_savings_provider ON savings_positions (provider, status);
```

---

## 4. API REST — Endpoints

### 4.1 Autenticación

Micopay usa **SEP-10** de Stellar para autenticar wallets. Es el estándar del ecosistema — el usuario prueba que controla una dirección Stellar firmando un challenge.

```
POST   /auth/challenge          → obtener challenge para firmar
POST   /auth/token              → presentar challenge firmado, recibir JWT
POST   /auth/refresh            → renovar JWT
```

**Flujo de autenticación:**
```
1. Cliente: POST /auth/challenge { stellar_address }
2. Server: devuelve { challenge: "micopay-auth-{random}-{timestamp}" }
3. Cliente: firma el challenge con su keypair Stellar
4. Cliente: POST /auth/token { stellar_address, signature }
5. Server: verifica firma → emite JWT de 24h
6. Todos los endpoints siguientes: Authorization: Bearer {jwt}
```

### 4.2 Usuarios

```
POST   /users/register          → registrar nuevo usuario (incluye funding de cuenta)
GET    /users/me                → perfil propio
PATCH  /users/me                → actualizar perfil (username, etc.)
POST   /users/me/location       → actualizar ubicación borrosa
DELETE /users/me/location       → salir del mapa (ocultar honguito)
GET    /users/:id               → perfil público de otro usuario
GET    /users/:id/reviews       → reviews recibidos por el usuario
```

**POST /users/register:**
```json
// Request
{
  "stellar_address": "GABC...XYZ",
  "username": "usuario_mx_47",
  "phone_hash": "abc123..."   // sha256(telefono_normalizado), opcional en Espora
}

// Response 201
{
  "user": { "id": "uuid", "username": "usuario_mx_47", "level": "espora" },
  "token": "eyJ...",
  "onboarding": {
    "account_funded": true,          // plataforma fondeó con XLM mínimo
    "funding_tx_hash": "abc123...",
    "mxne_trustline_needed": true,   // cliente debe crear trustline antes del primer trade
    "usdc_trustline_needed": true
  }
}
```

**POST /users/me/location:**
```json
// Request — el cliente ya envía la ubicación borrosa (redondeada en el dispositivo)
{
  "lat": 19.432,   // 3 decimales máximo
  "lng": -99.133
}
// Response 200
{ "ok": true, "expires_in": 1800 }  // 30 minutos
```

### 4.3 Dispositivos (tokens FCM)

```
POST   /users/me/devices        → registrar o actualizar token FCM
DELETE /users/me/devices/:id    → desregistrar dispositivo
```

**POST /users/me/devices:**
```json
// Request
{
  "fcm_token": "dKjS8f...",
  "platform": "ios",
  "device_name": "iPhone de Eric"
}
// Response 200
{ "device_id": "uuid" }
```

### 4.4 Ofertas

```
GET    /offers/nearby           → listar ofertas cercanas (para el mapa)
POST   /offers                  → publicar oferta
PATCH  /offers/:id              → actualizar oferta (precio, monto)
DELETE /offers/:id              → cancelar oferta
GET    /offers/:id              → detalle de oferta
```

**GET /offers/nearby:**
```
Query params:
  lat=19.432&lng=-99.133   ← ubicación del usuario
  radius=2000              ← metros, default 1500, max 5000
  type=sell                ← 'sell'|'buy'|'all'
  min_amount=500
  max_amount=5000

Response 200:
{
  "offers": [
    {
      "id": "uuid",
      "type": "sell",
      "user": {
        "username": "vendedor_88",
        "level": "hongo",
        "reputation_score": 847,
        "trade_count": 73,
        "avg_rating": 4.8
      },
      "asset": "MXNe",
      "min_amount": 500,
      "max_amount": 3000,
      "fee_percent": 1.5,
      "distance_meters": 820,     // distancia calculada server-side
      "fuzzy_lat": 19.435,        // posición borrosa, no exacta
      "fuzzy_lng": -99.137
    }
  ],
  "total": 8
}
```

> **Nota de privacidad:** el servidor calcula la distancia con la ubicación borrosa almacenada, nunca devuelve coordenadas exactas. La distancia es aproximada por diseño.

### 4.5 Trades

```
POST   /trades                  → iniciar trade (comprador solicita al vendedor)
GET    /trades/active           → trades activos del usuario
GET    /trades/:id              → detalle de trade
POST   /trades/:id/accept       → vendedor acepta el trade
POST   /trades/:id/lock         → vendedor confirma que bloqueó fondos on-chain
POST   /trades/:id/reveal       → vendedor confirma que recibió efectivo
GET    /trades/:id/secret       → vendedor obtiene el secreto para mostrar QR
POST   /trades/:id/complete     → comprador confirma escaneo del QR (webhook post-chain)
POST   /trades/:id/cancel       → cualquier parte cancela (antes de LOCKED)
POST   /trades/:id/dispute      → reportar disputa
POST   /trades/:id/rate         → calificar al otro usuario post-trade
```

**POST /trades:**
```json
// Request — el comprador inicia
{
  "offer_id": "uuid-de-la-oferta",
  "amount_mxn": 1500
}

// Response 201
{
  "trade": {
    "id": "uuid",
    "status": "pending",
    "seller": { "username": "vendedor_88", "stellar_address": "GABC..." },
    "buyer": { "username": "comprador_42", "stellar_address": "GXYZ..." },
    "amount_mxn": 1500,
    "amount_stroops": 150000000,
    "seller_fee_mxn": 22,
    "platform_fee_mxn": 12,
    "secret_hash": "a1b2c3...f4e5",    // generado al crear el trade, necesario para el lock on-chain
    "expires_at": "2026-03-21T15:30:00Z"
  }
}
```

> **⚠️ Cambio v1.1:** el `secret_hash` se genera al crear el trade y se devuelve en el response. El vendedor lo necesita para construir la tx de lock on-chain. El secreto cifrado se almacena en la DB solo después de confirmar el lock. Ver sección 5.3.

**POST /trades/:id/lock — el vendedor notifica que bloqueó on-chain:**
```json
// Request
{
  "stellar_trade_id": "id-del-contrato-soroban",
  "lock_tx_hash": "abc123..."
}
// El servidor verifica on-chain que el lock ocurrió antes de cambiar el estado.
// ENTONCES almacena el secreto cifrado en la DB (secret_enc + secret_nonce).
// Response 200 { "status": "locked" }
```

**GET /trades/:id/secret — SOLO el vendedor, SOLO en estado `revealing`:**
```json
// Headers: Authorization: Bearer {jwt}
// El JWT debe corresponder al seller_id del trade

// Response 200
{
  "secret": "7f3a9b...e4c2",   // hex string de 64 chars
  "qr_payload": "micopay://release?trade_id=uuid&secret=7f3a9b...e4c2",
  "expires_in": 120            // segundos hasta que se recomienda regenerar
}

// Response 403 si el solicitante es el comprador o un tercero
// Response 409 si el trade no está en estado 'revealing'
```

**POST /trades/:id/rate:**
```json
// Request
{ "rating": 5, "comment": "Todo perfecto, muy rápido" }
// Response 200 { "ok": true }
// Actualiza reputation_events, recalcula score, verifica si sube de nivel
```

### 4.6 Stellar (relay y onboarding)

```
POST   /stellar/submit          → relay de tx firmada a Stellar (rate limited)
POST   /stellar/check-trustline → verificar si usuario tiene trustline para un asset
POST   /stellar/build-trustline → construir tx de trustline (devuelve XDR sin firmar)
```

### 4.7 Payments (wallet capabilities — v1)

```
POST   /payments/send           → construir tx de pago MXNe/USDC directo (XDR sin firmar)
POST   /payments/path           → construir path payment vía Stellar DEX (auto-routing)
GET    /payments/path/quote     → obtener cotización de path payment antes de ejecutar
GET    /payments/history        → historial de pagos del usuario
GET    /payments/:id            → detalle de un pago
```

**POST /payments/send — pago directo entre wallets:**
```json
// Request
{
  "destination": "GXYZ...ABC",          // Stellar address del destinatario
  "asset": "MXNe",                      // MXNe | USDC
  "amount": "1500.00",                  // en unidades del asset
  "memo": "Pago renta marzo"            // opcional, max 28 chars (Stellar memo)
}
// Response 200
{
  "tx_xdr": "AAAA...",                  // XDR sin firmar → cliente firma con biometrics
  "fee_xlm": "0.00001",
  "estimated_time_seconds": 5
}
```

**POST /payments/path — path payment con DEX routing automático:**
```json
// Request — enviar en MXNe, destinatario recibe USDC
{
  "destination": "GXYZ...ABC",
  "send_asset": "MXNe",
  "send_amount": "1500.00",
  "dest_asset": "USDC",
  "max_slippage_percent": 0.5           // máximo slippage aceptable
}
// Response 200
{
  "tx_xdr": "AAAA...",
  "send_amount": "1500.00",
  "dest_amount": "82.41",               // USDC que recibirá (al tipo de cambio actual)
  "exchange_rate": "18.20",             // MXNe/USDC
  "path": ["MXNe", "XLM", "USDC"],     // ruta que encontró el DEX
  "fee_xlm": "0.00001",
  "quote_expires_in": 30                // segundos
}
```

**GET /payments/path/quote — cotización sin construir tx:**
```json
// Query: ?send_asset=MXNe&send_amount=1500&dest_asset=USDC
// Response 200
{
  "send_amount": "1500.00",
  "dest_amount": "82.41",
  "exchange_rate": "18.20",
  "path": ["MXNe", "XLM", "USDC"],
  "expires_in": 30
}
```

### 4.8 SPEI On/Off Ramp (SEP-24 — v1)

```
POST   /ramp/deposit/start     → iniciar depósito MXN→MXNe vía SPEI anchor
GET    /ramp/deposit/:id       → estado del depósito
POST   /ramp/withdraw/start    → iniciar retiro MXNe→MXN a cuenta bancaria
GET    /ramp/withdraw/:id      → estado del retiro
GET    /ramp/history           → historial de on/off ramp
```

**POST /ramp/deposit/start:**
```json
// Request
{
  "amount_mxn": 5000,
  "asset": "MXNe"
}
// Response 200
{
  "deposit_id": "uuid",
  "status": "pending_transfer",
  "spei_instructions": {
    "clabe": "012345678901234567",      // CLABE del anchor
    "beneficiary": "Micopay Anchor SA",
    "reference": "MCP-uuid-short",       // referencia para tracking
    "amount_mxn": 5000
  },
  "expires_at": "2026-03-21T16:00:00Z"
}
// El usuario hace una transferencia SPEI desde su banco.
// El anchor detecta el pago, mintea MXNe, y lo envía a la wallet del usuario.
// El backend hace polling del status vía SEP-24 callback.
```

**POST /ramp/withdraw/start:**
```json
// Request
{
  "amount_mxne": "5000.0000000",        // en stroops-friendly string
  "bank_clabe": "012345678901234567",    // CLABE destino del usuario
  "bank_name": "BBVA"
}
// Response 200
{
  "withdraw_id": "uuid",
  "status": "pending_anchor",
  "tx_xdr": "AAAA...",                  // tx para enviar MXNe al anchor — cliente firma
  "estimated_arrival": "2-24 hours"      // SPEI settlement time
}
```

> **Nota SEP-24:** el flujo interactivo de SEP-24 implica que el anchor tiene su propia UI web (KYC, confirmación). El app abre un webview embebido para el flujo del anchor. El backend orquesta los callbacks y actualiza el estado en la DB.

### 4.9 Savings (v2-v3 roadmap — endpoints preparados)

```
POST   /savings/deposit         → depositar MXNe en instrumento de ahorro
POST   /savings/withdraw        → retirar de instrumento de ahorro
GET    /savings/positions       → posiciones activas del usuario
GET    /savings/positions/:id   → detalle de posición
GET    /savings/rates           → tasas actuales disponibles (Blend yield, CETES rate)
```

> **v2 (Blend):** deposit/withdraw interactúan con Blend pools en Soroban. Ver sección 18.
> **v3 (Etherfuse):** deposit/withdraw interactúan con Etherfuse API para CETES. Ver sección 19.
> Los endpoints se definen ahora para que el cliente pueda implementar la UI sabiendo la interfaz, aunque el backend devuelva 501 Not Implemented hasta que la integración esté lista.

### 4.10 Admin (solo con JWT de rol admin)

```
GET    /admin/disputes          → listar disputas abiertas
POST   /admin/disputes/:id/resolve → resolver disputa
POST   /admin/users/:id/suspend    → suspender usuario
DELETE /admin/users/:id/suspend    → levantar suspensión
GET    /admin/trades/stats         → métricas del sistema
POST   /admin/trades/:id/emergency-refund → forzar refund (timeout absoluto)
```

---

## 5. El Secreto y el Mecanismo QR

Esta es la pieza más delicada de seguridad del backend.

### 5.1 Generación del secreto

El servidor genera el secreto y su hash cuando el trade se **crea** (POST /trades). El hash es necesario para que el vendedor pueda construir la tx de lock on-chain. El secreto cifrado se almacena en la DB solo **después** de confirmar el lock on-chain.

```typescript
import { randomBytes, createHash } from 'crypto';

function generateTradeSecret(): { secret: string; secretHash: string } {
  const secretBytes = randomBytes(32);
  const secret = secretBytes.toString('hex');                    // 64 chars hex
  const secretHash = createHash('sha256')
    .update(secretBytes)
    .digest('hex');                                              // lo que va al contrato
  return { secret, secretHash };
}
```

### 5.2 Almacenamiento del secreto — cifrado en reposo

El secreto **nunca se almacena en texto plano**. Se cifra con AES-256-GCM antes de guardarlo en la DB.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.SECRET_ENCRYPTION_KEY!, 'hex');
// 32 bytes = 64 chars hex. Generado con: openssl rand -hex 32

function encryptSecret(secret: string): { encrypted: Buffer; nonce: Buffer } {
  const nonce = randomBytes(12);                                 // 96-bit nonce para GCM
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, nonce);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
    cipher.getAuthTag()                                          // 16 bytes de autenticación
  ]);
  return { encrypted, nonce };
}

function decryptSecret(encrypted: Buffer, nonce: Buffer): string {
  const authTag = encrypted.slice(-16);
  const ciphertext = encrypted.slice(0, -16);
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, nonce);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
```

### 5.3 Flujo completo del secreto (CORREGIDO v1.1)

```
1. Comprador llama POST /trades
   → Servidor genera { secret, secretHash } = generateTradeSecret()
   → Almacena secret_hash en la tabla trades (texto plano — es público)
   → Mantiene secret en memoria temporalmente (NO lo guarda cifrado aún)
   → Devuelve secret_hash en el response al comprador
   → El comprador se lo pasa al vendedor (está en el trade detail)

2. Vendedor construye la tx de lock on-chain usando el secret_hash
   → El contrato EscrowFactory.lock() recibe el secret_hash como parámetro
   → El vendedor firma y submite la tx

3. Vendedor llama POST /trades/:id/lock { stellar_trade_id, lock_tx_hash }
   → Servidor verifica on-chain que el lock ocurrió con los parámetros correctos
   → ENTONCES cifra y almacena el secreto:
      { encrypted, nonce } = encryptSecret(secret)
      → Almacena secret_enc + secret_nonce en la DB
      → El secret plaintext se descarta de memoria
   → Trade pasa a estado LOCKED
   → absolute_timeout_at = NOW() + 72 hours

4. Trade en estado LOCKED
   → El secreto existe en DB cifrado
   → Nadie puede acceder al secreto todavía

5. Vendedor llama POST /trades/:id/reveal
   → Trade pasa a estado REVEALING
   → Ahora el endpoint GET /trades/:id/secret está habilitado

6. Vendedor llama GET /trades/:id/secret
   → Servidor descifra el secreto de la DB
   → Devuelve el secreto en el response (solo por HTTPS)
   → Vendedor genera el QR con este secreto en el dispositivo
   → Se loggea el acceso en secret_access_log
   → El secreto no se cachea

7. Comprador escanea QR → construye tx con el secreto → submit a Stellar
   → El secreto es ahora público on-chain (visible en el ledger)
   → El contrato verifica sha256(secret) == secret_hash ✓
   → Fondos liberados

8. POST /trades/:id/complete (webhook o polling del cliente)
   → Trade pasa a COMPLETED
   → El secreto cifrado se borra de la DB (ya no sirve)
   → Los chat_messages del trade se borran
```

> **⚠️ Nota de implementación:** entre el paso 1 y el paso 3 el secreto debe mantenerse disponible en el servidor. Dos opciones:
> - **Opción A (recomendada):** cifrar y almacenar el secreto inmediatamente en el paso 1, pero no habilitarlo para acceso hasta el paso 5. El flag de acceso es el estado del trade (`revealing`), no la existencia del secreto.
> - **Opción B:** mantener el secreto en Redis con TTL corto (30 min) durante el paso 1, y moverlo a la DB cifrado en el paso 3. Riesgo: si Redis se reinicia entre pasos 1 y 3, se pierde el secreto.
>
> Opción A es más robusta y simple. La distinción entre "secreto existe" y "secreto accesible" la controla el estado del trade.

### 5.4 Cuándo el servidor puede acceder al secreto (casos de uso legítimos)

| Caso | Quién | Cuándo |
|---|---|---|
| Mostrar QR al vendedor | El propio vendedor (JWT match) | Solo en estado REVEALING |
| Resolver disputa a favor del comprador | Admin (JWT admin) | Solo en estado DISPUTED |
| Emergency refund (timeout absoluto) | Sistema automático | Solo si absolute_timeout_at expiró |
| Auditoría interna | Solo con acceso directo a DB + rotation key | Con log de acceso obligatorio |

Cualquier otro acceso al secreto debe devolver 403.

---

## 6. Integración con Stellar / Soroban

### 6.1 Configuración del cliente Stellar

```typescript
import { SorobanRpc, TransactionBuilder, Networks, Keypair, Address } from '@stellar/stellar-sdk';

// Para MVP usar el RPC público de SDF
const rpc = new SorobanRpc.Server('https://soroban-mainnet.stellar.org');

// Para testnet durante desarrollo:
// const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
// const networkPassphrase = Networks.TESTNET;
const networkPassphrase = Networks.PUBLIC;

// Keypair de la plataforma (para operaciones admin)
const platformKeypair = Keypair.fromSecret(process.env.PLATFORM_SECRET_KEY!);
```

### 6.2 Función base para construir transacciones Soroban

```typescript
async function buildSorobanTx(
  sourceAddress: string,
  operations: any[]
): Promise<string> {
  // Obtener account
  const account = await rpc.getAccount(sourceAddress);

  // Construir tx base con fee placeholder (se ajustará después de simular)
  let tx = new TransactionBuilder(account, {
    fee: '100',                          // fee mínimo placeholder
    networkPassphrase,
  });

  for (const op of operations) {
    tx.addOperation(op);
  }

  tx.setTimeout(60);
  const builtTx = tx.build();

  // Simular para obtener los datos de recursos Soroban (obligatorio)
  const simResult = await rpc.simulateTransaction(builtTx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  // Preparar la tx con los datos de simulación (footprint, resources, fee recomendado)
  // assembleTransaction() aplica automáticamente el fee correcto de la simulación
  const preparedTx = SorobanRpc.assembleTransaction(builtTx, simResult).build();

  // Devolver XDR sin firmar → el cliente lo firmará
  return preparedTx.toXDR();
}
```

> **⚠️ Cambio v1.1 — Fee dinámico:** el fee fijo de `1000000` (0.1 XLM) fue reemplazado por un fee placeholder mínimo. `assembleTransaction()` aplica automáticamente el fee que la simulación calculó basándose en los recursos reales de la transacción. Esto evita sobrepagar en momentos tranquilos y ser rechazado en momentos de congestión. Si se desea un margin de seguridad, se puede multiplicar el fee recomendado por 1.5x:
> ```typescript
> const recommended = Number(preparedTx.fee);
> const withMargin = Math.ceil(recommended * 1.5).toString();
> // Rebuild con el fee ajustado si se necesita
> ```

### 6.3 Construir la tx de lock (la devolvemos al cliente para que firme)

```typescript
import { Contract, Address, nativeToScVal } from '@stellar/stellar-sdk';

const ESCROW_CONTRACT_ID = process.env.ESCROW_CONTRACT_ID!;

async function buildLockTransaction(
  sellerAddress: string,     // G... string (StrKey format)
  buyerAddress: string,      // G... string
  amountStroops: bigint,
  platformFeeStroops: bigint,
  secretHash: string,        // hex string de 64 chars
  timeoutMinutes: number
): Promise<string> {
  const contract = new Contract(ESCROW_CONTRACT_ID);

  const lockOp = contract.call(
    'lock',
    // Usar Address.fromString() — Stellar addresses son StrKey (base32), NO base64
    Address.fromString(sellerAddress).toScVal(),
    Address.fromString(buyerAddress).toScVal(),
    nativeToScVal(amountStroops, { type: 'i128' }),
    nativeToScVal(platformFeeStroops, { type: 'i128' }),
    nativeToScVal(Buffer.from(secretHash, 'hex'), { type: 'bytes' }),
    nativeToScVal(timeoutMinutes, { type: 'u32' }),
  );

  return buildSorobanTx(sellerAddress, [lockOp]);
}
```

> **⚠️ Corrección v1.1:** la versión anterior usaba `Buffer.from(sellerAddress, 'base64')` lo cual es incorrecto. Las Stellar addresses (G...) usan StrKey encoding (base32 con checksum). El SDK provee `Address.fromString()` que maneja esto correctamente.

### 6.4 Verificar on-chain que el lock ocurrió

Antes de activar el trade, verificamos que el bloqueo realmente ocurrió en Stellar:

```typescript
async function verifyLockOnChain(
  stellarTradeId: string,
  expectedSellerAddress: string,
  expectedAmountStroops: bigint
): Promise<boolean> {
  try {
    const contract = new Contract(ESCROW_CONTRACT_ID);

    // Construir tx de simulación para get_trade()
    const account = await rpc.getAccount(platformKeypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'get_trade',
          nativeToScVal(Buffer.from(stellarTradeId, 'hex'), { type: 'bytes' })
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await rpc.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      return false;
    }

    const tradeData = parseTradeFromSoroban(simResult);

    return (
      tradeData.seller === expectedSellerAddress &&
      tradeData.amount === expectedAmountStroops &&
      tradeData.status === 'Locked'
    );
  } catch {
    return false;
  }
}
```

### 6.5 Construir tx de trustline (necesaria antes del primer trade)

```typescript
import { Operation, Asset } from '@stellar/stellar-sdk';

const MXNE_ISSUER = process.env.MXNE_ISSUER_ADDRESS!;
const USDC_ISSUER = process.env.USDC_ISSUER_ADDRESS!;

async function buildTrustlineTransaction(
  userAddress: string,
  assetCode: 'MXNe' | 'USDC'
): Promise<string> {
  const issuer = assetCode === 'MXNe' ? MXNE_ISSUER : USDC_ISSUER;
  const asset = new Asset(assetCode, issuer);

  const account = await rpc.getAccount(userAddress);
  const tx = new TransactionBuilder(account, {
    fee: '100000',           // trustline es tx Classic, fee más predecible
    networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build();

  // Devolver XDR sin firmar → el cliente firma con biometrics
  return tx.toXDR();
}

// Verificar si una trustline existe
async function hasTrustline(
  userAddress: string,
  assetCode: 'MXNe' | 'USDC'
): Promise<boolean> {
  try {
    const account = await rpc.getAccount(userAddress);
    const issuer = assetCode === 'MXNe' ? MXNE_ISSUER : USDC_ISSUER;
    return account.balances.some(
      (b: any) => b.asset_code === assetCode && b.asset_issuer === issuer
    );
  } catch {
    return false;
  }
}
```

### 6.6 Submit de transacciones ya firmadas por el cliente

El cliente firma y envía directamente a Stellar en la mayoría de los casos. El servidor tiene un endpoint de relay opcional para casos donde el cliente no puede conectarse directamente:

```typescript
// POST /stellar/submit
app.post('/stellar/submit', {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute'
    }
  }
}, async (req, reply) => {
  const { xdr } = req.body;

  try {
    const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);

    // Validar que la tx es para nuestros contratos (no relay de txs arbitrarias)
    const allowedContracts = new Set([
      process.env.ESCROW_CONTRACT_ID,
      process.env.REPUTATION_CONTRACT_ID,
      process.env.NFT_CONTRACT_ID,
    ]);

    const isOurContract = tx.operations.every(op => {
      // Extraer contract ID del invokeHostFunction operation
      const contractId = extractContractId(op);
      return contractId && allowedContracts.has(contractId);
    });

    if (!isOurContract) {
      return reply.status(403).send({ error: 'Unauthorized contract' });
    }

    const result = await rpc.sendTransaction(tx);
    return { hash: result.hash, status: result.status };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});
```

### 6.7 Polling del estado de una transacción

Las transacciones Soroban se confirman en ~5-6 segundos pero pueden tardar más. El cliente hace polling:

```typescript
async function waitForTransaction(hash: string, maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    const result = await rpc.getTransaction(hash);

    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return true;
    }
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on-chain');
    }
    // Si es NOT_FOUND, seguimos esperando
  }
  throw new Error('Transaction timeout');
}
```

---

## 7. Contratos Soroban

Los contratos están escritos en Rust. El backend interactúa con ellos a través del Stellar SDK.

### 7.1 EscrowFactory

**Funciones públicas:**

```rust
// Crear un nuevo escrow para un trade
// Llamado por: el SELLER
fn lock(
    env: Env,
    seller: Address,
    buyer: Address,
    amount: i128,          // en stroops de MXNe
    platform_fee: i128,    // en stroops, va a la wallet de Micopay
    secret_hash: BytesN<32>,
    timeout_minutes: u32
) -> BytesN<32>            // retorna el trade_id del contrato

// Liberar fondos al comprador presentando el secreto
// Llamado por: el BUYER
fn release(
    env: Env,
    trade_id: BytesN<32>,
    secret: Bytes           // el preimage de secret_hash
)

// Reembolsar al vendedor si expiró el timeout
// Llamado por: cualquiera (generalmente el vendedor o el job del backend)
fn refund(
    env: Env,
    trade_id: BytesN<32>
)

// Emergency refund — timeout absoluto de 72h, no requiere que expire el timeout del trade
// Llamado por: solo admin multisig
fn emergency_refund(
    env: Env,
    trade_id: BytesN<32>
)

// Resolver disputa — solo admin multisig
fn resolve_dispute(
    env: Env,
    trade_id: BytesN<32>,
    winner: Address
)

// Leer estado del trade (función de lectura, no modifica estado)
fn get_trade(
    env: Env,
    trade_id: BytesN<32>
) -> TradeEscrow

// Extender TTL de un trade activo (ver sección 10)
fn bump_trade_ttl(
    env: Env,
    trade_id: BytesN<32>,
    extend_to: u32          // ledgers adicionales
)
```

**Eventos que emite el contrato** (el backend los escucha):

```rust
// Al bloquear
event!("trade_locked", trade_id, seller, buyer, amount, expires_at);

// Al liberar
event!("trade_completed", trade_id, seller, buyer);

// Al reembolsar (timeout normal)
event!("trade_cancelled", trade_id, seller);

// Al forzar emergency refund (timeout absoluto)
event!("trade_emergency_refund", trade_id, seller, reason);

// Al resolver disputa
event!("dispute_resolved", trade_id, winner);
```

### 7.2 ReputationRegistry

```rust
// Registrar evento de reputación — solo EscrowFactory puede llamar
fn record_event(
    env: Env,
    user: Address,
    event_type: Symbol,    // 'trade_completed' | 'no_show' | 'dispute_lost'
    trade_id: BytesN<32>
)

// Obtener score actual de un usuario
fn get_score(env: Env, user: Address) -> i128

// Obtener nivel actual
fn get_level(env: Env, user: Address) -> Symbol

// Suspender usuario — solo admin
fn suspend(env: Env, user: Address, until: u64)
```

### 7.3 MicopayNFT (Soulbound)

```rust
// Mintear NFT inicial al registrarse — solo plataforma
fn mint(env: Env, user: Address) -> u64  // retorna token_id

// Evolucionar NFT al subir de nivel — solo ReputationRegistry
fn evolve(env: Env, user: Address, new_level: Symbol)

// Obtener nivel/metadata del NFT
fn get_nft(env: Env, user: Address) -> NftData

// Transferencia deshabilitada — siempre falla
fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    panic!("Reputation NFTs are soulbound and non-transferable")
}
```

---

## 8. Onboarding de Cuentas Stellar

### 8.1 El problema: cuentas nuevas en Stellar necesitan funding

Una cuenta Stellar no existe en la red hasta que recibe un `create_account` con al menos el base reserve (~1 XLM). Además, cada trustline adicional requiere 0.5 XLM en reserve. Para que un usuario nuevo pueda operar en Micopay necesita:

| Concepto | XLM requerido |
|---|---|
| Base reserve (crear cuenta) | 1.0 XLM |
| Trustline MXNe | 0.5 XLM |
| Trustline USDC (opcional) | 0.5 XLM |
| Gas para primeras transacciones | ~0.5 XLM |
| **Total mínimo** | **~2.5 XLM** |

### 8.2 La plataforma fondea la cuenta nueva

Al registrarse, la plataforma crea y fondea la cuenta del usuario con el mínimo necesario:

```typescript
import { Keypair, Operation, TransactionBuilder, Asset } from '@stellar/stellar-sdk';

const FUNDING_AMOUNT = '3';  // XLM — base reserve + trustlines + gas buffer
const DAILY_FUNDING_LIMIT = 50;  // max cuentas nuevas por día (anti-Sybil)

async function fundNewAccount(
  newAddress: string,
  userId: string,
  phoneHash: string | null,
  ip: string
): Promise<string> {
  // Anti-Sybil checks
  await antiSybilChecks(userId, phoneHash, ip);

  const platformAccount = await rpc.getAccount(platformKeypair.publicKey());

  const tx = new TransactionBuilder(platformAccount, {
    fee: '100000',
    networkPassphrase,
  })
    .addOperation(
      Operation.createAccount({
        destination: newAddress,
        startingBalance: FUNDING_AMOUNT,
      })
    )
    .setTimeout(60)
    .build();

  tx.sign(platformKeypair);  // esta es la ÚNICA tx que la plataforma firma
  const result = await rpc.sendTransaction(tx);
  const success = await waitForTransaction(result.hash);

  if (success) {
    // Registrar en la DB para tracking anti-Sybil
    await db.execute(`
      INSERT INTO account_funding_log (user_id, stellar_address, xlm_amount, tx_hash, phone_hash, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, newAddress, FUNDING_AMOUNT, result.hash, phoneHash, ip]);

    await db.execute(
      `UPDATE users SET account_funded = true WHERE id = $1`,
      [userId]
    );
  }

  return result.hash;
}
```

### 8.3 Anti-Sybil: protección contra creación masiva de cuentas

```typescript
async function antiSybilChecks(userId: string, phoneHash: string | null, ip: string) {
  // 1. Límite diario global
  const todayCount = await db.query(`
    SELECT COUNT(*) FROM account_funding_log
    WHERE funded_at > NOW() - INTERVAL '24 hours'
  `);
  if (parseInt(todayCount.rows[0].count) >= DAILY_FUNDING_LIMIT) {
    throw new TooManyRequestsError('Daily funding limit reached. Try again tomorrow.');
  }

  // 2. Máximo 2 cuentas por IP en 24h
  const ipCount = await db.query(`
    SELECT COUNT(*) FROM account_funding_log
    WHERE ip_address = $1 AND funded_at > NOW() - INTERVAL '24 hours'
  `, [ip]);
  if (parseInt(ipCount.rows[0].count) >= 2) {
    throw new TooManyRequestsError('Too many accounts from this network.');
  }

  // 3. Si tiene phone_hash, verificar que no haya otra cuenta con el mismo teléfono
  if (phoneHash) {
    const phoneExists = await db.query(`
      SELECT 1 FROM account_funding_log
      WHERE phone_hash = $1
    `, [phoneHash]);
    if (phoneExists.rows.length > 0) {
      throw new ConflictError('Phone already associated with another account.');
    }
  }

  // 4. KYC level 1 (teléfono) requerido para funding — previene bots
  // En MVP se puede relajar esto, pero documentar el riesgo.
}
```

### 8.4 Trustlines — se crean bajo demanda

Las trustlines NO se crean automáticamente al registrarse (costaría reserve extra sin necesidad). Se crean cuando el usuario intenta su primer trade con un asset específico:

```typescript
// Middleware que verifica trustline antes de crear un trade
async function ensureTrustline(
  userAddress: string,
  asset: 'MXNe' | 'USDC'
): Promise<{ ready: boolean; txXdr?: string }> {
  const exists = await hasTrustline(userAddress, asset);

  if (exists) {
    return { ready: true };
  }

  // Devolver XDR sin firmar para que el cliente cree la trustline
  const txXdr = await buildTrustlineTransaction(userAddress, asset);
  return { ready: false, txXdr };
}
```

> **Flujo UX:** si el usuario intenta crear su primera oferta de MXNe y no tiene trustline, el backend devuelve un error con el XDR de la trustline para que el cliente lo firme. Esto ocurre una sola vez por asset.

---

## 9. Gestión de Wallets Self-Custodial

> **Terminología:** estas son wallets **self-custodial** (también llamadas non-custodial). La clave privada nunca sale del dispositivo del usuario. El servidor no la ve, no la almacena, no la tiene. Si el usuario pierde su dispositivo sin backup, pierde acceso a su wallet. La plataforma NO puede recuperar claves.

### 9.1 Principio: el servidor NO conoce la clave privada

Para wallets self-custodial, la clave privada se genera y almacena **solo en el dispositivo del usuario**, cifrada con biometrics (Face ID / huella dactilar). El servidor nunca la ve.

```
Dispositivo del usuario:
├── Keypair generado localmente al registrarse
├── Clave privada cifrada con Secure Enclave (iOS) / Keystore (Android)
├── Clave pública enviada al servidor para registrar la wallet
└── Para firmar: Face ID/huella → Secure Enclave → firma sin exponer la clave
```

### 9.2 Qué hace el servidor para wallets self-custodial

Solo guarda la **dirección pública** (Stellar address). Cuando hay que firmar una transacción:

1. El servidor construye la transacción (XDR sin firmar)
2. La envía al cliente
3. El cliente solicita biometrics al usuario
4. El cliente firma el XDR con la clave del Secure Enclave
5. El cliente hace submit directamente a Stellar (o vía el relay del servidor)

### 9.3 Crear wallet al registrarse (flujo del cliente)

```typescript
// En el CLIENTE (React Native)
import { Keypair } from '@stellar/stellar-sdk';
import * as Keychain from 'react-native-keychain';

async function createSelfCustodialWallet(): Promise<string> {
  // 1. Generar keypair en el dispositivo
  const keypair = Keypair.random();

  // 2. Guardar clave privada cifrada en el Secure Enclave / Keystore
  await Keychain.setGenericPassword(
    keypair.publicKey(),          // username (identificador)
    keypair.secret(),             // password (la clave privada)
    {
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      service: 'micopay-wallet'
    }
  );

  // 3. Enviar solo la clave pública al servidor
  await api.registerWallet({ stellar_address: keypair.publicKey() });

  // La clave privada NUNCA salió del dispositivo
  return keypair.publicKey();
}

// Para firmar una transacción
async function signAndSubmit(txXDR: string): Promise<string> {
  // Obtener keypair del Secure Enclave (requiere biometrics)
  const creds = await Keychain.getGenericPassword({
    authenticationPrompt: { title: 'Confirmar intercambio' },
    service: 'micopay-wallet'
  });

  const keypair = Keypair.fromSecret(creds.password);
  const tx = TransactionBuilder.fromXDR(txXDR, Networks.PUBLIC);
  tx.sign(keypair);

  return tx.toXDR();  // XDR firmado, listo para submit
}
```

---

## 10. Payment Rails — Stellar Native

Más allá del escrow P2P, la wallet de Micopay aprovecha los payment rails nativos de Stellar para ofrecer una experiencia financiera completa. Estas son capacidades de **v1** que funcionan desde el primer día.

### 10.1 MXNe y USDC — SAC Tokens

MXNe (peso mexicano estabilizado) y USDC son assets Stellar Classic que también están disponibles como Soroban Asset Contracts (SAC). Esto permite que los contratos Soroban interactúen con ellos directamente.

```typescript
import { Asset, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

const MXNE = new Asset('MXNe', process.env.MXNE_ISSUER_ADDRESS!);
const USDC = new Asset('USDC', process.env.USDC_ISSUER_ADDRESS!);

// Construir pago directo de MXNe
async function buildDirectPayment(
  senderAddress: string,
  destinationAddress: string,
  asset: 'MXNe' | 'USDC',
  amount: string,
  memo?: string
): Promise<string> {
  const stellarAsset = asset === 'MXNe' ? MXNE : USDC;
  const account = await rpc.getAccount(senderAddress);

  let txBuilder = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase,
  })
    .addOperation(Operation.payment({
      destination: destinationAddress,
      asset: stellarAsset,
      amount,
    }))
    .setTimeout(60);

  if (memo) {
    txBuilder.addMemo(Memo.text(memo));
  }

  return txBuilder.build().toXDR();
}
```

### 10.2 Path Payments — Stellar DEX Routing

Los path payments permiten enviar en un asset y que el destinatario reciba en otro. Stellar encuentra automáticamente la mejor ruta a través del DEX (order book nativo).

```typescript
import { Operation } from '@stellar/stellar-sdk';

// Construir path payment: enviar MXNe, destinatario recibe USDC
async function buildPathPayment(
  senderAddress: string,
  destinationAddress: string,
  sendAsset: Asset,
  sendMax: string,          // máximo a enviar
  destAsset: Asset,
  destAmount: string,       // cantidad exacta que recibe el destinatario
): Promise<{ txXdr: string; path: string[] }> {
  // Consultar Horizon para encontrar la ruta óptima
  const horizonServer = new Horizon.Server('https://horizon.stellar.org');
  const paths = await horizonServer
    .strictReceivePaths(sendAsset, sendMax, destAsset, destAmount)
    .call();

  if (paths.records.length === 0) {
    throw new Error('No path found for this asset pair');
  }

  const bestPath = paths.records[0];

  const account = await rpc.getAccount(senderAddress);
  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase,
  })
    .addOperation(Operation.pathPaymentStrictReceive({
      sendAsset,
      sendMax: bestPath.source_amount,
      destination: destinationAddress,
      destAsset,
      destAmount,
      path: bestPath.path.map((p: any) => new Asset(p.asset_code, p.asset_issuer)),
    }))
    .setTimeout(60)
    .build();

  return {
    txXdr: tx.toXDR(),
    path: [sendAsset.code, ...bestPath.path.map((p: any) => p.asset_code), destAsset.code],
  };
}
```

> **Casos de uso de path payments en Micopay:**
> - **Pago cross-currency:** el usuario envía MXNe, el comercio recibe USDC.
> - **Remesas:** MXNe en México → USDC → anchor local en destino (e.g. Philippines).
> - **Compra directa:** el usuario tiene USDC pero quiere pagar en MXNe a un vendor.

### 10.3 Anchors SPEI — On/Off Ramp para México

Micopay integra dos anchors nativos en Stellar para México, ambos operan vía SPEI:

| Anchor | Asset | Flujo | KYC |
|---|---|---|---|
| **Etherfuse** | CETES (bonos gobierno MX) | MXN↔CETES vía SPEI | Iframe (onboarding URL) |
| **AlfredPay** | USDC | MXN↔USDC vía SPEI | Formulario |

> **⚠️ Corrección v1.3:** Etherfuse es un anchor nativo en Stellar — emite CETES directamente en la red Stellar. **No hay bridge a Solana.** Los CETES son assets Stellar Classic, no tokens envueltos. Esto simplifica enormemente la integración y elimina el riesgo de bridge cross-chain.

La integración con ambos anchors usa la librería portable del **Regional Starter Pack** de SDF, que implementa la interfaz `Anchor` compartida.

```
Flujo de DEPÓSITO con Etherfuse (MXN → CETES):
1. Crear customer en Etherfuse → recibir URL de KYC
2. Completar KYC vía iframe embebido en la app
3. Obtener quote MXN→CETES
4. Crear orden de on-ramp → recibir instrucciones SPEI
5. Usuario transfiere MXN vía SPEI desde su banco
6. Etherfuse entrega CETES tokens a la wallet Stellar del usuario

Flujo de DEPÓSITO con AlfredPay (MXN → USDC):
1. Crear customer en AlfredPay (o lookup por email)
2. Submit KYC vía formulario
3. Obtener quote MXN→USDC
4. Crear orden de on-ramp → recibir instrucciones SPEI
5. Usuario transfiere MXN vía SPEI
6. AlfredPay entrega USDC a la wallet Stellar del usuario

Flujo de RETIRO con Etherfuse (CETES → MXN):
1. Obtener quote CETES→MXN
2. Crear orden de off-ramp
3. Polling hasta que aparezca el XDR de burn transaction
4. Firmar la tx de burn con la wallet del usuario
5. Etherfuse envía MXN al banco del usuario vía SPEI

Flujo de RETIRO con AlfredPay (USDC → MXN):
1. Obtener quote USDC→MXN
2. Crear orden de off-ramp
3. Construir tx de pago USDC al address del anchor
4. Firmar y submit a Stellar
5. AlfredPay envía MXN al banco vía SPEI
```

```typescript
// Usando la librería del Regional Starter Pack
// Copiar src/lib/anchors/ del repo al proyecto

// Interfaz compartida que implementan todos los anchors
interface Anchor {
  createCustomer(data: CustomerData): Promise<Customer>;
  getQuote(params: QuoteParams): Promise<Quote>;
  createOnRampOrder(params: OnRampParams): Promise<OnRampOrder>;
  createOffRampOrder(params: OffRampParams): Promise<OffRampOrder>;
}

// Ejemplo: on-ramp con Etherfuse (MXN → CETES)
import { EtherfuseAnchor } from './lib/anchors/etherfuse';

const etherfuse = new EtherfuseAnchor({
  apiUrl: process.env.ETHERFUSE_API_URL!,
  apiKey: process.env.ETHERFUSE_API_KEY!,
});

async function initiateEtherfuseDeposit(
  userId: string,
  amountMxn: number
): Promise<{ kycUrl?: string; speiInstructions?: SpeiInstructions }> {
  const user = await db.getUser(userId);

  // 1. Crear customer (devuelve URL de KYC para iframe)
  const customer = await etherfuse.createCustomer({
    email: user.email,
    stellar_address: user.stellar_address,
  });

  // Si KYC no completado, devolver URL del iframe
  if (!customer.kyc_complete) {
    return { kycUrl: customer.onboarding_url };
  }

  // 2. Obtener quote
  const quote = await etherfuse.getQuote({
    from_currency: 'MXN',
    to_asset: 'CETES',
    amount: amountMxn,
  });

  // 3. Crear orden → recibir instrucciones SPEI
  const order = await etherfuse.createOnRampOrder({
    customer_id: customer.id,
    quote_id: quote.id,
    stellar_address: user.stellar_address,
  });

  // 4. Guardar en DB
  await db.execute(`
    INSERT INTO payment_transactions
    (user_id, type, dest_asset, dest_amount, anchor_tx_id, status)
    VALUES ($1, 'deposit', 'CETES', $2, $3, 'pending')
  `, [userId, amountMxn, order.id]);

  return {
    speiInstructions: {
      clabe: order.spei_clabe,
      beneficiary: order.beneficiary_name,
      reference: order.reference,
      amount_mxn: amountMxn,
    }
  };
}

// Ejemplo: on-ramp con AlfredPay (MXN → USDC)
import { AlfredPayAnchor } from './lib/anchors/alfredpay';

const alfredpay = new AlfredPayAnchor({
  apiUrl: process.env.ALFREDPAY_API_URL!,
  apiKey: process.env.ALFREDPAY_API_KEY!,
});

async function initiateAlfredPayDeposit(
  userId: string,
  amountMxn: number
): Promise<SpeiInstructions> {
  const user = await db.getUser(userId);

  const customer = await alfredpay.createCustomer({
    email: user.email,
    stellar_address: user.stellar_address,
  });

  const quote = await alfredpay.getQuote({
    from_currency: 'MXN',
    to_asset: 'USDC',
    amount: amountMxn,
  });

  const order = await alfredpay.createOnRampOrder({
    customer_id: customer.id,
    quote_id: quote.id,
    stellar_address: user.stellar_address,
  });

  await db.execute(`
    INSERT INTO payment_transactions
    (user_id, type, dest_asset, dest_amount, anchor_tx_id, status)
    VALUES ($1, 'deposit', 'USDC', $2, $3, 'pending')
  `, [userId, quote.dest_amount, order.id]);

  return {
    clabe: order.spei_clabe,
    beneficiary: order.beneficiary_name,
    reference: order.reference,
    amount_mxn: amountMxn,
  };
}
```

> **KYC del anchor:** cada anchor maneja su propio KYC. Etherfuse usa un iframe (onboarding URL), AlfredPay usa un formulario con datos de identidad. Micopay no almacena documentos de identidad — los anchors se encargan. El nivel de KYC de Micopay (`kyc_level` en `users`) es independiente del KYC del anchor.

### 10.4 Cross-Border Payments

Los pagos cross-border se construyen como path payments que pasan por el DEX de Stellar y terminan en un anchor del país destino.

```
México → Filipinas:
MXNe → [Stellar DEX: MXNe→XLM→PHP] → PHP anchor → GCash/bank del destinatario

México → USA:
MXNe → [Stellar DEX: MXNe→USDC] → USDC anchor → ACH/wire al destinatario
```

Para v1 esto se habilita automáticamente por los path payments. No se requiere integración adicional más allá de tener las trustlines correctas. El backend construye el path payment y el cliente firma.

---

## 11. TTL Management en Soroban

### 10.1 El problema: los datos en Soroban expiran

Los datos almacenados en el ledger de Soroban (storage entries) tienen un TTL (Time-To-Live) que se decrementa con cada ledger (~5 segundos). Si el TTL llega a 0, los datos se archivan y ya no son accesibles on-chain. Para un escrow que puede estar activo por horas o días (especialmente en disputas), esto es crítico.

### 10.2 Estrategia de TTL bumping

```typescript
// Configuración de TTL
const TTL_LEDGERS = {
  MIN_SAFE: 100_000,         // ~5.7 días — umbral de alerta
  BUMP_TO: 500_000,          // ~28.9 días — extender a este valor al bumpear
  CHECK_INTERVAL_MS: 300_000 // cada 5 minutos
};

async function bumpTradeDataTTL(stellarTradeId: string): Promise<void> {
  const contract = new Contract(ESCROW_CONTRACT_ID);

  const bumpOp = contract.call(
    'bump_trade_ttl',
    nativeToScVal(Buffer.from(stellarTradeId, 'hex'), { type: 'bytes' }),
    nativeToScVal(TTL_LEDGERS.BUMP_TO, { type: 'u32' })
  );

  // Esta es una tx admin — la plataforma la firma y paga
  const account = await rpc.getAccount(platformKeypair.publicKey());
  let tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(bumpOp)
    .setTimeout(60)
    .build();

  const simResult = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    console.error(`TTL bump failed for trade ${stellarTradeId}:`, simResult.error);
    return;
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(platformKeypair);
  await rpc.sendTransaction(preparedTx);
}
```

### 10.3 Job de monitoreo de TTLs

```typescript
// Queue: 'ttl-monitor'
// Corre cada 5 minutos — verifica TTLs de trades activos
async function monitorTradeTTLs() {
  const activeTrades = await db.query(`
    SELECT id, stellar_trade_id, soroban_ttl_expires_at
    FROM trades
    WHERE status IN ('locked', 'revealing', 'disputed')
    AND stellar_trade_id IS NOT NULL
  `);

  for (const trade of activeTrades.rows) {
    // Si el TTL estimado expira en menos de MIN_SAFE ledgers, bumpear
    const ttlExpiresAt = new Date(trade.soroban_ttl_expires_at);
    const safeThreshold = new Date(Date.now() + TTL_LEDGERS.MIN_SAFE * 5000); // ~5s por ledger

    if (ttlExpiresAt < safeThreshold) {
      try {
        await bumpTradeDataTTL(trade.stellar_trade_id);
        // Actualizar tracking en DB
        const newExpiry = new Date(Date.now() + TTL_LEDGERS.BUMP_TO * 5000);
        await db.execute(`
          UPDATE trades
          SET soroban_ttl_last_bumped = NOW(),
              soroban_ttl_expires_at = $2
          WHERE id = $1
        `, [trade.id, newExpiry]);
      } catch (err) {
        console.error(`Failed to bump TTL for trade ${trade.id}:`, err);
        // Reintentar en el próximo ciclo — BullMQ maneja retries
      }
    }
  }
}
```

> **Costo:** cada TTL bump es una transacción Soroban que consume gas (~0.01-0.05 XLM). Para trades normales (resueltos en <2h) no debería necesitarse. Es crítico para disputas que pueden durar días.

---

## 12. Sistema de Ubicación y Privacidad

### 16.1 Regla fundamental

**El servidor nunca almacena coordenadas exactas.** Recibe coordenadas ya borrosas del cliente y las almacena con precisión de 3 decimales.

### 16.2 El cliente ofusca antes de enviar

```typescript
// En el CLIENTE (React Native)
function getFuzzyLocation(coords: { latitude: number; longitude: number }) {
  return {
    lat: Math.round(coords.latitude * 1000) / 1000,   // ±~55m en latitud
    lng: Math.round(coords.longitude * 1000) / 1000,  // ±~90m en longitud en MX
  };
}
// Ejemplo: 19.432608, -99.133209 → 19.433, -99.133
```

### 16.3 Capa de abstracción geoespacial

Para facilitar la migración futura a PostGIS, todas las queries geoespaciales pasan por un servicio abstraído:

```typescript
// services/geo.ts — interfaz que se puede reemplazar sin tocar el resto del código

interface GeoService {
  findOffersNearby(lat: number, lng: number, radiusMeters: number, filters: OfferFilters): Promise<OfferWithDistance[]>;
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number;
}

// Implementación MVP: Haversine puro en SQL
class HaversineGeoService implements GeoService {
  async findOffersNearby(lat, lng, radiusMeters, filters) {
    // Ver query SQL en 11.4
  }
  calculateDistance(lat1, lng1, lat2, lng2) {
    return haversineDistance(lat1, lng1, lat2, lng2);
  }
}

// Implementación futura: PostGIS
// class PostGISGeoService implements GeoService { ... }

// Singleton — cambiar aquí para migrar
export const geoService: GeoService = new HaversineGeoService();
```

### 16.4 Query de ofertas cercanas (SQL — implementación Haversine)

```sql
-- Obtener ofertas en radio de X metros usando la fórmula Haversine directa
-- Más simple que PostGIS para el MVP, suficientemente preciso
SELECT
  o.*,
  u.username, u.reputation_score, u.reputation_level, u.trade_count,
  -- Distancia aproximada en metros
  6371000 * 2 * ASIN(SQRT(
    POWER(SIN((RADIANS(o.fuzzy_lat) - RADIANS($1)) / 2), 2) +
    COS(RADIANS($1)) * COS(RADIANS(o.fuzzy_lat)) *
    POWER(SIN((RADIANS(o.fuzzy_lng) - RADIANS($2)) / 2), 2)
  )) AS distance_meters
FROM offers o
JOIN users u ON o.user_id = u.id
WHERE
  o.status = 'active'
  AND o.expires_at > NOW()
  AND u.is_suspended = false
  -- Bounding box primero (usa el índice)
  AND o.fuzzy_lat BETWEEN $1 - ($3/111000.0) AND $1 + ($3/111000.0)
  AND o.fuzzy_lng BETWEEN $2 - ($3/111000.0/COS(RADIANS($1))) AND $2 + ($3/111000.0/COS(RADIANS($1)))
  -- Luego filtro por radio exacto
  AND 6371000 * 2 * ASIN(...) <= $3    -- $3 = radio en metros
  AND ($4 = 'all' OR o.type = $4)      -- $4 = tipo de oferta
ORDER BY distance_meters ASC
LIMIT 50;
-- $1=lat, $2=lng, $3=radio_metros, $4=tipo
```

### 16.5 Expiración de ubicaciones

```typescript
// Job que corre cada 5 minutos
async function expireStaleLocations() {
  await db.execute(`
    UPDATE users
    SET fuzzy_lat = NULL, fuzzy_lng = NULL, location_updated_at = NULL
    WHERE location_updated_at < NOW() - INTERVAL '30 minutes'
  `);

  // También expirar las ofertas cuyo usuario ya no está activo
  await db.execute(`
    UPDATE offers SET status = 'expired'
    WHERE status = 'active'
    AND (expires_at < NOW()
         OR user_id IN (
           SELECT id FROM users
           WHERE location_updated_at IS NULL OR location_updated_at < NOW() - INTERVAL '30 minutes'
         ))
  `);
}
```

### 16.6 Plan de migración a PostGIS

Cuando el volumen supere ~5,000 usuarios activos simultáneos, migrar a PostGIS:

1. Habilitar la extensión: `CREATE EXTENSION postgis;`
2. Agregar columna geometry: `ALTER TABLE offers ADD COLUMN geom geometry(Point, 4326);`
3. Crear índice espacial: `CREATE INDEX idx_offers_geom ON offers USING GIST(geom);`
4. Implementar `PostGISGeoService` con `ST_DWithin()` y `ST_DistanceSphere()`
5. Cambiar el singleton en `services/geo.ts`
6. La interfaz REST no cambia — el cambio es invisible para el cliente

---

## 13. Notificaciones Push

### 16.1 Eventos que generan push

| Evento | Destinatario | Mensaje |
|---|---|---|
| Nuevo match recibido | Vendedor | "alguien quiere intercambiar $1,500 contigo" |
| Match aceptado | Comprador | "vendedor_88 aceptó tu solicitud. Coordiná el encuentro." |
| Fondos bloqueados | Comprador | "Los fondos están asegurados. Ya podés ir al encuentro." |
| Vendedor confirmó recibir efectivo | Comprador | "El vendedor dice que recibió el efectivo. Escaneá el QR." |
| Trade completado | Vendedor | "Intercambio completado. Calificá a comprador_42." |
| Trade cancelado por timeout | Ambos | "El intercambio expiró. Los fondos fueron devueltos." |
| Disputa abierta | Ambos | "Se reportó un problema. El equipo de Micopay revisará." |
| Disputa resuelta | Ganador | "La disputa fue resuelta a tu favor." |
| Emergency refund ejecutado | Ambos | "El intercambio fue cerrado por timeout de seguridad." |

### 16.2 Implementación con Firebase FCM

```typescript
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

async function sendPush(userId: string, notification: {
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const devices = await db.query(
    `SELECT fcm_token FROM user_devices
     WHERE user_id = $1 AND is_active = true
     ORDER BY updated_at DESC LIMIT 3`,
    [userId]
  );

  if (devices.rows.length === 0) return;

  // Enviar a todos los dispositivos activos del usuario
  const messages = devices.rows.map(d => ({
    token: d.fcm_token,
    notification: { title: notification.title, body: notification.body },
    data: notification.data,
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  }));

  const results = await getMessaging().sendEach(messages);

  // Desactivar tokens inválidos
  results.responses.forEach((res, i) => {
    if (!res.success && res.error?.code === 'messaging/registration-token-not-registered') {
      db.execute(
        `UPDATE user_devices SET is_active = false WHERE fcm_token = $1`,
        [devices.rows[i].fcm_token]
      );
    }
  });
}
```

---

## 14. Chat Cifrado Efímero

El chat entre usuarios durante un trade existe solo mientras el trade esté activo. Al completarse o cancelarse, el historial se borra del servidor.

### 16.1 Implementación MVP — WebSocket con validación

```typescript
// Sala de chat = trade_id
// Solo el seller y el buyer del trade pueden unirse

const MAX_MESSAGE_LENGTH = 500;
const MAX_MESSAGES_PER_MINUTE = 30;
const messageCounters = new Map<string, { count: number; resetAt: number }>();

app.register(require('@fastify/websocket'));

app.get('/trades/:tradeId/chat', { websocket: true }, async (connection, req) => {
  const { tradeId } = req.params as { tradeId: string };
  const userId = req.user.id;  // del JWT

  // Verificar que el usuario es parte del trade
  let trade;
  try {
    trade = await db.getTrade(tradeId);
  } catch {
    connection.socket.close(1011, 'Internal error');
    return;
  }

  if (!trade || (trade.seller_id !== userId && trade.buyer_id !== userId)) {
    connection.socket.close(1008, 'Unauthorized');
    return;
  }

  // Verificar que el trade está en un estado que permite chat
  if (!['pending', 'locked', 'revealing', 'disputed'].includes(trade.status)) {
    connection.socket.close(1008, 'Trade not active');
    return;
  }

  // Unirse a la sala
  const room = chatRooms.get(tradeId) || new Set();
  room.add(connection.socket);
  chatRooms.set(tradeId, room);

  connection.socket.on('message', (rawMessage) => {
    // Rate limiting por usuario
    const key = `${tradeId}:${userId}`;
    const counter = messageCounters.get(key) || { count: 0, resetAt: Date.now() + 60000 };
    if (Date.now() > counter.resetAt) {
      counter.count = 0;
      counter.resetAt = Date.now() + 60000;
    }
    counter.count++;
    messageCounters.set(key, counter);

    if (counter.count > MAX_MESSAGES_PER_MINUTE) {
      connection.socket.send(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }

    // Parse seguro
    let message: { text?: string };
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      connection.socket.send(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    // Validar contenido
    if (!message.text || typeof message.text !== 'string') {
      connection.socket.send(JSON.stringify({ error: 'Missing text field' }));
      return;
    }

    const text = message.text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (text.length === 0) return;

    // Guardar en DB temporalmente (se borra al completar el trade)
    db.saveChatMessage({ trade_id: tradeId, sender_id: userId, text });

    // Broadcast a la sala (solo las 2 personas)
    const payload = JSON.stringify({ sender_id: userId, text, ts: Date.now() });
    room.forEach(ws => {
      if (ws !== connection.socket && ws.readyState === 1) {
        ws.send(payload);
      }
    });
  });

  connection.socket.on('close', () => {
    room.delete(connection.socket);
    if (room.size === 0) chatRooms.delete(tradeId);
    messageCounters.delete(`${tradeId}:${userId}`);
  });

  // Heartbeat — detectar conexiones zombies
  const pingInterval = setInterval(() => {
    if (connection.socket.readyState === 1) {
      connection.socket.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  connection.socket.on('close', () => clearInterval(pingInterval));
});

// Al completar o cancelar el trade, borrar el historial
async function deleteTradeChat(tradeId: string) {
  await db.execute('DELETE FROM chat_messages WHERE trade_id = $1', [tradeId]);
  const room = chatRooms.get(tradeId);
  if (room) {
    room.forEach(ws => ws.close(1000, 'Trade ended'));
    chatRooms.delete(tradeId);
  }
}
```

> **Nota sobre persistencia de salas:** `chatRooms` es un `Map` en memoria. Si el proceso se reinicia, las conexiones WebSocket se pierden y los clientes deben reconectar. Para el MVP esto es aceptable — los clientes implementan reconnect automático. En una versión futura, considerar Redis pub/sub para WebSocket rooms si se escala a múltiples instancias.

---

## 15. Jobs y Workers

Usando **BullMQ** sobre Redis para jobs asíncronos.

### 16.1 Jobs críticos

```typescript
// Queue: 'trade-timeouts'
// Verifica trades que expiraron y ejecuta el refund on-chain
async function processExpiredTrades() {
  const expired = await db.query(`
    SELECT id, stellar_trade_id, seller_id
    FROM trades
    WHERE status = 'locked'
    AND expires_at < NOW()
  `);

  for (const trade of expired.rows) {
    await stellarService.callRefund(trade.stellar_trade_id);
    await db.updateTradeStatus(trade.id, 'cancelled');
    await reputationService.recordNoShow(trade);
    await notifyBoth(trade.id, 'El intercambio expiró');
  }
}

// Queue: 'emergency-timeouts'
// Verifica trades que exceden el timeout absoluto de 72h
async function processEmergencyTimeouts() {
  const emergencies = await db.query(`
    SELECT id, stellar_trade_id, seller_id, buyer_id, status
    FROM trades
    WHERE status IN ('locked', 'revealing', 'disputed')
    AND absolute_timeout_at < NOW()
  `);

  for (const trade of emergencies.rows) {
    try {
      await stellarService.callEmergencyRefund(trade.stellar_trade_id);
      await db.updateTradeStatus(trade.id, 'refunded');
      await notifyBoth(trade.id, 'El intercambio fue cerrado por timeout de seguridad. Los fondos fueron devueltos al vendedor.');
      console.warn(`Emergency refund executed for trade ${trade.id} (was in ${trade.status})`);
    } catch (err) {
      console.error(`Emergency refund FAILED for trade ${trade.id}:`, err);
      // Alerta crítica — notificar a admins
      await notifyAdmins(`CRITICAL: Emergency refund failed for trade ${trade.id}`);
    }
  }
}

// Queue: 'reputation-sync'
// Sincroniza scores on-chain con la DB local para consistencia
async function syncReputationFromChain(userId: string) {
  const onChainScore = await stellarService.getReputationScore(userId);
  await db.updateReputationScore(userId, onChainScore);
  await checkAndUpdateLevel(userId, onChainScore);
}

// Queue: 'ttl-monitor'
// Corre cada 5 min — verifica y extiende TTLs de trades activos en Soroban
async function monitorTradeTTLs() { /* ver sección 10.3 */ }

// Queue: 'location-cleanup'
// Corre cada 5 min — expira ubicaciones viejas
async function cleanupLocations() { /* ver sección 11.5 */ }

// Queue: 'offer-expiry'
// Corre cada minuto — expira ofertas vencidas
async function expireOffers() {
  await db.execute(`
    UPDATE offers SET status = 'expired'
    WHERE status = 'active' AND expires_at < NOW()
  `);
}
```

---

## 16. Seguridad

### 16.1 Rate limiting por endpoint

```typescript
app.register(require('@fastify/rate-limit'), {
  global: false,
});

// Endpoints sensibles con límites estrictos
app.get('/trades/:id/secret', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
});

app.post('/auth/token', {
  config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }
});

app.post('/trades', {
  config: { rateLimit: { max: 20, timeWindow: '1 hour' } }
});

// Relay de transacciones — limitado para evitar uso como proxy
app.post('/stellar/submit', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
});

// Registro de dispositivos
app.post('/users/me/devices', {
  config: { rateLimit: { max: 5, timeWindow: '1 hour' } }
});
```

### 16.2 Validaciones críticas de seguridad

```typescript
// GET /trades/:id/secret
// Verificar TODOS estos antes de devolver el secreto:

async function validateSecretAccess(tradeId: string, requestUserId: string) {
  const trade = await db.getTrade(tradeId);

  if (!trade) throw new NotFoundError();

  // Solo el vendedor puede ver el secreto
  if (trade.seller_id !== requestUserId) {
    throw new ForbiddenError('Solo el vendedor puede acceder al secreto');
  }

  // Solo en estado revealing
  if (trade.status !== 'revealing') {
    throw new ConflictError(`Trade en estado ${trade.status}, no en revealing`);
  }

  // No expirado
  if (new Date(trade.expires_at) < new Date()) {
    throw new GoneError('El trade ya expiró');
  }

  // No pasado el timeout absoluto
  if (trade.absolute_timeout_at && new Date(trade.absolute_timeout_at) < new Date()) {
    throw new GoneError('El trade excedió el timeout de seguridad');
  }

  return trade;
}
```

### 16.3 Logging de accesos al secreto

```typescript
async function logSecretAccess(tradeId: string, userId: string, req: FastifyRequest) {
  await db.execute(`
    INSERT INTO secret_access_log (trade_id, user_id, ip_address, user_agent, accessed_at)
    VALUES ($1, $2, $3, $4, NOW())
  `, [tradeId, userId, req.ip, req.headers['user-agent'] || 'unknown']);
}
```

### 16.4 Headers de seguridad

```typescript
app.register(require('@fastify/helmet'));
// Configura: HSTS, X-Frame-Options, CSP, etc.
// El API no sirve HTML pero los headers protegen igualmente
```

### 16.5 Validación de input global

```typescript
// Todas las rutas usan JSON Schema para validar input
// Ejemplo para POST /trades
const createTradeSchema = {
  body: {
    type: 'object',
    required: ['offer_id', 'amount_mxn'],
    properties: {
      offer_id: { type: 'string', format: 'uuid' },
      amount_mxn: { type: 'integer', minimum: 100, maximum: 50000 },
    },
    additionalProperties: false,
  },
};
```

---

## 17. Variables de Entorno

```bash
# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/micopay

# Redis
REDIS_URL=redis://default:pass@host:6379

# Stellar
STELLAR_RPC_URL=https://soroban-mainnet.stellar.org
STELLAR_NETWORK=PUBLIC                          # o TESTNET en desarrollo
PLATFORM_SECRET_KEY=S...                        # keypair de la plataforma (admin ops + funding)
ESCROW_CONTRACT_ID=C...                         # address del contrato EscrowFactory
REPUTATION_CONTRACT_ID=C...                     # address del ReputationRegistry
NFT_CONTRACT_ID=C...                            # address del MicopayNFT
MXNE_CONTRACT_ID=C...                           # address del SAC de MXNe
MXNE_ISSUER_ADDRESS=G...                        # issuer del asset MXNe (Stellar Classic)
USDC_ISSUER_ADDRESS=G...                        # issuer de USDC en Stellar

# Cifrado del secreto HTLC
SECRET_ENCRYPTION_KEY=hex_64_chars             # openssl rand -hex 32

# JWT
JWT_SECRET=random_string_muy_largo
JWT_EXPIRY=24h

# Firebase FCM
FIREBASE_PROJECT_ID=micopay-xxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...

# Anti-Sybil
DAILY_FUNDING_LIMIT=50                         # máximo de cuentas fondeadas por día
ACCOUNT_FUNDING_XLM=3                          # XLM por cuenta nueva

# SPEI Anchors
ETHERFUSE_API_URL=https://api.etherfuse.com       # Etherfuse anchor API (CETES on Stellar)
ETHERFUSE_API_KEY=ef_...                           # API key (sandbox para dev, prod requiere KYB)
ALFREDPAY_API_URL=https://api.alfredpay.io         # AlfredPay anchor API (USDC on Stellar)
ALFREDPAY_API_KEY=ap_...                           # API key

# Blend Capital (v2)
BLEND_POOL_MXNE_ID=C...                        # contract address del pool MXNe en Blend
BLEND_POOL_USDC_ID=C...                        # contract address del pool USDC en Blend

# App
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.micopay.mx
```

> **Jamás versionar estas variables.** Usar un secrets manager (Railway Secrets, Doppler, AWS Secrets Manager) en producción.

---

## 18. Blend Capital — DeFi Voluntario (v2)

**Estado: planificado para v2. No incluido en v1.**

> **⚠️ Corrección v1.4:** Blend Capital **no** se integra como yield automático sobre fondos bloqueados en escrow. Esa arquitectura era incorrecta: añade riesgo de composabilidad al HTLC, el yield en 30-120 min es negligible, y el usuario nunca consintió poner sus fondos en un protocolo DeFi durante un trade P2P. La integración correcta es **DeFi voluntario** — el usuario accede desde la pantalla **Explorar** y elige qué hacer con sus activos idle.

### 18.1 Concepto

Blend Capital es un protocolo de lending nativo en Soroban. Micopay lo integra como una funcionalidad opcional en la pantalla **Explorar** — no tiene ningún acoplamiento con el flujo de escrow P2P. El usuario decide de forma explícita:

- **Préstamo colateralizado:** depositar XLM como colateral → recibir USDC o MXNe prestado sin vender sus activos
- **Yield sobre activos idle:** depositar MXNe/USDC en un lending pool → ganar APY mientras no los usa

El contrato EscrowFactory **no cambia** — sigue siendo el mismo HTLC simple. Blend es una capa separada completamente.

### 18.2 Flujo A — Préstamo colateralizado ("Pide un préstamo hoy")

```
Usuario tiene 1,000 XLM en su wallet Micopay
    ↓
Explorar → "Pide un préstamo hoy"
    ↓
App consulta Blend: "Con 1,000 XLM (~$20,000 MXN) puedes pedir hasta $15,000 MXN (LTV 75%)"
    ↓
Usuario ingresa monto → "Pedir $5,000 MXN"
    ↓
Backend construye 2 txs Soroban:
  1. supply(XLM, 1000) → Blend pool · recibe bXLM tokens (colateral)
  2. borrow(MXNe, 5000) → MXNe a la wallet del usuario
    ↓
Usuario firma con biometrics (una sola tx empaquetada)
    ↓
MXNe disponible · XLM bloqueado como colateral en Blend
    ↓
Para recuperar XLM: repagar MXNe + interés (~8% anual)
```

### 18.3 Flujo B — Yield sobre activos idle

```
Usuario tiene 2,000 MXNe que no va a usar pronto
    ↓
Explorar → sección de ahorro con Blend
    ↓
App muestra: "Depositar 2,000 MXNe → ganar ~8% APY ($160 MXN/año)"
    ↓
Usuario confirma → Backend construye tx: supply(MXNe, 2000)
    ↓
Usuario firma → recibe bMXNe tokens (receipt del depósito)
    ↓
Home muestra bMXNe como activo con rendimiento acumulado en tiempo real
    ↓
Retirar: redimir bMXNe → MXNe + yield
```

### 18.4 Endpoints del backend (v2)

```
GET    /savings/blend/rates           → tasas actuales (APY de supply, costo de borrow) por asset
GET    /loans/estimate                → cuánto puedo pedir dado mi balance de XLM/MXNe/USDC
POST   /loans/borrow                  → construir txs de supply + borrow (XDR sin firmar)
POST   /loans/repay                   → construir tx de repago (XDR sin firmar)
POST   /savings/blend/deposit         → construir tx de supply para yield (XDR sin firmar)
POST   /savings/blend/withdraw        → construir tx de redención de bTokens (XDR sin firmar)
GET    /savings/blend/positions       → posiciones activas del usuario en Blend
```

> El backend nunca firma — devuelve el XDR para que el cliente firme con biometrics. Principio de diseño: sección 2.1.

### 18.5 DB: tabla `savings_positions` (provider = 'blend')

Ver sección 3.12. Los campos relevantes para Blend:
- `blend_pool_id`: contract address del pool
- `btoken_amount`: cantidad de bTokens recibidos
- `estimated_apy`: APY estimado al momento del depósito
- `accrued_yield`: yield acumulado (actualizado por job periódico)

### 18.6 Prerequisitos

| Prerequisito | Estado |
|---|---|
| Blend pools activos para MXNe/USDC en mainnet | Por verificar con Blend Capital |
| `@blend-capital/blend-sdk` instalado | Pendiente (v2) |
| Consulta de LTV y APY desde el SDK | Pendiente |

**Nota de diseño:** en el futuro, si el usuario quiere, puede opcionalmente activar "yield automático" sobre sus activos idle en la wallet (no durante el escrow). Esto requeriría que el usuario autorice explícitamente que sus fondos se depositen en Blend cuando no están en un trade activo. Es un feature opt-in consciente, nunca implícito.

---

## 19. Etherfuse — CETES Tokenizados (v2)

**Estado: planificado para v2. Integración técnicamente viable hoy.**

> **⚠️ Corrección v1.4 (reescritura completa):** El flujo principal para invertir en CETES **no es SPEI**. Los CETES son assets nativos de Stellar emitidos por Etherfuse, listados en el DEX de Stellar. Un usuario que ya tiene XLM, USDC o MXNe en su wallet Micopay puede comprar CETES con un **path payment directo** — sin KYC adicional, sin transferencia bancaria, sin esperas. El flujo SPEI existe como opción secundaria únicamente para usuarios que vienen desde fiat y no tienen cripto (ver sección 10.3, Card "Conecta tu Banco").

### 19.1 Concepto

CETES tokenizados son bonos del gobierno mexicano emitidos como assets Stellar Classic por Etherfuse. Generan ~11% de rendimiento anual. El usuario los mantiene en su wallet self-custodial — Micopay nunca los custodia.

Hay dos formas de adquirirlos:
1. **Flujo primario (DEX swap):** el usuario ya tiene cripto → swap directo en el DEX de Stellar → CETES en segundos, sin KYC, sin banco
2. **Flujo secundario (SPEI on-ramp):** el usuario viene desde fiat → transfiere MXN vía SPEI → Etherfuse entrega CETES → requiere KYC de Etherfuse

### 19.2 Flujo primario — DEX Swap (sin KYC, sin SPEI)

Este es el flujo para el usuario típico de Micopay que ya tiene activos en su wallet.

```
Usuario tiene XLM / USDC / MXNe en su wallet
    ↓
Explorar → "Haz crecer tus ahorros" (Card Etherfuse CETES)
    ↓
Ingresa monto: "Quiero invertir 500 XLM"
    ↓
App consulta Stellar DEX (Horizon order book):
  "500 XLM → 198.4 CETES (~$19,840 MXN · rendimiento $2,271/año al 11.45%)"
    ↓
Usuario acepta · Backend construye pathPaymentStrictReceive:
  send_asset: XLM
  send_max: 505 XLM (slippage 1%)
  dest_asset: CETES (issuer: Etherfuse)
  dest_amount: 198.4
    ↓
Usuario firma con biometrics
    ↓
CETES en wallet · tx confirmada en ~5 segundos
    ↓
Home screen muestra CETES como activo con tasa y rendimiento acumulado
```

Para vender (CETES → XLM/USDC/MXNe):
```
Explorar → posición CETES activa → "Vender"
    ↓
pathPaymentStrictReceive en sentido inverso: CETES → XLM
    ↓
Fondos disponibles en segundos · no requiere banco ni CLABE
```

> **Nota:** vender CETES en el DEX implica encontrar contrapartes que quieran comprarlos. Si la liquidez del DEX es insuficiente, el off-ramp vía Etherfuse (burn + SPEI) es la alternativa.

### 19.3 Flujo secundario — SPEI (solo para usuarios fiat sin cripto)

Este flujo corresponde a la Card "Conecta tu Banco" en la pantalla Explorar (sección 10.3), no a la Card de CETES. Se usa cuando el usuario no tiene activos en su wallet y quiere entrar desde su banco.

```
Compra (MXN → CETES vía SPEI):
1. Usuario selecciona "Conecta tu Banco"
2. Backend crea customer en Etherfuse (KYC vía iframe — una sola vez)
3. Solicita quote MXN → CETES
4. Genera instrucciones SPEI (CLABE, referencia, monto)
5. Usuario transfiere desde su banco (BBVA, Banamex, etc.)
6. Etherfuse entrega CETES tokens a la wallet Stellar del usuario (~minutos)

Venta (CETES → MXN vía SPEI — si DEX sin liquidez):
1. Solicita quote CETES → MXN
2. Crea orden de off-ramp en Etherfuse
3. Polling hasta que Etherfuse genere el XDR de burn transaction
4. Cliente firma el XDR con biometrics
5. Etherfuse envía MXN al banco del usuario vía SPEI
```

### 19.4 Integración técnica — DEX swap (flujo primario)

```typescript
import * as StellarSdk from '@stellar/stellar-sdk';

const CETES_ASSET = new StellarSdk.Asset(
  'CETES',
  process.env.ETHERFUSE_ISSUER!  // issuer address de Etherfuse en mainnet
);

// GET /savings/cetes/quote
async function getCetesQuote(sellAsset: string, sellAmount: string) {
  const horizon = new StellarSdk.Horizon.Server(process.env.HORIZON_URL!);

  // Consultar order book CETES/XLM en el DEX
  const orderBook = await horizon.orderbook(
    sellAsset === 'XLM' ? StellarSdk.Asset.native() : new StellarSdk.Asset(sellAsset, process.env[`${sellAsset}_ISSUER`]!),
    CETES_ASSET
  ).call();

  const bestAsk = parseFloat(orderBook.asks[0]?.price ?? '0');
  const cetesAmount = bestAsk > 0 ? parseFloat(sellAmount) / bestAsk : 0;
  const mxnValue = cetesAmount * 100; // 1 CETES = ~$100 MXN (valor nominal)
  const annualYield = mxnValue * 0.1145;

  return { cetesAmount, mxnValue, annualYield, rate: bestAsk };
}

// POST /savings/cetes/buy → devuelve XDR sin firmar
async function buildCetesBuyTx(userAddress: string, sellAsset: string, sellAmount: string, cetesAmount: string) {
  const horizon = new StellarSdk.Horizon.Server(process.env.HORIZON_URL!);
  const account = await horizon.loadAccount(userAddress);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.PUBLIC,
  })
    .addOperation(StellarSdk.Operation.pathPaymentStrictReceive({
      sendAsset: sellAsset === 'XLM' ? StellarSdk.Asset.native() : new StellarSdk.Asset(sellAsset, process.env[`${sellAsset}_ISSUER`]!),
      sendMax: (parseFloat(sellAmount) * 1.01).toFixed(7), // 1% slippage
      destination: userAddress,                             // el mismo usuario
      destAsset: CETES_ASSET,
      destAmount: cetesAmount,
      path: [],                                             // DEX encuentra la ruta
    }))
    .setTimeout(180)
    .build();

  return tx.toXDR();
}
```

### 19.5 Endpoints del backend

```
GET    /savings/cetes/quote         → cotización DEX: X XLM/USDC/MXNe → Y CETES (+ rendimiento proyectado)
GET    /savings/cetes/rates         → tasa CETES actual (Banxico API) y liquidez del DEX
POST   /savings/cetes/buy           → construir pathPayment XLM/USDC/MXNe → CETES (XDR sin firmar)
POST   /savings/cetes/sell          → construir pathPayment CETES → XLM/USDC/MXNe (XDR sin firmar)
GET    /savings/cetes/positions     → saldo CETES del usuario + rendimiento acumulado estimado

# Flujo SPEI (secundario — Card "Conecta tu Banco")
POST   /payments/spei/cetes/deposit → iniciar on-ramp MXN → CETES vía Etherfuse anchor
POST   /payments/spei/cetes/withdraw → iniciar off-ramp CETES → MXN vía burn tx
```

### 19.6 DB: tabla `savings_positions` (provider = 'etherfuse')

Para el flujo DEX, el saldo CETES se lee directamente de la blockchain (no necesita DB). La tabla `savings_positions` aplica principalmente al flujo SPEI donde hay un order ID en Etherfuse que rastrear:
- `etherfuse_bond_id`: ID de la orden en Etherfuse (solo flujo SPEI)
- `cetes_rate`: tasa CETES al momento de la compra (de Banxico API)
- `maturity_date`: fecha de vencimiento (solo aplica a bonos SPEI, no a tokens DEX)

Para el flujo DEX, el balance CETES se muestra en Home leyendo directamente el balance del asset en la wallet Stellar del usuario.

### 19.7 Por qué v2 y no v1

1. **Verificar liquidez del DEX:** necesitamos confirmar que hay suficiente liquidez en el order book CETES/XLM y CETES/USDC en mainnet para que el swap sea fluido.
2. **Issuer address de Etherfuse:** confirmar el asset code y issuer en mainnet antes de hardcodear.
3. **Trustline:** el usuario necesita agregar la trustline de CETES antes del primer swap — el backend construye esta tx como parte del onboarding de la feature.
4. **Scope:** v1 se enfoca en el HTLC escrow + wallet básica. CETES es un feature de retención de usuarios.

**Para v2:** confirmar issuer de Etherfuse, verificar liquidez DEX, agregar trustline en el flujo de onboarding de CETES, implementar los endpoints de quote y swap.

---

## 20. Glosario Técnico

| Término | Definición |
|---|---|
| **HTLC** | Hash Time-Locked Contract. El escrow se libera presentando el preimage de un hash, o se reembolsa tras un timeout. |
| **Preimage / Secret** | El número aleatorio de 32 bytes cuyo SHA256 está en el contrato. Quien lo presenta libera los fondos. |
| **Secret hash** | SHA256(secret). Almacenado en el contrato Soroban. Público desde la creación del trade. |
| **XDR** | External Data Representation. El formato binario de las transacciones Stellar. Se serializa en base64 para transmisión. |
| **Stroops** | La unidad mínima de un asset Stellar. 1 MXNe = 10,000,000 stroops (7 decimales). |
| **Soroban** | La plataforma de smart contracts de Stellar. Los contratos se escriben en Rust y compilan a WASM. |
| **Footprint** | El conjunto de entradas del ledger que una transacción Soroban va a leer/escribir. Se calcula al simular la tx. |
| **SAC** | Soroban Asset Contract. Wrapper que permite que un asset Stellar Classic (MXNe, USDC) sea usado desde contratos Soroban. |
| **SEP-10** | Stellar Ecosystem Proposal 10. Estándar para autenticar que alguien controla una dirección Stellar. |
| **SEP-7** | URI scheme para solicitar firma de transacciones a wallets externas (Freighter, Lobstr). |
| **SEP-24** | Estándar para depósitos y retiros interactivos de fiat. El anchor tiene su propia UI web (KYC, confirmación). Usado para SPEI on/off ramp. |
| **Anchor** | Entidad que conecta Stellar con el sistema financiero tradicional. Emite y redime assets tokenizados (e.g. MXNe). Maneja KYC, compliance y settlement fiat. |
| **Path payment** | Tipo de transacción Stellar que convierte automáticamente entre assets usando el DEX. El emisor envía en asset A, el receptor recibe en asset B, Stellar encuentra la mejor ruta. |
| **Stellar DEX** | Order book descentralizado nativo de Stellar. Permite intercambiar cualquier par de assets sin intermediario. Los path payments lo usan automáticamente. |
| **Stablebond** | Bono gubernamental tokenizado (e.g. CETES mexicanos tokenizados por Etherfuse). Emitidos como assets Stellar Classic nativos. El usuario los adquiere vía swap en el DEX de Stellar (flujo primario) o vía SPEI on-ramp (flujo secundario para usuarios fiat). |
| **bToken** | Receipt token de Blend Capital. Representa un depósito voluntario en un lending pool. Se redime por el principal + yield acumulado. No tiene relación con fondos en escrow HTLC. |
| **Self-custodial wallet** | Wallet donde la clave privada la controla exclusivamente el usuario en su dispositivo. El servidor no tiene acceso a ella. También llamada "non-custodial wallet". |
| **Custodial wallet** | Wallet donde un tercero (empresa, exchange) controla la clave privada del usuario. Micopay NO usa este modelo — todas las wallets son self-custodial. |
| **Trustline** | Autorización explícita en Stellar para que una cuenta pueda mantener un asset específico. Sin trustline, la cuenta no puede recibir el asset. |
| **Base reserve** | Mínimo de XLM que una cuenta Stellar debe mantener para existir en la red (~1 XLM base + 0.5 XLM por trustline). |
| **BullMQ** | Librería de colas de jobs sobre Redis. Maneja retries, scheduling y concurrencia. |
| **GCM** | Galois/Counter Mode. Modo de cifrado AES que incluye autenticación del mensaje (integridad). |
| **Fuzzy location** | Ubicación con precisión reducida intencionalmente para proteger la privacidad del usuario. |
| **TTL (Soroban)** | Time-To-Live. Los datos en el ledger Soroban expiran si no se renuevan periódicamente. Crítico para escrows de larga duración. |
| **Sybil attack** | Ataque donde un actor malicioso crea múltiples identidades falsas para explotar un sistema (en nuestro caso, drenar el fondo de XLM para cuentas nuevas). |
| **Emergency refund** | Mecanismo de seguridad con timeout absoluto (72h) que fuerza la devolución de fondos al vendedor si un trade queda atrapado en cualquier estado activo. |
| **Regional Starter Pack** | Toolkit de SDF con librería TypeScript portable para integrar anchors en Stellar. Incluye clientes para Etherfuse, AlfredPay, y BlindPay, e implementaciones de SEP-1, 6, 10, 12, 24, 31 y 38. Repo: `github.com/ElliotFriend/regional-starter-pack`. |
| **CETES** | Certificados de la Tesorería de la Federación. Instrumentos de deuda a corto plazo del gobierno mexicano. Etherfuse los tokeniza como assets nativos en Stellar. |

---

*Micopay Backend Spec v1.4 — Abril 2026*
