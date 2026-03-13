import { Category, Priority } from '../types';

export interface LLMClassifyResult {
  category: Category;
  priority: Priority;
  tags: string[];
  folder?: string;
  subTasks?: string[];
  cleanContent: string;
}

const MODEL_CANDIDATES = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'] as const;
const CATEGORY_VALUES: Category[] = ['STUDY', 'GAME_DESIGN', 'VAULT', 'THOUGHT', 'TODO'];
const PRIORITY_VALUES: Priority[] = ['High', 'Medium', 'Low'];

function toCategory(value: unknown, fallback: Category): Category {
  return CATEGORY_VALUES.includes(value as Category) ? (value as Category) : fallback;
}

function toPriority(value: unknown, fallback: Priority): Priority {
  return PRIORITY_VALUES.includes(value as Priority) ? (value as Priority) : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function classifyWithLLM(
  input: string,
  today: string,
  dayOfWeek: string,
  context?: { forcedCategory?: string; forcedFolder?: string }
): Promise<LLMClassifyResult> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not set');
  }

  const forcedCategory = context?.forcedCategory ? `Forced category: ${context.forcedCategory}.` : '';
  const forcedFolder = context?.forcedFolder ? `Forced folder: ${context.forcedFolder}.` : '';

  const systemPrompt = [
    'You are a memo classifier for a personal planner app.',
    'Return JSON only. No markdown. No extra text.',
    'JSON keys: category, priority, tags, folder, subTasks, cleanContent.',
    'category must be one of STUDY, GAME_DESIGN, VAULT, THOUGHT, TODO.',
    'priority must be one of High, Medium, Low.',
    'tags and subTasks must be string arrays.',
    'cleanContent must remove date/time words from the original sentence.',
    forcedCategory,
    forcedFolder,
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = `Today is ${today} (${dayOfWeek}). Input: "${input}"`;

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: systemPrompt }, { text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof rawText !== 'string') {
        continue;
      }

      const parsed = JSON.parse(rawText) as Partial<LLMClassifyResult>;

      return {
        category: toCategory(parsed.category, 'THOUGHT'),
        priority: toPriority(parsed.priority, 'Medium'),
        tags: toStringArray(parsed.tags),
        folder: typeof parsed.folder === 'string' && parsed.folder.trim() ? parsed.folder.trim() : undefined,
        subTasks: toStringArray(parsed.subTasks),
        cleanContent:
          typeof parsed.cleanContent === 'string' && parsed.cleanContent.trim()
            ? parsed.cleanContent.trim()
            : input,
      };
    } catch (error) {
      console.warn(`LLM call failed on ${model}`, error);
    }
  }

  throw new Error('LLM Classification failed');
}
