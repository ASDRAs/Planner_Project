import { NextRequest, NextResponse } from 'next/server';
import { classifyWithGemini, type LLMClassifyRequest } from '@/lib/memo/classify/llm';

export const dynamic = 'force-dynamic';

const MAX_INPUT_LENGTH = 5000;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseClassifyRequest(body: unknown): LLMClassifyRequest | null {
  if (!isObject(body)) return null;

  const input = toOptionalString(body.input);
  const today = toOptionalString(body.today);
  const dayOfWeek = toOptionalString(body.dayOfWeek);
  if (!input || !today || !dayOfWeek || input.length > MAX_INPUT_LENGTH) {
    return null;
  }

  const context = isObject(body.context)
    ? {
        forcedCategory: toOptionalString(body.context.forcedCategory),
        forcedFolder: toOptionalString(body.context.forcedFolder),
      }
    : undefined;

  return {
    input,
    today,
    dayOfWeek,
    context,
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as unknown;
  const classifyRequest = parseClassifyRequest(body);

  if (!classifyRequest) {
    return NextResponse.json({ error: 'Invalid classification payload.' }, { status: 400 });
  }

  try {
    const result = await classifyWithGemini(classifyRequest);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[Classify API] Gemini classification failed:', error);
    return NextResponse.json({ error: 'Classification failed.' }, { status: 502 });
  }
}
