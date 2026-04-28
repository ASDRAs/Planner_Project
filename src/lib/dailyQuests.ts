import { LOCAL_DAILY_QUEST_STORAGE_KEY } from './constants';
import { getLocalDateString } from './dateUtils';

export interface DailyQuest {
  id: string;
  title: string;
  createdAt: number;
  order: number;
  lastCompletedDate?: string;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `daily-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isDailyQuest(value: unknown): value is DailyQuest {
  if (!value || typeof value !== 'object') return false;
  const quest = value as Partial<DailyQuest>;
  return typeof quest.id === 'string'
    && typeof quest.title === 'string'
    && typeof quest.createdAt === 'number'
    && typeof quest.order === 'number';
}

function sortDailyQuests(quests: DailyQuest[]): DailyQuest[] {
  return [...quests].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function getDailyQuests(): DailyQuest[] {
  if (typeof window === 'undefined') return [];

  const parsed = parseJson<unknown>(localStorage.getItem(LOCAL_DAILY_QUEST_STORAGE_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return sortDailyQuests(parsed.filter(isDailyQuest));
}

function saveDailyQuests(quests: DailyQuest[]): DailyQuest[] {
  const sorted = sortDailyQuests(quests);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_DAILY_QUEST_STORAGE_KEY, JSON.stringify(sorted));
  }
  return sorted;
}

export function addDailyQuest(title: string): DailyQuest[] {
  const quests = getDailyQuests();
  const cleanTitle = title.trim();
  if (!cleanTitle) return quests;

  const maxOrder = quests.reduce((max, quest) => Math.max(max, quest.order), 0);
  const nextQuest: DailyQuest = {
    id: createId(),
    title: cleanTitle,
    createdAt: Date.now(),
    order: maxOrder + 1,
  };

  return saveDailyQuests([...quests, nextQuest]);
}

export function toggleDailyQuest(id: string, date = getLocalDateString()): DailyQuest[] {
  const quests = getDailyQuests();

  return saveDailyQuests(quests.map((quest) => {
    if (quest.id !== id) return quest;

    return {
      ...quest,
      lastCompletedDate: quest.lastCompletedDate === date ? undefined : date,
    };
  }));
}

export function deleteDailyQuest(id: string): DailyQuest[] {
  return saveDailyQuests(getDailyQuests().filter((quest) => quest.id !== id));
}

export function isDailyQuestCompleted(quest: DailyQuest, date = getLocalDateString()): boolean {
  return quest.lastCompletedDate === date;
}
