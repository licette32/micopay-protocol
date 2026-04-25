const STELLAR_EXPLORER_BASE = 'https://stellar.expert/explorer/testnet/tx';

export function buildTxUrl(txHash: string): string {
  return `${STELLAR_EXPLORER_BASE}/${txHash}`;
}

export function truncateHash(hash: string, chars = 8): string {
  return hash.length > chars * 2
    ? hash.substring(0, chars) + '…'
    : hash;
}
