import { NextRequest, NextResponse } from 'next/server';
import { buildGmailStatus, clearGrantCookie } from '@/lib/gmail/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { status, clearGrant } = await buildGmailStatus(request);
  const response = NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  });

  if (clearGrant) {
    clearGrantCookie(response, request);
  }

  return response;
}
