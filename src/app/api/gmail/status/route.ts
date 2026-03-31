import { NextRequest, NextResponse } from 'next/server';
import {
  buildGmailStatus,
  buildGmailStatusFromCollection,
  clearGrantCookie,
  getGmailConfig,
  readGrantCollection,
  setActiveGrantEmail,
  writeGrantCookie,
} from '@/lib/gmail/server';

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

export async function POST(request: NextRequest) {
  const config = getGmailConfig(request);
  if (!config) {
    return NextResponse.json(
      { error: 'Gmail integration is not configured on the server.' },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { action?: string; emailAddress?: string }
    | null;
  if (body?.action !== 'set-active' || !body.emailAddress) {
    return NextResponse.json({ error: 'Invalid Gmail action payload.' }, { status: 400 });
  }

  const collection = readGrantCollection(request, config.cookieSecret);
  if (!collection) {
    return NextResponse.json({ error: 'No Gmail accounts are linked.' }, { status: 404 });
  }

  const updatedCollection = setActiveGrantEmail(collection, body.emailAddress);
  if (!updatedCollection) {
    return NextResponse.json({ error: 'Requested Gmail account was not found.' }, { status: 404 });
  }

  const { status } = await buildGmailStatusFromCollection(config, updatedCollection);
  const response = NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  });
  writeGrantCookie(response, request, config, updatedCollection);
  return response;
}
