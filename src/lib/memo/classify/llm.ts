import { Category, Priority } from '../types';

export interface LLMClassifyResult {
  category: Category;
  priority: Priority;
  tags: string[];
  folder?: string;
  subTasks?: string[];
  cleanContent: string;
}

export async function classifyWithLLM(
  input: string, 
  today: string, 
  dayOfWeek: string,
  context?: { forcedCategory?: string, forcedFolder?: string }
): Promise<LLMClassifyResult> {
  const response = await fetch('/api/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, today, dayOfWeek, context })
  });

  if (!response.ok) {
    throw new Error('LLM Classification failed');
  }

  const parsed = await response.json();

  return {
    category: parsed.category || 'THOUGHT',
    priority: parsed.priority || 'Medium',
    tags: parsed.tags || [],
    folder: parsed.folder,
    subTasks: parsed.subTasks,
    cleanContent: parsed.cleanContent || input
  };
}
