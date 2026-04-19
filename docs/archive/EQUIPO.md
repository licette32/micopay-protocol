# MicoPay — Documento de Visión para el Equipo

> Versión de discusión interna · Hackathon 2026

---

## El problema que resolvemos

Más del 60% de la población en México opera en la economía informal. No tienen cuenta bancaria. No pueden usar crypto directamente. El efectivo sigue siendo el rey.

Al mismo tiempo, los agentes de IA están empezando a actuar de forma autónoma en nombre de personas: compran, reservan, pagan. Pero cuando su usuario necesita efectivo físico en México, no hay ninguna API en el mundo que pueda resolver eso.

**MicoPay es el puente entre esos dos mundos.**

---

## Lo que construimos

No es una app. No es una API. Es un **protocolo de dos lados**:

```
Un lado:    Red de comercios físicos (farmacias, tiendas)
            dispuestos a intercambiar efectivo por USDC

El otro:    Agentes IA, desarrolladores, y apps
            que necesitan dar acceso a ese efectivo a sus usuarios

MicoPay:    El puente trustless entre los dos
```

---

## Los dos productos

### Producto 1 — App móvil (la red)

**Para quién:** Persona en México sin cuenta bancaria. Comercio físico que quiere atraer clientes.

**Qué hace:**
- Usuario busca farmacia disponible en el mapa
- Coordinan por chat encriptado
- QR revela el secreto del HTLC
- Farmacia da efectivo, USDC se libera on-chain
- Sin banco. Sin intermediario. Sin confianza ciega.

**Quién paga:** La farmacia paga una comisión del 1% por trade. Accede a clientes que de otra forma no tendría.

**Lo importante:** Esta red de comercios es el activo único de MicoPay. Nadie más la tiene. Ninguna AMM, ningún exchange puede darte billetes físicos en Colonia Roma.

---

### Producto 2 — API x402 (el acceso para máquinas)

**Para quién:** Desarrollador que construye un asistente IA. Empresa que quiere dar a sus usuarios acceso a efectivo en México. Cualquier agente autónomo que opere en nombre de una persona.

**Qué hace:** Expone la red de comercios y su reputación on-chain como endpoints HTTP que cualquier agente puede llamar, pagando por cada request con USDC en Stellar. Sin registro. Sin API keys. **El pago es la autenticación.**

**Los servicios que tienen valor real:**

| Servicio | Endpoint | Precio | Por qué tiene valor |
|---|---|---|---|
| Buscar comercio | `GET /api/v1/cash/agents` | $0.001 USDC | Acceso a la red física — no existe en ningún otro lugar |
| Verificar reputación | `GET /api/v1/reputation/:address` | $0.0005 USDC | Confianza on-chain acumulada — no se puede falsificar |
| Iniciar intercambio | `POST /api/v1/cash/request` | $0.01 USDC | USDC → MXN físico via HTLC — imposible sin la red |
| Fondear MicoPay | `POST /api/v1/fund` | $0.10 USDC | Meta-demo: el protocolo se financia a sí mismo |

**Lo que eliminamos y por qué:**
- `swap_search`, `swap_plan`, `swap_execute`, `swap_status` — Un swap USDC/XLM ya existe en el Stellar DEX, en Uniswap, en cualquier exchange. No tiene sentido que un agente IA le pague a MicoPay por algo que puede conseguir gratis en otro lugar. Quitarlos hace la propuesta más honesta y más fuerte.

---

## El flujo completo — cómo se ve en producción

```
Usuario le dice a su asistente IA:
"Necesito $500 pesos en efectivo en la Roma"

─────────────────────────────────────────────────

Agente llama  GET /api/v1/cash/agents?lat=19.42&lng=-99.16&amount=500
              paga $0.001 USDC con x402
              recibe lista de comercios disponibles cerca

Agente llama  GET /api/v1/reputation/GFARMACIA...
              paga $0.0005 USDC
              verifica: 312 trades, 98% completion, tier Maestro
              → decide confiar en Farmacia Guadalupe

Agente llama  POST /api/v1/cash/request
              paga $0.01 USDC
              HTLC bloquea ~$28 USDC (equivalente a $500 MXN)
              Farmacia Guadalupe recibe notificación en su app

Agente responde al usuario:
"Ve a Farmacia Guadalupe, Orizaba 45.
 Muestra este QR cuando llegues."

─────────────────────────────────────────────────

Usuario llega → farmacia entrega efectivo → escanea QR
Secreto revelado → USDC liberado a la farmacia on-chain

─────────────────────────────────────────────────

Agente llama  POST /api/v1/fund
              paga $0.10 USDC
              fondea el proyecto que hizo posible todo esto
```

**Total pagado por el agente: ~$0.11 USDC**
**Usuario recibió: $500 MXN en efectivo físico**
**Farmacia cobró: USDC directo a su billetera Stellar**

---

## Por qué la reputación tiene sentido aquí

Importante: **la reputación es solo para las farmacias, no para los usuarios.**

Las farmacias no son anónimas. Son negocios físicos con dirección, con cara, con algo que perder. Se registraron en MicoPay voluntariamente. Cada trade completado se registra on-chain. El NFT soulbound garantiza que esa reputación no se puede vender ni transferir — es auténtica.

El usuario no necesita reputación porque **el HTLC ya protege a la farmacia**. El USDC está bloqueado en el contrato antes de que la farmacia entregue un solo billete. Si el usuario no aparece, la farmacia no pierde nada — el timeout devuelve el USDC. La criptografía reemplaza la confianza en el usuario.

```
Farmacia Guadalupe — tier Maestro 🍄
completion_rate: 0.98
trades completados: 312
avg_time: 4 minutos
→ El agente manda al usuario sin dudarlo

Tienda sin nombre — tier Espora
completion_rate: 0.71
trades completados: 8
→ El agente busca otra opción
```

El agente hace esto en milisegundos, automáticamente, cada vez. Un humano lo ignoraría. El agente nunca lo olvida.

---

## Por qué fund_micopay es el cierre perfecto

Al final del flujo, el agente usa el mismo mecanismo x402 para fondear el proyecto que acaba de usar. No es un truco — es la demostración de que el protocolo es autofinanciable.

El argumento para el jurado: *"El protocolo se paga a sí mismo con su propio mecanismo."*

---

## El rol de los contratos Soroban

Tenemos dos contratos construidos con 32 tests pasando:

**MicopayEscrow** — el corazón de cada trade hoy. Cada vez que una farmacia intercambia efectivo por USDC ya está ejecutando un HTLC. El contrato garantiza que nadie puede robar: ni la farmacia ni el usuario.

**AtomicSwapHTLC** — ver sección "Visión multicadena" más abajo.

---

## Visión multicadena — el futuro del AtomicSwapHTLC

> Esta sección documenta una capacidad futura. El contrato AtomicSwapHTLC está construido
> y con tests pasando, pero la integración con otras cadenas es roadmap post-hackathon.

### El problema que resuelve

Hoy, para usar MicoPay necesitas tener USDC en Stellar. Eso excluye a:
- Quien tiene ETH en Ethereum
- Quien tiene BTC en Lightning
- Quien tiene SOL en Solana
- Quien tiene cualquier crypto en cualquier otra cadena

Los bridges existentes tienen dos problemas graves: son custodiados (tú confías en ellos) o tienen historial de hacks multimillonarios (LayerZero, Ronin, Wormhole — más de $2B robados en total). No son una opción para un protocolo que se construye sobre trustlessness.

### Cómo lo resuelve el AtomicSwapHTLC

Un HTLC (Hash Time-Lock Contract) es una primitiva criptográfica que permite intercambios atómicos entre cadenas sin custodian y sin confianza. El mismo secreto que desbloquea los fondos en una cadena desbloquea los fondos en la otra. O ambos reciben, o ninguno pierde.

```
Alguien tiene ETH en Ethereum, quiere $500 MXN en efectivo:

ETH en Ethereum
      ↓  AtomicSwapHTLC (mismo secreto hash en ambas cadenas)
USDC en Stellar
      ↓  MicopayEscrow (HTLC de la red P2P)
Efectivo físico en México
```

### Por qué esto es diferente a un bridge

| Bridge convencional | AtomicSwapHTLC MicoPay |
|---|---|
| Custodia tus fondos durante el proceso | Nunca custodia nada |
| Si hackean el bridge, pierdes todo | Si falla, el timeout devuelve ambos lados |
| Requiere liquidez en el protocolo | La liquidez son los propios comercios |
| Sirve para mover crypto entre cadenas | Sirve para convertir cualquier crypto en efectivo físico |

No lo vendemos como "swaps cross-chain". Lo vendemos como: **"Convierte cualquier crypto a efectivo en México, desde cualquier cadena, sin confiar en nadie."** El mecanismo es invisible para el usuario.

### El flujo completo con multicadena activo

```
Agente IA recibe instrucción:
"Mi usuario tiene 0.05 ETH en Ethereum y necesita $500 MXN en Monterrey"

Agente calcula: 0.05 ETH ≈ $130 USD ≈ $28 USDC necesarios para $500 MXN

Agente inicia AtomicSwapHTLC:
  → Bloquea 0.022 ETH en Ethereum con hash H
  → Contraparty bloquea 28 USDC en Stellar con el mismo hash H

Agente inicia MicopayEscrow con los 28 USDC:
  → HTLC bloquea USDC para Farmacia Guadalupe
  → Farmacia recibe notificación

Usuario llega → farmacia entrega $500 MXN → escanea QR
  → Secreto S revela hash H
  → USDC liberado a la farmacia en Stellar
  → Contraparty revela S en Ethereum, recibe 0.022 ETH

Todo atómico. Sin banco. Sin bridge. Sin custodian.
```

### Por qué esto importa para los agentes IA específicamente

Un agente IA que opera en nombre de un usuario no debería necesitar saber en qué cadena tiene sus fondos ese usuario. Debería poder resolver: *"mi usuario necesita efectivo"* sin importar si tiene ETH, BTC, SOL o XLM.

El AtomicSwapHTLC convierte a MicoPay en el **destino final para cualquier crypto que quiera convertirse en efectivo en México**. No importa de dónde venga. El agente maneja la complejidad. El usuario solo recibe los billetes.

### Cronograma realista

- **Hoy (hackathon):** Contrato construido, tests pasando, arquitectura definida
- **Post-hackathon (1-3 meses):** Integración con contraparties en Ethereum, interface de agente para iniciar swaps multicadena
- **Mediano plazo (6-12 meses):** Bitcoin Lightning, Solana, integración nativa en la app móvil
- **Largo plazo:** Cualquier token ERC-20 → efectivo físico → en cualquier país de LATAM donde MicoPay tenga red de comercios

---

## Por qué esto no lo puede hacer nadie más

| Necesidad | Solución existente | MicoPay |
|---|---|---|
| Swap USDC/XLM | Stellar DEX, Uniswap | ❌ No agrega valor, ya existe — no lo ofrecemos |
| Efectivo físico en México via API | No existe | ✅ Solo MicoPay |
| Acceso programático a esa red | No existe | ✅ x402 endpoints |
| Verificar confianza del comercio | No existe | ✅ Reputación on-chain NFT soulbound |
| Entrada desde otras cadenas sin custodian | Bridges con historial de hackeos | ✅ HTLC trustless (roadmap) |

El moat de MicoPay no es la tecnología. Es la red de comercios. Cuantos más comercios, más valiosa es la API. Cuanto más usada la API, más volumen tienen los comercios.

---

## Estado actual — qué está construido y qué no

### App móvil (`micopay/`) — construido
- [x] Mapa de agentes disponibles
- [x] Chat encriptado P2P
- [x] QR reveal del secreto HTLC
- [x] Historial de trades con links on-chain
- [x] CETES tokenizados (Etherfuse) — ahorro para usuarios
- [x] Blend Capital — préstamos DeFi

### API x402 (`apps/`) — construido
- [x] Middleware x402 — payment IS authentication
- [x] `POST /api/v1/fund` — fondear el proyecto
- [x] `GET /api/v1/services` — catálogo de servicios
- [x] `GET /skill.md` — descubrimiento para agentes
- [x] Contratos Soroban (HTLC + Escrow) — 32 tests pasando

### Lo que el flujo del demo asume pero aún no existe
- [ ] `GET /api/v1/cash/agents` — buscar comercios por geolocalización
- [ ] `GET /api/v1/reputation/:address` — reputación de farmacias via x402
- [ ] `POST /api/v1/cash/request` — iniciar intercambio USDC → MXN físico desde la API
- [ ] Conexión entre el backend de MicoPay P2P y la API x402

Esto es importante reconocerlo internamente. El flujo completo es la visión, no el estado actual.

---

## Lo que falta para producción

### Corto plazo (inmediato post-hackathon)
- Implementar `GET /api/v1/cash/agents` con datos reales del backend P2P
- Implementar `GET /api/v1/reputation/:address` usando trades on-chain
- Implementar `POST /api/v1/cash/request` conectando API x402 con MicopayEscrow
- Notificaciones push a la app de la farmacia cuando llega solicitud de un agente

### Mediano plazo
- Bots open source para comercios — el cajero humano solo entrega el efectivo, el bot coordina todo lo demás
- Capital idle de las farmacias entre trades generando yield en Blend/CETES automáticamente
- Expandir la red de comercios fuera de CDMX

### Largo plazo
- AtomicSwapHTLC activo — entrada desde Ethereum, Bitcoin, Solana hacia efectivo en México (ver sección "Visión multicadena")
- Replicar el modelo en otros países de LATAM con su propia red de comercios

---

## El argumento para el jurado

> "Construimos la primera API que permite a un agente IA conseguir efectivo físico
> en México de forma trustless. El agente paga por cada servicio con USDC usando
> x402, verifica la reputación on-chain del comercio antes de enviar al usuario,
> coordina el intercambio con un HTLC atómico en Soroban, y al final fondea el
> proyecto con el mismo protocolo que acaba de demostrar.
>
> Sin cuentas. Sin API keys. Sin custodians. Sin confianza ciega.
>
> En el futuro, cualquier crypto en cualquier cadena puede convertirse en efectivo
> físico en México — sin bridges, sin custodia, sin riesgo de hackeo — usando el
> AtomicSwapHTLC que ya tenemos construido.
>
> El protocolo se financia a sí mismo. La red crece sola."

---

## Preguntas abiertas para discutir en equipo

1. **¿Cómo onboardeamos a las farmacias?** ¿App separada para comercios o la misma app con rol distinto?

2. **¿Quién paga el gas de las transacciones Soroban?** ¿El usuario, la farmacia, o la plataforma subsidia y recupera en la comisión?

3. **¿Cómo manejamos el tipo de cambio?** El USDC/MXN fluctúa. ¿Quién asume el riesgo entre que el agente inicia el HTLC y que la farmacia entrega el efectivo?

4. **¿Regulación?** Operar como exchange P2P en México tiene implicaciones legales. ¿Cómo nos posicionamos?

5. **AtomicSwapHTLC — ¿quiénes son las contraparties?** Para que el swap multicadena funcione, necesitamos market makers dispuestos a bloquear USDC en Stellar a cambio de ETH/BTC/SOL. ¿Cómo construimos ese libro de órdenes?

---

*Documento de discusión interna · No compartir externamente*
