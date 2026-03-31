export interface GmailAccountStatus {
  emailAddress: string;
  unreadCount: number;
  hasUnread: boolean;
  redirectUrl: string;
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
  accounts: [],
};

export function buildGmailInboxUrl(emailAddress: string): string {
  return `https://mail.google.com/mail/u/${encodeURIComponent(emailAddress)}/#inbox`;
}
