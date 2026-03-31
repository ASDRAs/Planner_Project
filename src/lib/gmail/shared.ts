export interface GmailStatus {
  configured: boolean;
  linked: boolean;
  emailAddress?: string;
  unreadCount: number;
  hasUnread: boolean;
  redirectUrl?: string;
  requiresRelink?: boolean;
  error?: string;
}

export const EMPTY_GMAIL_STATUS: GmailStatus = {
  configured: false,
  linked: false,
  unreadCount: 0,
  hasUnread: false,
};

export function buildGmailInboxUrl(emailAddress: string): string {
  return `https://mail.google.com/mail/u/${encodeURIComponent(emailAddress)}/#inbox`;
}
