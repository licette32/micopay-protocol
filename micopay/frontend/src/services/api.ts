import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const http = axios.create({ baseURL: BASE_URL });

function authHeaders(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function randomAddress(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let address = "G" + prefix.toUpperCase().replace(/[^A-Z2-7]/g, "A");
  while (address.length < 56) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address.substring(0, 56);
}

export interface UserData {
  id: string;
  username: string;
  token: string;
}

export interface CurrentUserProfile {
  id: string;
  username: string;
  stellar_address: string;
  phone_hash?: string | null;
  deleted_at?: string | null;
  wallet_type?: string | null;
  created_at?: string;
}

export interface TradeData {
  id: string;
  status: string;
  secret_hash: string;
  amount_mxn: number;
}

export async function registerUser(username: string): Promise<UserData> {
  const stellar_address = randomAddress(username.substring(0, 6));
  const res = await http.post("/users/register", { username, stellar_address });
  return { ...res.data.user, token: res.data.token };
}

export async function createTrade(
  sellerId: string,
  amountMxn: number,
  buyerToken: string,
): Promise<TradeData> {
  const res = await http.post(
    "/trades",
    { seller_id: sellerId, amount_mxn: amountMxn },
    authHeaders(buyerToken),
  );
  return res.data.trade;
}

export async function lockTrade(
  tradeId: string,
  sellerToken: string,
): Promise<{ lock_tx_hash: string }> {
  const res = await http.post(
    `/trades/${tradeId}/lock`,
    {},
    authHeaders(sellerToken),
  );
  return { lock_tx_hash: res.data.lock_tx_hash };
}

export async function revealTrade(
  tradeId: string,
  sellerToken: string,
): Promise<void> {
  await http.post(
    `/trades/${tradeId}/reveal`,
    undefined,
    authHeaders(sellerToken),
  );
}

export async function getSecret(
  tradeId: string,
  sellerToken: string,
): Promise<{ secret: string; qr_payload: string }> {
  const res = await http.get(
    `/trades/${tradeId}/secret`,
    authHeaders(sellerToken),
  );
  return res.data;
}

export async function completeTrade(
  tradeId: string,
  buyerToken: string,
): Promise<void> {
  await http.post(`/trades/${tradeId}/complete`, {}, authHeaders(buyerToken));
}

export interface TradeHistoryItem {
  id: string;
  status: string;
  amount_mxn: number;
  platform_fee_mxn: number;
  lock_tx_hash: string | null;
  release_tx_hash: string | null;
  created_at: string;
  seller_id: string;
  buyer_id: string;
}

export async function getTradeHistory(
  token: string,
): Promise<TradeHistoryItem[]> {
  const res = await http.get("/trades/history", authHeaders(token));
  return res.data.trades;
}

export async function getCurrentUser(
  token: string,
): Promise<CurrentUserProfile> {
  const res = await http.get("/users/me", authHeaders(token));
  return res.data.user;
}

export async function deleteAccount(
  token: string,
  username: string,
): Promise<{ status: string }> {
  const res = await http.post(
    "/users/me/delete",
    { username },
    authHeaders(token),
  );
  return res.data;
}

export async function getAccountBalance(): Promise<{
  xlm: string;
  address: string;
}> {
  const res = await http.get("/account/balance");
  return res.data;
}

// ─── DeFi: CETES ──────────────────────────────────────────────────────────

export interface CETESRate {
  apy: number;
  xlmPerUsdc: number;
  cetesIssuer: string;
  cesPriceMxn: number;
  network: string;
  note: string;
}

export interface CETESTxResult {
  hash: string;
  status: string;
  simulated: boolean;
  amount: string;
  sourceAsset?: string;
  cetesReceived?: string;
  destReceived?: string;
  explorerUrl: string;
  note?: string;
}

export async function getCETESRate(amount = "100"): Promise<CETESRate> {
  const res = await http.get(`/defi/cetes/rate?amount=${amount}`);
  return res.data;
}

export async function buyCETES(
  amount: string,
  sourceAsset: "XLM" | "USDC" | "MXNe",
): Promise<CETESTxResult> {
  const res = await http.post("/defi/cetes/buy", { amount, sourceAsset });
  return res.data;
}

export async function sellCETES(
  amount: string,
  destAsset: "XLM" | "USDC" | "MXNe",
): Promise<CETESTxResult> {
  const res = await http.post("/defi/cetes/sell", { amount, destAsset });
  return res.data;
}

// ─── DeFi: Blend ──────────────────────────────────────────────────────────

export interface BlendPoolAsset {
  code: string;
  supplyApy: number;
  borrowApy: number;
  liquidity: number;
}

export interface BlendPool {
  id: string;
  name: string;
  tvl: number;
  assets: BlendPoolAsset[];
}

export interface BlendPoolsResponse {
  pools: BlendPool[];
  network: string;
  simulated: boolean;
}

export interface BlendTxResult {
  hash: string;
  status: string;
  simulated: boolean;
  amount: string;
  asset: string;
  explorerUrl: string;
  note?: string;
}

export async function getBlendPools(): Promise<BlendPoolsResponse> {
  const res = await http.get("/defi/blend/pools");
  return res.data;
}

export async function blendSupply(
  amount: string,
  asset: string,
  collateral = false,
): Promise<BlendTxResult> {
  const res = await http.post("/defi/blend/supply", {
    amount,
    asset,
    collateral,
  });
  return res.data;
}

export async function blendBorrow(
  amount: string,
  asset: string,
): Promise<BlendTxResult> {
  const res = await http.post("/defi/blend/borrow", { amount, asset });
  return res.data;
}
