import { EMPTY_GMAIL_STATUS, type GmailStatus } from './shared';

export function normalizeGmailStatus(status: Partial<GmailStatus>): GmailStatus {
  return {
    ...EMPTY_GMAIL_STATUS,
    ...status,
  };
}

export async function fetchGmailStatus(): Promise<GmailStatus> {
  const response = await fetch('/api/gmail/status', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Gmail status request failed');
  }

  return normalizeGmailStatus((await response.json()) as Partial<GmailStatus>);
}
