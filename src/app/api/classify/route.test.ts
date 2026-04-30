// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const ORIGINAL_GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function createRequest(body: unknown) {
  return new NextRequest('https://planner.test/api/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/classify', () => {
  afterEach(() => {
    process.env.GEMINI_API_KEY = ORIGINAL_GEMINI_API_KEY;
    vi.unstubAllGlobals();
  });

  it('rejects invalid payloads before calling Gemini', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(createRequest({ input: '' }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls Gemini with the server-only GEMINI_API_KEY', async () => {
    process.env.GEMINI_API_KEY = 'server-only-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    category: 'TODO',
                    priority: 'High',
                    tags: ['수업'],
                    subTasks: ['과제 제출'],
                    cleanContent: '과제 제출',
                  }),
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(createRequest({
      input: '내일 과제 제출',
      today: '2026-04-30',
      dayOfWeek: '목요일',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('key=server-only-key');
    expect(payload).toMatchObject({
      category: 'TODO',
      priority: 'High',
      cleanContent: '과제 제출',
    });
  });
});
