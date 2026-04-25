import "./config.js";
import Fastify from "fastify";
import { seedDemoData } from "./scripts/seed.js";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { registerRateLimit } from "./plugins/rate-limit.js";
import { healthRoutes } from "./routes/health.js";
import { cashRoutes } from "./routes/cash.js";
import { reputationRoutes } from "./routes/reputation.js";
import { fundRoutes } from "./routes/fund.js";
import { serviceRoutes } from "./routes/services.js";
import { demoRoutes } from "./routes/demo.js";
import { cetesRoutes } from "./routes/cetes.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { config } from "./config.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";

const app = Fastify({
  logger: NODE_ENV === "development",
  trustProxy: true,
});

app.register(fastifyCors, { origin: "*" });

app.register(fastifyJwt, { secret: config.jwtSecret });

registerRateLimit(app);

app.register(healthRoutes);
app.register(cashRoutes);
app.register(reputationRoutes);
app.register(fundRoutes);
app.register(serviceRoutes);
app.register(demoRoutes);
app.register(cetesRoutes);
app.register(authRoutes);
app.register(userRoutes);

async function start() {
  if (config.demoMode) {
    await seedDemoData();
  }
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`MicoPay API running on http://localhost:${PORT}`);
}

start();
