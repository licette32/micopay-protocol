import fetch from 'node-fetch';

async function verify() {
  const url = 'http://localhost:3000/api/v1/bazaar/accept';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payment': 'mock:VERIFIER:0.005'
    },
    body: JSON.stringify({
      intent_id: 'int-001',
      quote_id: 'qut-demo',
      secret_hash: '0xverificationhash'
    })
  });
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

verify();
