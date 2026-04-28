import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { acknowledgeActiveGmailAccount, applyNewMailState, openGmailInboxWindow } from './client';
import { buildGmailInboxUrl, EMPTY_GMAIL_STATUS, type GmailStatus } from './shared';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

function createStatus(overrides?: Partial<GmailStatus>): GmailStatus {
  return {
    ...EMPTY_GMAIL_STATUS,
    configured: true,
    linked: true,
    emailAddress: 'pilot@gmail.com',
    activeEmailAddress: 'pilot@gmail.com',
    redirectUrl: buildGmailInboxUrl('pilot@gmail.com'),
    accounts: [
      {
        emailAddress: 'pilot@gmail.com',
        unreadCount: 0,
        hasUnread: false,
        redirectUrl: buildGmailInboxUrl('pilot@gmail.com'),
        isActive: true,
        hasNewMail: false,
      },
    ],
    ...overrides,
  };
}

describe('gmail client helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.clearAllMocks();
    Reflect.deleteProperty(window as Window & Record<string, unknown>, '__TAURI_INTERNALS__');
  });

  it('does not flag existing unread mail as new on first observation', () => {
    const nextStatus = applyNewMailState(
      createStatus({
        unreadCount: 3,
        totalUnreadCount: 3,
        hasUnread: true,
        accounts: [
          {
            emailAddress: 'pilot@gmail.com',
            unreadCount: 3,
            hasUnread: true,
            redirectUrl: buildGmailInboxUrl('pilot@gmail.com'),
            latestUnreadMessageId: 'msg-1',
            latestUnreadInternalDate: '1000',
            isActive: true,
            hasNewMail: false,
          },
        ],
      })
    );

    expect(nextStatus.hasNewMail).toBe(false);
    expect(nextStatus.activeHasNewMail).toBe(false);
    expect(nextStatus.accounts[0]?.hasNewMail).toBe(false);
  });

  it('flags newer unread mail after the initial baseline was seen', () => {
    applyNewMailState(
      createStatus({
        accounts: [
          {
            emailAddress: 'pilot@gmail.com',
            unreadCount: 0,
            hasUnread: false,
            redirectUrl: buildGmailInboxUrl('pilot@gmail.com'),
            isActive: true,
            hasNewMail: false,
          },
        ],
      })
    );

    const nextStatus = applyNewMailState(
      createStatus({
        unreadCount: 1,
        totalUnreadCount: 1,
        hasUnread: true,
        accounts: [
          {
            emailAddress: 'pilot@gmail.com',
            unreadCount: 1,
            hasUnread: true,
            redirectUrl: buildGmailInboxUrl('pilot@gmail.com'),
            latestUnreadMessageId: 'msg-2',
            latestUnreadInternalDate: '2000',
            isActive: true,
            hasNewMail: false,
          },
        ],
      })
    );

    expect(nextStatus.hasNewMail).toBe(true);
    expect(nextStatus.activeHasNewMail).toBe(true);
    expect(nextStatus.accounts[0]?.hasNewMail).toBe(true);
  });

  it('clears the active new-mail badge after acknowledging the inbox', () => {
    const flaggedStatus = applyNewMailState(
      createStatus({
        unreadCount: 1,
        totalUnreadCount: 1,
        hasUnread: true,
        accounts: [
          {
            emailAddress: 'pilot@gmail.com',
            unreadCount: 1,
            hasUnread: true,
            redirectUrl: buildGmailInboxUrl('pilot@gmail.com'),
            latestUnreadMessageId: 'msg-3',
            latestUnreadInternalDate: '3000',
            isActive: true,
            hasNewMail: true,
          },
        ],
        hasNewMail: true,
        activeHasNewMail: true,
      })
    );
    const acknowledgedStatus = acknowledgeActiveGmailAccount(flaggedStatus);

    expect(acknowledgedStatus.hasNewMail).toBe(false);
    expect(acknowledgedStatus.activeHasNewMail).toBe(false);
    expect(acknowledgedStatus.accounts[0]?.hasNewMail).toBe(false);
  });

  it('builds Gmail inbox URLs with an authuser hint for the linked account', () => {
    expect(buildGmailInboxUrl('pilot@gmail.com')).toBe(
      'https://mail.google.com/mail/?authuser=pilot%40gmail.com#inbox'
    );
  });

  it('opens Gmail through the Tauri bridge when running inside the desktop shell', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const invokeMock = vi.mocked(invoke);
    (window as Window & Record<string, unknown>).__TAURI_INTERNALS__ = {};

    await openGmailInboxWindow(buildGmailInboxUrl('pilot@gmail.com'));

    expect(invokeMock).toHaveBeenCalledWith('open_external_url', {
      url: buildGmailInboxUrl('pilot@gmail.com'),
    });
    expect(openSpy).not.toHaveBeenCalled();
  });
});
