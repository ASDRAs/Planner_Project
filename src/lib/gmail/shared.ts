export interface GmailAccountStatus {
  emailAddress: string;
  unreadCount: number;
  hasUnread: boolean;
  redirectUrl: string;
  latestUnreadMessageId?: string;
  latestUnreadInternalDate?: string;
  hasNewMail?: boolean;
  requiresRelink?: boolean;
  error?: string;
  isActive: boolean;
}

export interface GmailStatus {
  configured: boolean;
  linked: boolean;
  emailAddress?: string;
  activeEmailAddress?: string;
  unreadCount: number;
  totalUnreadCount: number;
  hasUnread: boolean;
  hasNewMail: boolean;
  activeHasNewMail: boolean;
  redirectUrl?: string;
  requiresRelink?: boolean;
  error?: string;
  accounts: GmailAccountStatus[];
}

export const EMPTY_GMAIL_STATUS: GmailStatus = {
  configured: false,
  linked: false,
  unreadCount: 0,
  totalUnreadCount: 0,
  hasUnread: false,
  hasNewMail: false,
  activeHasNewMail: false,
  accounts: [],
};

export function buildGmailInboxUrl(emailAddress: string): string {
  const url = new URL('https://mail.google.com/mail/');
  url.searchParams.set('authuser', emailAddress);
  url.hash = 'inbox';
  return url.toString();
}
