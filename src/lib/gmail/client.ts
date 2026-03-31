import { EMPTY_GMAIL_STATUS, type GmailStatus } from './shared';

export const GMAIL_STATUS_UPDATED_EVENT = 'planner-gmail-status-updated';

export function normalizeGmailStatus(status: Partial<GmailStatus>): GmailStatus {
  return {
    ...EMPTY_GMAIL_STATUS,
    ...status,
    accounts: Array.isArray(status.accounts) ? status.accounts : EMPTY_GMAIL_STATUS.accounts,
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

export async function setActiveGmailAccount(emailAddress: string): Promise<GmailStatus> {
  const response = await fetch('/api/gmail/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'set-active',
      emailAddress,
    }),
  });

  if (!response.ok) {
    throw new Error('Gmail account switch request failed');
  }

  return normalizeGmailStatus((await response.json()) as Partial<GmailStatus>);
}

export function notifyGmailStatusUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(GMAIL_STATUS_UPDATED_EVENT));
}
