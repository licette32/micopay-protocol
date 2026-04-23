/**
 * Micopay MVP — Error Taxonomy & Support-Safe Messaging Test
 * 
 * Verifies that the backend returns consistent error shapes and codes.
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function api(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json() as any;
  return { status: res.status, data };
}

function randomAddress(prefix: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let address = 'G' + prefix.toUpperCase();
  while (address.length < 56) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address.substring(0, 56);
}

async function main() {
  console.log('🧪 Micopay Error Taxonomy Test\n');

  // 1. Bad Login (Invalid Credentials)
  console.log('1️⃣  Testing bad login (AUTH_INVALID_CREDENTIALS)...');
  const stellar_address = randomAddress('ERR');
  const badLogin = await api('POST', '/auth/token', {
    stellar_address,
    challenge: 'micopay-auth-fake-challenge',
    signature: 'bad-signature'
  });
  
  if (badLogin.status === 401 && badLogin.data.code === 'AUTH_INVALID_CHALLENGE') {
    // Note: It returns INVALID_CHALLENGE because the challenge doesn't exist in memory
    console.log(`   ✅ Received expected code: ${badLogin.data.code}`);
    console.log(`   📋 Message: ${badLogin.data.message}\n`);
  } else {
    console.log(`   ❌ Unexpected response: ${badLogin.status}`, badLogin.data);
    process.exit(1);
  }

  // 2. Validation Error (Invalid participants)
  console.log('2️⃣  Testing validation error (INVALID_PARTICIPANTS)...');
  // Need a real user first
  const user = await api('POST', '/users/register', {
    stellar_address,
    username: `user_${Date.now() % 10000}`,
  });
  
  const badParticipants = await api('POST', '/trades', {
    seller_id: user.data.user.id,
    amount_mxn: 1000
  }, user.data.token);

  if (badParticipants.status === 400 && badParticipants.data.code === 'INVALID_PARTICIPANTS') {
    console.log(`   ✅ Received expected code: ${badParticipants.data.code}`);
    console.log(`   📋 Message: ${badParticipants.data.message}\n`);
  } else {
    console.log(`   ❌ Unexpected response: ${badParticipants.status}`, badParticipants.data);
    process.exit(1);
  }

  // 3. Unauthorized Access (Buyer access secret)
  console.log('3️⃣  Testing unauthorized access (UNAUTHORIZED_ACTION)...');
  const buyerAddress = randomAddress('BUY');
  const buyer = await api('POST', '/users/register', {
    stellar_address: buyerAddress,
    username: `buyer_${Date.now() % 10000}`,
  });

  const trade = await api('POST', '/trades', {
    seller_id: user.data.user.id,
    amount_mxn: 1000
  }, buyer.data.token);

  const unauthorized = await api('GET', `/trades/${trade.data.trade.id}/secret`, undefined, buyer.data.token);
  
  if (unauthorized.status === 403 && unauthorized.data.code === 'UNAUTHORIZED_ACTION') {
    console.log(`   ✅ Received expected code: ${unauthorized.data.code}`);
    console.log(`   📋 Message: ${unauthorized.data.message}\n`);
  } else {
    console.log(`   ❌ Unexpected response: ${unauthorized.status}`, unauthorized.data);
    process.exit(1);
  }

  // 4. Trade State Error (Cancel a non-pending trade)
  console.log('4️⃣  Testing trade state error (INVALID_STATE)...');
  // First lock the trade
  await api('POST', `/trades/${trade.data.trade.id}/lock`, {}, user.data.token);
  
  const badCancel = await api('POST', `/trades/${trade.data.trade.id}/cancel`, undefined, buyer.data.token);

  if (badCancel.status === 409 && badCancel.data.code === 'INVALID_STATE') {
    console.log(`   ✅ Received expected code: ${badCancel.data.code}`);
    console.log(`   📋 Message: ${badCancel.data.message}\n`);
  } else {
    console.log(`   ❌ Unexpected response: ${badCancel.status}`, badCancel.data);
    process.exit(1);
  }

  console.log('✅ Error taxonomy test passed!');
}

main().catch(err => {
  console.error('\n❌ Test FAILED:', err.message);
  process.exit(1);
});
