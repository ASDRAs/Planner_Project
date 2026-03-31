import { NextRequest, NextResponse } from 'next/server';
import {
  clearOAuthModeCookie,
  clearOAuthStateCookie,
  exchangeAuthorizationCode,
  fetchGmailProfile,
  readOAuthMode,
  GMAIL_OAUTH_STATE_COOKIE,
  getGmailConfig,
  mergeGrantIntoCollection,
  readGrantCollection,
  validateOAuthState,
  writeGrantCookie,
} from '@/lib/gmail/server';

export const dynamic = 'force-dynamic';

function redirectHome(request: NextRequest, status: string): NextResponse {
  const url = new URL('/', request.url);
  url.searchParams.set('gmail', status);
  return NextResponse.redirect(url);
}

function buildPopupResponse(request: NextRequest, status: string): NextResponse {
  const origin = new URL(request.url).origin;
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Gmail Link</title>
  </head>
  <body>
    <script>
      (function () {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { type: 'planner-gmail-oauth-result', status: ${JSON.stringify(status)} },
              ${JSON.stringify(origin)}
            );
          }
        } finally {
          window.close();
          setTimeout(function () {
            document.body.textContent = 'You can close this window.';
          }, 150);
        }
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function createCompletionResponse(request: NextRequest, status: string): NextResponse {
  return readOAuthMode(request) === 'popup'
    ? buildPopupResponse(request, status)
    : redirectHome(request, status);
}

export async function GET(request: NextRequest) {
  const config = getGmailConfig(request);
  if (!config) {
    return NextResponse.json(
      { error: 'Gmail integration is not configured on the server.' },
      { status: 500 }
    );
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state') ?? undefined;
  const error = request.nextUrl.searchParams.get('error');
  const expectedState = request.cookies.get(GMAIL_OAUTH_STATE_COOKIE)?.value;

  if (error) {
    const response = createCompletionResponse(request, 'denied');
    clearOAuthModeCookie(response, request);
    clearOAuthStateCookie(response, request);
    return response;
  }

  if (!validateOAuthState(expectedState, state) || !code) {
    const response = createCompletionResponse(request, 'invalid');
    clearOAuthModeCookie(response, request);
    clearOAuthStateCookie(response, request);
    return response;
  }

  try {
    const tokens = await exchangeAuthorizationCode(config, code);
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token');
    }

    const profile = await fetchGmailProfile(tokens.access_token);
    if (!profile.emailAddress) {
      throw new Error('Unable to resolve Gmail address');
    }

    const mergedCollection = mergeGrantIntoCollection(
      readGrantCollection(request, config.cookieSecret),
      {
        emailAddress: profile.emailAddress,
        refreshToken: tokens.refresh_token,
      }
    );
    const response = createCompletionResponse(request, 'linked');
    writeGrantCookie(response, request, config, mergedCollection);
    clearOAuthModeCookie(response, request);
    clearOAuthStateCookie(response, request);
    return response;
  } catch {
    const response = createCompletionResponse(request, 'error');
    clearOAuthModeCookie(response, request);
    clearOAuthStateCookie(response, request);
    return response;
  }
}
