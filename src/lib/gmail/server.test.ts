// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildGmailAuthorizationUrl,
  createGrantCollection,
  decryptGrantPayload,
  decryptGrantCollectionPayload,
  encryptGrantPayload,
  encryptGrantCollectionPayload,
  mergeGrantIntoCollection,
  setActiveGrantEmail,
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

  it('round-trips multi-account Gmail grant collections', () => {
    const secret = 'test-secret';
    const encrypted = encryptGrantCollectionPayload(
      createGrantCollection(
        [
          {
            emailAddress: 'planner.one@gmail.com',
            refreshToken: 'refresh-token-one',
          },
          {
            emailAddress: 'planner.two@gmail.com',
            refreshToken: 'refresh-token-two',
          },
        ],
        'planner.two@gmail.com'
      ),
      secret
    );

    expect(decryptGrantCollectionPayload(encrypted, secret)).toEqual({
      activeEmailAddress: 'planner.two@gmail.com',
      grants: [
        {
          emailAddress: 'planner.one@gmail.com',
          refreshToken: 'refresh-token-one',
        },
        {
          emailAddress: 'planner.two@gmail.com',
          refreshToken: 'refresh-token-two',
        },
      ],
    });
  });

  it('upgrades legacy single-account payloads into a collection', () => {
    const secret = 'test-secret';
    const encrypted = encryptGrantPayload(
      {
        emailAddress: 'planner.legacy@gmail.com',
        refreshToken: 'legacy-refresh-token',
      },
      secret
    );

    expect(decryptGrantCollectionPayload(encrypted, secret)).toEqual({
      activeEmailAddress: 'planner.legacy@gmail.com',
      grants: [
        {
          emailAddress: 'planner.legacy@gmail.com',
          refreshToken: 'legacy-refresh-token',
        },
      ],
    });
  });

  it('merges linked Gmail accounts and switches the active account', () => {
    const merged = mergeGrantIntoCollection(
      createGrantCollection([
        {
          emailAddress: 'planner.one@gmail.com',
          refreshToken: 'refresh-token-one',
        },
      ]),
      {
        emailAddress: 'planner.two@gmail.com',
        refreshToken: 'refresh-token-two',
      }
    );

    expect(merged).toEqual({
      activeEmailAddress: 'planner.two@gmail.com',
      grants: [
        {
          emailAddress: 'planner.one@gmail.com',
          refreshToken: 'refresh-token-one',
        },
        {
          emailAddress: 'planner.two@gmail.com',
          refreshToken: 'refresh-token-two',
        },
      ],
    });

    expect(setActiveGrantEmail(merged, 'planner.one@gmail.com')).toEqual({
      activeEmailAddress: 'planner.one@gmail.com',
      grants: [
        {
          emailAddress: 'planner.one@gmail.com',
          refreshToken: 'refresh-token-one',
        },
        {
          emailAddress: 'planner.two@gmail.com',
          refreshToken: 'refresh-token-two',
        },
      ],
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
