import { EMPTY_GMAIL_STATUS, type GmailAccountStatus, type GmailStatus } from './shared';

export const GMAIL_STATUS_UPDATED_EVENT = 'planner-gmail-status-updated';

const GMAIL_SEEN_STATE_STORAGE_KEY = 'planner-gmail-seen-state-v1';
const GMAIL_INBOX_POPUP_NAME = 'planner-gmail-inbox';
const GMAIL_INBOX_POPUP_WIDTH = 1180;
const GMAIL_INBOX_POPUP_HEIGHT = 840;

interface GmailSeenState {
  [emailAddress: string]: {
    latestUnreadInternalDate?: string;
  };
}

function normalizeGmailAccountStatus(account: Partial<GmailAccountStatus>): GmailAccountStatus {
  return {
    emailAddress: account.emailAddress ?? '',
    unreadCount: account.unreadCount ?? 0,
    hasUnread: account.hasUnread ?? false,
    redirectUrl: account.redirectUrl ?? '',
    latestUnreadMessageId: account.latestUnreadMessageId,
    latestUnreadInternalDate: account.latestUnreadInternalDate,
    hasNewMail: account.hasNewMail ?? false,
    requiresRelink: account.requiresRelink,
    error: account.error,
    isActive: account.isActive ?? false,
  };
}

function getAccountStorageKey(emailAddress: string): string {
  return emailAddress.trim().toLowerCase();
}

function parseInternalDate(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readSeenState(): GmailSeenState {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(GMAIL_SEEN_STATE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as GmailSeenState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeenState(state: GmailSeenState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GMAIL_SEEN_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function normalizeGmailStatus(status: Partial<GmailStatus>): GmailStatus {
  return {
    ...EMPTY_GMAIL_STATUS,
    ...status,
    accounts: Array.isArray(status.accounts)
      ? status.accounts.map((account) => normalizeGmailAccountStatus(account))
      : EMPTY_GMAIL_STATUS.accounts,
    hasNewMail: status.hasNewMail ?? false,
    activeHasNewMail: status.activeHasNewMail ?? false,
  };
}

export function applyNewMailState(status: GmailStatus): GmailStatus {
  const normalizedStatus = normalizeGmailStatus(status);

  if (typeof window === 'undefined') {
    return {
      ...normalizedStatus,
      hasNewMail: false,
      activeHasNewMail: false,
      accounts: normalizedStatus.accounts.map((account) => ({
        ...account,
        hasNewMail: false,
      })),
    };
  }

  const seenState = readSeenState();
  let didSeedSeenState = false;

  const accounts = normalizedStatus.accounts.map((account) => {
    const key = getAccountStorageKey(account.emailAddress);
    const latestUnreadInternalDate = account.latestUnreadInternalDate;
    const seenRecord = seenState[key];

    let hasNewMail = false;
    if (!seenRecord) {
      seenState[key] = { latestUnreadInternalDate };
      didSeedSeenState = true;
    } else if (
      latestUnreadInternalDate &&
      parseInternalDate(latestUnreadInternalDate) > parseInternalDate(seenRecord.latestUnreadInternalDate)
    ) {
        hasNewMail = true;
    }

    return {
      ...account,
      hasNewMail,
    };
  });

  if (didSeedSeenState) {
    writeSeenState(seenState);
  }

  const activeAccount = accounts.find((account) => account.isActive);

  return {
    ...normalizedStatus,
    accounts,
    hasNewMail: accounts.some((account) => account.hasNewMail),
    activeHasNewMail: activeAccount?.hasNewMail ?? false,
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

  return applyNewMailState(normalizeGmailStatus((await response.json()) as Partial<GmailStatus>));
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

  return applyNewMailState(normalizeGmailStatus((await response.json()) as Partial<GmailStatus>));
}

export function acknowledgeActiveGmailAccount(status: GmailStatus): GmailStatus {
  const normalizedStatus = normalizeGmailStatus(status);
  const activeAccount = normalizedStatus.accounts.find((account) => account.isActive);
  if (!activeAccount || typeof window === 'undefined') {
    return normalizedStatus;
  }

  const seenState = readSeenState();
  const key = getAccountStorageKey(activeAccount.emailAddress);
  seenState[key] = {
    latestUnreadInternalDate: activeAccount.latestUnreadInternalDate,
  };
  writeSeenState(seenState);

  const accounts = normalizedStatus.accounts.map((account) =>
    account.isActive
      ? {
          ...account,
          hasNewMail: false,
        }
      : account
  );

  return {
    ...normalizedStatus,
    accounts,
    activeHasNewMail: false,
    hasNewMail: accounts.some((account) => account.hasNewMail),
  };
}

export function openGmailInboxWindow(url: string): void {
  const left = window.screenX + Math.max(0, (window.outerWidth - GMAIL_INBOX_POPUP_WIDTH) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - GMAIL_INBOX_POPUP_HEIGHT) / 2);
  const features = [
    'popup=yes',
    `width=${GMAIL_INBOX_POPUP_WIDTH}`,
    `height=${GMAIL_INBOX_POPUP_HEIGHT}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');
  const popup = window.open(url, GMAIL_INBOX_POPUP_NAME, features);

  if (!popup) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  popup.focus();
}

export function notifyGmailStatusUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(GMAIL_STATUS_UPDATED_EVENT));
}
