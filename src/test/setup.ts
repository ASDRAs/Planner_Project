import '@testing-library/jest-dom';
import { vi } from 'vitest';

function extractUrl(url: unknown): string {
  if (typeof url === 'string') return url;
  if (url instanceof URL) return url.toString();
  if (typeof Request !== 'undefined' && url instanceof Request) return url.url;
  return '';
}

// Mocking fetch globally
global.fetch = vi.fn((url) => {
  const normalizedUrl = extractUrl(url);

  if (
    normalizedUrl.includes('/api/classify') ||
    normalizedUrl.includes('generativelanguage.googleapis.com')
  ) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'STUDY',
                      priority: 'Medium',
                      tags: ['streak'],
                      cleanContent: 'Mocked Content',
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });
  }

  // Mock Supabase responses
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    status: 200,
    statusText: 'OK',
  });
}) as any;

// Mocking Transformers.js pipeline
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(async (input: string) => {
    const normalizedInput = input.toLowerCase();
    let bestLabel = 'THOUGHT';

    // Simple logic for mock to satisfy tests
    if (
      normalizedInput.includes('stp') ||
      normalizedInput.includes('?ㅽ듃?뚰겕') ||
      normalizedInput.includes('?밴컯')
    )
      bestLabel = 'STUDY';
    else if (normalizedInput.includes('achievers') || normalizedInput.includes('?꾪닾 怨듭떇'))
      bestLabel = 'GAME_DESIGN';
    else if (normalizedInput.includes('鍮꾨?踰덊샇') || normalizedInput.includes('蹂댄뿕'))
      bestLabel = 'VAULT';
    else if (normalizedInput.includes('怨좎궗') || normalizedInput.includes('怨쇱젣')) bestLabel = 'TODO';

    return {
      labels: [bestLabel],
      scores: [0.99],
    };
  }),
}));
