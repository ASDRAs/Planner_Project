// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildGmailAuthorizationUrl,
  decryptGrantPayload,
  encryptGrantPayload,
} from './server';

describe('gmail server helpers', () => {
  it('round-trips encrypted Gmail grant payloads', () => {
    const secret = 'test-secret';
    const encrypted = encryptGrantPayload(
      {
        emailAddress: 'planner.test@gmail.com',
        refreshToken: 'refresh-token-value',
      },
      secret
    );

    expect(
      decryptGrantPayload(encrypted, secret)
    ).toEqual({
      emailAddress: 'planner.test@gmail.com',
      refreshToken: 'refresh-token-value',
    });
  });

  it('builds an authorization URL for offline Gmail access', () => {
    const url = new URL(
      buildGmailAuthorizationUrl(
        {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          cookieSecret: 'cookie-secret',
          redirectUri: 'http://localhost:3000/api/gmail/callback',
        },
        'state-value'
      )
    );

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent select_account');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('scope')).toContain('gmail.readonly');
  });
});
