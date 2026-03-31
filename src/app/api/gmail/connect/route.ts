import { NextRequest, NextResponse } from 'next/server';
import {
  buildGmailAuthorizationUrl,
  createOAuthState,
  getGmailConfig,
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
  setOAuthStateCookie(response, request, state);
  return response;
}
