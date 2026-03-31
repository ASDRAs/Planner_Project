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
export const GMAIL_OAUTH_MODE_COOKIE = 'planner-gmail-oauth-mode';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const GMAIL_MESSAGES_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const GMAIL_LABELS_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/labels';

const GMAIL_GRANT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const GMAIL_STATE_MAX_AGE_SECONDS = 60 * 10;

export interface GmailGrantRecord {
  emailAddress: string;
  refreshToken: string;
}

export interface GmailGrantCollection {
  activeEmailAddress?: string;
  grants: GmailGrantRecord[];
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
  messages?: Array<{
    id?: string;
  }>;
}

interface GmailMessageResponse {
  id?: string;
  internalDate?: string;
}

interface GmailLabelResponse {
  messagesUnread?: number;
}

interface GmailUnreadSummary {
  unreadCount: number;
  latestUnreadMessageId?: string;
  latestUnreadInternalDate?: string;
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

function encryptPayload(payload: unknown, secret: string): string {
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

function decryptPayload(value: string, secret: string): unknown | null {
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.length <= 28) return null;

    const iv = decoded.subarray(0, 12);
    const tag = decoded.subarray(12, 28);
    const encrypted = decoded.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', createEncryptionKey(secret), iv);
    decipher.setAuthTag(tag);

    return JSON.parse(
      Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    ) as unknown;
  } catch {
    return null;
  }
}

function normalizeGrantRecord(payload: unknown): GmailGrantRecord | null {
  if (!payload || typeof payload !== 'object') return null;

  const parsed = payload as Partial<GmailGrantRecord>;
  if (!parsed.emailAddress || !parsed.refreshToken) return null;

  return {
    emailAddress: parsed.emailAddress,
    refreshToken: parsed.refreshToken,
  };
}

function dedupeGrantRecords(grants: GmailGrantRecord[]): GmailGrantRecord[] {
  const unique = new Map<string, GmailGrantRecord>();

  for (const grant of grants) {
    unique.set(grant.emailAddress.toLowerCase(), grant);
  }

  return Array.from(unique.values());
}

export function createGrantCollection(
  grants: GmailGrantRecord[],
  activeEmailAddress?: string
): GmailGrantCollection {
  const dedupedGrants = dedupeGrantRecords(grants);
  const fallbackActiveEmail = dedupedGrants[0]?.emailAddress;
  const resolvedActiveEmail = dedupedGrants.some(
    (grant) => grant.emailAddress === activeEmailAddress
  )
    ? activeEmailAddress
    : fallbackActiveEmail;

  return {
    grants: dedupedGrants,
    activeEmailAddress: resolvedActiveEmail,
  };
}

export function encryptGrantPayload(payload: GmailGrantRecord, secret: string): string {
  return encryptPayload(payload, secret);
}

export function decryptGrantPayload(value: string, secret: string): GmailGrantRecord | null {
  return normalizeGrantRecord(decryptPayload(value, secret));
}

export function encryptGrantCollectionPayload(
  payload: GmailGrantCollection,
  secret: string
): string {
  return encryptPayload(createGrantCollection(payload.grants, payload.activeEmailAddress), secret);
}

export function decryptGrantCollectionPayload(
  value: string,
  secret: string
): GmailGrantCollection | null {
  const parsed = decryptPayload(value, secret);
  if (!parsed || typeof parsed !== 'object') return null;

  const singleGrant = normalizeGrantRecord(parsed);
  if (singleGrant) {
    return createGrantCollection([singleGrant], singleGrant.emailAddress);
  }

  const collection = parsed as Partial<GmailGrantCollection>;
  if (!Array.isArray(collection.grants)) return null;

  const grants = collection.grants
    .map((grant) => normalizeGrantRecord(grant))
    .filter((grant): grant is GmailGrantRecord => grant !== null);

  return createGrantCollection(grants, collection.activeEmailAddress);
}

function readGrantCookieValue(request: NextRequest): string | undefined {
  return request.cookies.get(GMAIL_GRANT_COOKIE)?.value;
}

export function readGrantCollection(
  request: NextRequest,
  cookieSecret: string
): GmailGrantCollection | null {
  const rawCookie = readGrantCookieValue(request);
  if (!rawCookie) return null;
  return decryptGrantCollectionPayload(rawCookie, cookieSecret);
}

export function mergeGrantIntoCollection(
  existingCollection: GmailGrantCollection | null,
  grant: GmailGrantRecord
): GmailGrantCollection {
  const nextGrants = [...(existingCollection?.grants ?? []).filter((entry) => entry.emailAddress !== grant.emailAddress), grant];
  return createGrantCollection(nextGrants, grant.emailAddress);
}

export function setActiveGrantEmail(
  collection: GmailGrantCollection,
  emailAddress: string
): GmailGrantCollection | null {
  if (!collection.grants.some((grant) => grant.emailAddress === emailAddress)) {
    return null;
  }

  return createGrantCollection(collection.grants, emailAddress);
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

async function fetchUnreadMessageMetadata(
  accessToken: string,
  messageId: string
): Promise<GmailMessageResponse> {
  const url = new URL(`${GMAIL_MESSAGES_URL}/${encodeURIComponent(messageId)}`);
  url.searchParams.set('format', 'minimal');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to read Gmail message metadata');
  }

  return (await response.json()) as GmailMessageResponse;
}

async function fetchInboxUnreadCount(accessToken: string): Promise<number> {
  const url = new URL(`${GMAIL_LABELS_URL}/INBOX`);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to read Gmail inbox label metadata');
  }

  const payload = (await response.json()) as GmailLabelResponse;
  return payload.messagesUnread ?? 0;
}

export async function fetchUnreadInboxSummary(accessToken: string): Promise<GmailUnreadSummary> {
  const listUrl = new URL(GMAIL_MESSAGES_URL);
  listUrl.searchParams.set('labelIds', 'INBOX');
  listUrl.searchParams.set('q', 'is:unread');
  listUrl.searchParams.set('maxResults', '1');

  const [unreadCount, listResponse] = await Promise.all([
    fetchInboxUnreadCount(accessToken),
    fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }),
  ]);

  if (!listResponse.ok) {
    throw new Error('Failed to read Gmail unread status');
  }

  const payload = (await listResponse.json()) as GmailMessageListResponse;
  const latestUnreadMessageId = payload.messages?.[0]?.id;

  if (!latestUnreadMessageId) {
    return {
      unreadCount,
    };
  }

  const latestMessage = await fetchUnreadMessageMetadata(accessToken, latestUnreadMessageId);

  return {
    unreadCount,
    latestUnreadMessageId: latestMessage.id ?? latestUnreadMessageId,
    latestUnreadInternalDate: latestMessage.internalDate,
  };
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

export function setOAuthModeCookie(
  response: NextResponse,
  request: NextRequest,
  mode: 'popup' | 'redirect'
): void {
  response.cookies.set(
    GMAIL_OAUTH_MODE_COOKIE,
    mode,
    getBaseCookieOptions(request, GMAIL_STATE_MAX_AGE_SECONDS)
  );
}

export function readOAuthMode(request: NextRequest): 'popup' | 'redirect' {
  return request.cookies.get(GMAIL_OAUTH_MODE_COOKIE)?.value === 'popup' ? 'popup' : 'redirect';
}

export function clearOAuthModeCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set(GMAIL_OAUTH_MODE_COOKIE, '', getBaseCookieOptions(request, 0));
}

export function writeGrantCookie(
  response: NextResponse,
  request: NextRequest,
  config: GmailServerConfig,
  grantOrCollection: GmailGrantRecord | GmailGrantCollection
): void {
  const collection =
    'grants' in grantOrCollection
      ? createGrantCollection(grantOrCollection.grants, grantOrCollection.activeEmailAddress)
      : createGrantCollection([grantOrCollection], grantOrCollection.emailAddress);

  response.cookies.set(
    GMAIL_GRANT_COOKIE,
    encryptGrantCollectionPayload(collection, config.cookieSecret),
    getBaseCookieOptions(request, GMAIL_GRANT_MAX_AGE_SECONDS)
  );
}

export function clearGrantCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set(GMAIL_GRANT_COOKIE, '', getBaseCookieOptions(request, 0));
}

async function buildAccountStatus(
  config: GmailServerConfig,
  grant: GmailGrantRecord
): Promise<GmailStatus['accounts'][number]> {
  try {
    const accessToken = await refreshAccessToken(config, grant.refreshToken);
    const [profile, unreadSummary] = await Promise.all([
      fetchGmailProfile(accessToken),
      fetchUnreadInboxSummary(accessToken),
    ]);
    const emailAddress = profile.emailAddress || grant.emailAddress;

    return {
      emailAddress,
      unreadCount: unreadSummary.unreadCount,
      hasUnread: unreadSummary.unreadCount > 0,
      redirectUrl: buildGmailInboxUrl(emailAddress),
      latestUnreadMessageId: unreadSummary.latestUnreadMessageId,
      latestUnreadInternalDate: unreadSummary.latestUnreadInternalDate,
      hasNewMail: false,
      isActive: false,
    };
  } catch (error) {
    return {
      emailAddress: grant.emailAddress,
      unreadCount: 0,
      hasUnread: false,
      redirectUrl: buildGmailInboxUrl(grant.emailAddress),
      hasNewMail: false,
      requiresRelink: true,
      error: error instanceof Error ? error.message : 'Gmail link expired',
      isActive: false,
    };
  }
}

export async function buildGmailStatusFromCollection(
  config: GmailServerConfig,
  collection: GmailGrantCollection | null
): Promise<GmailStatusResult> {
  if (!collection || collection.grants.length === 0) {
    return {
      status: {
        ...EMPTY_GMAIL_STATUS,
        configured: true,
      },
      clearGrant: false,
    };
  }

  const accounts = await Promise.all(
    collection.grants.map((grant) => buildAccountStatus(config, grant))
  );
  const activeEmailAddress =
    accounts.find((account) => account.emailAddress === collection.activeEmailAddress)?.emailAddress ??
    accounts[0]?.emailAddress;
  const decoratedAccounts = accounts.map((account) => ({
    ...account,
    isActive: account.emailAddress === activeEmailAddress,
  }));
  const activeAccount = decoratedAccounts.find((account) => account.isActive);
  const totalUnreadCount = decoratedAccounts.reduce((sum, account) => sum + account.unreadCount, 0);

  return {
    status: {
      configured: true,
      linked: decoratedAccounts.length > 0,
      emailAddress: activeAccount?.emailAddress,
      activeEmailAddress,
      unreadCount: activeAccount?.unreadCount ?? 0,
      totalUnreadCount,
      hasUnread: decoratedAccounts.some((account) => account.hasUnread),
      hasNewMail: false,
      activeHasNewMail: false,
      redirectUrl: activeAccount?.redirectUrl,
      requiresRelink: activeAccount?.requiresRelink,
      error: activeAccount?.error,
      accounts: decoratedAccounts,
    },
    clearGrant: false,
  };
}

export async function buildGmailStatus(request: NextRequest): Promise<GmailStatusResult> {
  const config = getGmailConfig(request);
  if (!config) {
    return {
      status: { ...EMPTY_GMAIL_STATUS },
      clearGrant: false,
    };
  }

  const rawCookie = readGrantCookieValue(request);
  if (!rawCookie) {
    return {
      status: {
        ...EMPTY_GMAIL_STATUS,
        configured: true,
      },
      clearGrant: false,
    };
  }

  const collection = decryptGrantCollectionPayload(rawCookie, config.cookieSecret);
  if (!collection) {
    return {
      status: {
        ...EMPTY_GMAIL_STATUS,
        configured: true,
      },
      clearGrant: true,
    };
  }

  return buildGmailStatusFromCollection(config, collection);
}
