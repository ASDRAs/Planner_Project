import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { buildGmailInboxUrl, EMPTY_GMAIL_STATUS, type GmailStatus } from './shared';

export const GMAIL_GRANT_COOKIE = 'planner-gmail-grant';
export const GMAIL_OAUTH_STATE_COOKIE = 'planner-gmail-oauth-state';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const GMAIL_MESSAGES_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

const GMAIL_GRANT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const GMAIL_STATE_MAX_AGE_SECONDS = 60 * 10;

export interface GmailGrantRecord {
  emailAddress: string;
  refreshToken: string;
}

export interface GmailServerConfig {
  clientId: string;
  clientSecret: string;
  cookieSecret: string;
  redirectUri: string;
}

interface GoogleTokenSuccessResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

interface GoogleTokenErrorResponse {
  error?: string;
  error_description?: string;
}

interface GmailProfileResponse {
  emailAddress?: string;
}

interface GmailMessageListResponse {
  resultSizeEstimate?: number;
}

export interface GmailStatusResult {
  status: GmailStatus;
  clearGrant: boolean;
}

function getBaseCookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge,
  };
}

function createEncryptionKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptGrantPayload(payload: GmailGrantRecord, secret: string): string {
  const iv = randomBytes(12);
  const key = createEncryptionKey(secret);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptGrantPayload(value: string, secret: string): GmailGrantRecord | null {
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.length <= 28) return null;

    const iv = decoded.subarray(0, 12);
    const tag = decoded.subarray(12, 28);
    const encrypted = decoded.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', createEncryptionKey(secret), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted) as Partial<GmailGrantRecord>;

    if (!parsed.emailAddress || !parsed.refreshToken) return null;

    return {
      emailAddress: parsed.emailAddress,
      refreshToken: parsed.refreshToken,
    };
  } catch {
    return null;
  }
}

function readGrantCookie(request: NextRequest, cookieSecret: string): GmailGrantRecord | null {
  const rawCookie = request.cookies.get(GMAIL_GRANT_COOKIE)?.value;
  if (!rawCookie) return null;
  return decryptGrantPayload(rawCookie, cookieSecret);
}

export function getGmailConfig(request: NextRequest): GmailServerConfig | null {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const cookieSecret = process.env.GMAIL_COOKIE_SECRET;
  const redirectUri =
    process.env.GOOGLE_GMAIL_REDIRECT_URI ??
    new URL('/api/gmail/callback', request.url).toString();

  if (!clientId || !clientSecret || !cookieSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    cookieSecret,
    redirectUri,
  };
}

export function buildGmailAuthorizationUrl(config: GmailServerConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GMAIL_READONLY_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent select_account',
    state,
  });

  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
}

export function createOAuthState(): string {
  return randomBytes(24).toString('base64url');
}

function isMatchingState(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function validateOAuthState(expected: string | undefined, received: string | undefined): boolean {
  if (!expected || !received) return false;
  return isMatchingState(expected, received);
}

async function exchangeToken(body: URLSearchParams): Promise<GoogleTokenSuccessResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  const payload = (await response.json()) as GoogleTokenSuccessResponse & GoogleTokenErrorResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google token exchange failed');
  }

  return payload;
}

export async function exchangeAuthorizationCode(
  config: GmailServerConfig,
  code: string
): Promise<GoogleTokenSuccessResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });

  return exchangeToken(body);
}

export async function refreshAccessToken(
  config: GmailServerConfig,
  refreshToken: string
): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const payload = await exchangeToken(body);
  return payload.access_token;
}

export async function fetchGmailProfile(accessToken: string): Promise<GmailProfileResponse> {
  const response = await fetch(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to read Gmail profile');
  }

  return (await response.json()) as GmailProfileResponse;
}

export async function fetchUnreadInboxCount(accessToken: string): Promise<number> {
  const url = new URL(GMAIL_MESSAGES_URL);
  url.searchParams.set('labelIds', 'INBOX');
  url.searchParams.set('q', 'is:unread');
  url.searchParams.set('maxResults', '1');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to read Gmail unread status');
  }

  const payload = (await response.json()) as GmailMessageListResponse;
  return payload.resultSizeEstimate ?? 0;
}

export function setOAuthStateCookie(response: NextResponse, request: NextRequest, state: string): void {
  response.cookies.set(
    GMAIL_OAUTH_STATE_COOKIE,
    state,
    getBaseCookieOptions(request, GMAIL_STATE_MAX_AGE_SECONDS)
  );
}

export function clearOAuthStateCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set(GMAIL_OAUTH_STATE_COOKIE, '', getBaseCookieOptions(request, 0));
}

export function writeGrantCookie(
  response: NextResponse,
  request: NextRequest,
  config: GmailServerConfig,
  grant: GmailGrantRecord
): void {
  response.cookies.set(
    GMAIL_GRANT_COOKIE,
    encryptGrantPayload(grant, config.cookieSecret),
    getBaseCookieOptions(request, GMAIL_GRANT_MAX_AGE_SECONDS)
  );
}

export function clearGrantCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set(GMAIL_GRANT_COOKIE, '', getBaseCookieOptions(request, 0));
}

export async function buildGmailStatus(request: NextRequest): Promise<GmailStatusResult> {
  const config = getGmailConfig(request);
  if (!config) {
    return {
      status: { ...EMPTY_GMAIL_STATUS },
      clearGrant: false,
    };
  }

  const grant = readGrantCookie(request, config.cookieSecret);
  if (!grant) {
    return {
      status: {
        ...EMPTY_GMAIL_STATUS,
        configured: true,
      },
      clearGrant: false,
    };
  }

  try {
    const accessToken = await refreshAccessToken(config, grant.refreshToken);
    const [profile, unreadCount] = await Promise.all([
      fetchGmailProfile(accessToken),
      fetchUnreadInboxCount(accessToken),
    ]);
    const emailAddress = profile.emailAddress || grant.emailAddress;

    return {
      status: {
        configured: true,
        linked: true,
        emailAddress,
        unreadCount,
        hasUnread: unreadCount > 0,
        redirectUrl: buildGmailInboxUrl(emailAddress),
      },
      clearGrant: false,
    };
  } catch (error) {
    return {
      status: {
        ...EMPTY_GMAIL_STATUS,
        configured: true,
        requiresRelink: true,
        error: error instanceof Error ? error.message : 'Gmail link expired',
      },
      clearGrant: true,
    };
  }
}
