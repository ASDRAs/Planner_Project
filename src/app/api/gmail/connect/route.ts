import { NextRequest, NextResponse } from 'next/server';
import {
  buildGmailAuthorizationUrl,
  createOAuthState,
  getGmailConfig,
  setOAuthModeCookie,
  setOAuthStateCookie,
} from '@/lib/gmail/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const config = getGmailConfig(request);
  if (!config) {
    return NextResponse.json(
      { error: 'Gmail integration is not configured on the server.' },
      { status: 500 }
    );
  }

  const state = createOAuthState();
  const response = NextResponse.redirect(buildGmailAuthorizationUrl(config, state));
  const popupMode = request.nextUrl.searchParams.get('popup') === '1' ? 'popup' : 'redirect';
  setOAuthModeCookie(response, request, popupMode);
  setOAuthStateCookie(response, request, state);
  return response;
}
