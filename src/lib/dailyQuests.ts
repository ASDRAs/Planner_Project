import { LOCAL_DAILY_QUEST_STORAGE_KEY } from './constants';
import { getLocalDateString } from './dateUtils';
import { supabase } from './supabase';
import type { SyncResult, SyncStatus } from './storage';

export interface DailyQuest {
  id: string;
  title: string;
  createdAt: number;
  order: number;
  lastCompletedDate?: string | null;
  updatedAt?: number;
  deletedAt?: number;
  userId?: string;
  syncStatus?: SyncStatus;
}

type RemoteDailyQuest = Omit<DailyQuest, 'syncStatus' | 'lastCompletedDate' | 'deletedAt'> & {
  lastCompletedDate: string | null;
  deletedAt: number | null;
};

const DEFAULT_TIMEOUT_MS = 8000;
export const DAILY_QUESTS_UPDATED_EVENT = 'planner-daily-quests-updated';

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
  const hasValidLastCompletedDate = quest.lastCompletedDate === undefined
    || quest.lastCompletedDate === null
    || typeof quest.lastCompletedDate === 'string';
  return typeof quest.id === 'string'
    && typeof quest.title === 'string'
    && typeof quest.createdAt === 'number'
    && typeof quest.order === 'number'
    && hasValidLastCompletedDate;
}

function sortDailyQuests(quests: DailyQuest[]): DailyQuest[] {
  return [...quests].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

function getQuestVersion(quest: Partial<DailyQuest>): number {
  return Math.max(quest.updatedAt ?? 0, quest.deletedAt ?? 0, quest.createdAt ?? 0);
}

function normalizeDailyQuest(quest: Partial<DailyQuest>, userId?: string): DailyQuest {
  const createdAt = typeof quest.createdAt === 'number' ? quest.createdAt : Date.now();

  return {
    id: quest.id || createId(),
    title: quest.title || '',
    createdAt,
    updatedAt: typeof quest.updatedAt === 'number' ? quest.updatedAt : createdAt,
    order: typeof quest.order === 'number' ? quest.order : 0,
    lastCompletedDate: typeof quest.lastCompletedDate === 'string' ? quest.lastCompletedDate : undefined,
    deletedAt: typeof quest.deletedAt === 'number' ? quest.deletedAt : undefined,
    userId: userId || quest.userId || undefined,
    syncStatus: quest.syncStatus,
  };
}

function dedupeDailyQuestsByNewestVersion(quests: DailyQuest[]): DailyQuest[] {
  const deduped = new Map<string, DailyQuest>();

  for (const quest of quests.map((item) => normalizeDailyQuest(item))) {
    const existing = deduped.get(quest.id);
    if (!existing || getQuestVersion(quest) >= getQuestVersion(existing)) {
      deduped.set(quest.id, quest);
    }
  }

  return Array.from(deduped.values());
}

function getRawDailyQuests(): DailyQuest[] {
  if (typeof window === 'undefined') return [];

  const parsed = parseJson<unknown>(localStorage.getItem(LOCAL_DAILY_QUEST_STORAGE_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return dedupeDailyQuestsByNewestVersion(parsed.filter(isDailyQuest));
}

export function getDailyQuests(): DailyQuest[] {
  return sortDailyQuests(getRawDailyQuests().filter((quest) => !quest.deletedAt));
}

function saveRawDailyQuests(quests: DailyQuest[]): DailyQuest[] {
  const sorted = sortDailyQuests(quests);
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      LOCAL_DAILY_QUEST_STORAGE_KEY,
      JSON.stringify(dedupeDailyQuestsByNewestVersion(sorted))
    );
  }
  return sorted;
}

function saveDailyQuests(quests: DailyQuest[]): DailyQuest[] {
  const activeIds = new Set(quests.map((quest) => quest.id));
  const existingTombstones = getRawDailyQuests().filter(
    (quest) => quest.deletedAt && !activeIds.has(quest.id)
  );
  return saveRawDailyQuests([...existingTombstones, ...quests.filter((quest) => !quest.deletedAt)]);
}

function toRemoteDailyQuest(quest: DailyQuest, userId: string): RemoteDailyQuest {
  const normalized = normalizeDailyQuest(quest, userId);
  return {
    id: normalized.id,
    title: normalized.title,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt ?? getQuestVersion(normalized),
    order: normalized.order,
    lastCompletedDate: normalized.lastCompletedDate ?? null,
    deletedAt: normalized.deletedAt ?? null,
    userId,
  };
}

async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Server Connection Timeout')), ms);
  });

  const result = await Promise.race([promise, timeout]);
  if (timeoutId) clearTimeout(timeoutId);
  return result;
}

async function fetchRemoteDailyQuests(userId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<DailyQuest[]> {
  const { data, error } = await withTimeout(
    supabase.from('daily_quests').select('*').eq('userId', userId).order('order', { ascending: true }),
    timeoutMs
  );

  if (error) throw error;
  return ((data as DailyQuest[]) ?? []).map((quest) => normalizeDailyQuest(quest, userId));
}

export function addDailyQuest(title: string, userId?: string): DailyQuest[] {
  const quests = getDailyQuests();
  const cleanTitle = title.trim();
  if (!cleanTitle) return quests;

  const maxOrder = quests.reduce((max, quest) => Math.max(max, quest.order), 0);
  const now = Date.now();
  const nextQuest: DailyQuest = {
    id: createId(),
    title: cleanTitle,
    createdAt: now,
    updatedAt: now,
    order: maxOrder + 1,
    userId: userId || undefined,
    syncStatus: userId ? 'pending' : 'synced',
  };

  return saveDailyQuests([...quests, nextQuest]);
}

export function toggleDailyQuest(id: string, date = getLocalDateString(), userId?: string): DailyQuest[] {
  const quests = getRawDailyQuests();
  const now = Date.now();

  return saveRawDailyQuests(quests.map((quest) => {
    if (quest.id !== id) return quest;

    return {
      ...quest,
      lastCompletedDate: quest.lastCompletedDate === date ? undefined : date,
      updatedAt: now,
      userId: userId || quest.userId,
      syncStatus: userId ? 'pending' : 'synced',
    };
  })).filter((quest) => !quest.deletedAt);
}

export function deleteDailyQuest(id: string, userId?: string): DailyQuest[] {
  const quests = getRawDailyQuests();

  if (!userId) {
    return saveRawDailyQuests(quests.filter((quest) => quest.id !== id)).filter((quest) => !quest.deletedAt);
  }

  const now = Date.now();
  return saveRawDailyQuests(quests.map((quest) =>
    quest.id === id
      ? {
          ...quest,
          updatedAt: now,
          deletedAt: now,
          userId: userId || quest.userId,
          syncStatus: 'pending',
        }
      : quest
  )).filter((quest) => !quest.deletedAt);
}

export function isDailyQuestCompleted(quest: DailyQuest, date = getLocalDateString()): boolean {
  return quest.lastCompletedDate === date;
}

export function notifyDailyQuestsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DAILY_QUESTS_UPDATED_EVENT));
}

interface DailyQuestMergePlan {
  merged: DailyQuest[];
  push: DailyQuest[];
  pulled: number;
  conflicts: number;
}

function buildDailyQuestMergePlan(
  localQuests: DailyQuest[],
  remoteQuests: DailyQuest[],
  userId: string
): DailyQuestMergePlan {
  const localById = new Map(localQuests.map((quest) => [quest.id, normalizeDailyQuest(quest, userId)]));
  const remoteById = new Map(remoteQuests.map((quest) => [quest.id, normalizeDailyQuest(quest, userId)]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged: DailyQuest[] = [];
  const push: DailyQuest[] = [];
  let pulled = 0;
  let conflicts = 0;

  for (const id of ids) {
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if (local && !remote) {
      push.push(local);
      merged.push({ ...local, syncStatus: 'pending' });
      continue;
    }

    if (!local && remote) {
      merged.push({ ...remote, syncStatus: 'synced' });
      pulled += remote.deletedAt ? 0 : 1;
      continue;
    }

    if (!local || !remote) continue;

    const localVersion = getQuestVersion(local);
    const remoteVersion = getQuestVersion(remote);
    if (localVersion > remoteVersion) {
      push.push(local);
      merged.push({ ...local, syncStatus: 'pending' });
      if (remoteVersion > 0) conflicts += 1;
    } else if (remoteVersion > localVersion) {
      merged.push({ ...remote, syncStatus: 'synced' });
      pulled += remote.deletedAt ? 0 : 1;
      if (localVersion > 0 && local.syncStatus === 'pending') conflicts += 1;
    } else {
      merged.push({ ...remote, syncStatus: 'synced' });
    }
  }

  return { merged, push, pulled, conflicts };
}

export async function syncDailyQuests(userId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SyncResult> {
  try {
    const remoteQuests = await fetchRemoteDailyQuests(userId, timeoutMs);
    const plan = buildDailyQuestMergePlan(getRawDailyQuests(), remoteQuests, userId);

    if (plan.push.length > 0) {
      const { error } = await withTimeout(
        supabase.from('daily_quests').upsert(plan.push.map((quest) => toRemoteDailyQuest(quest, userId)))
      );
      if (error) throw error;
    }

    const pushedIds = new Set(plan.push.map((quest) => quest.id));
    saveRawDailyQuests(plan.merged.map((quest) =>
      pushedIds.has(quest.id) ? { ...quest, syncStatus: 'synced' } : quest
    ));

    return { ok: true, pulled: plan.pulled, pushed: plan.push.length, conflicts: plan.conflicts };
  } catch (error) {
    console.error('[DailyQuest] Sync failed:', error);
    return { ok: false };
  }
}
