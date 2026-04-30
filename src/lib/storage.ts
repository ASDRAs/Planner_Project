import { Category, Priority } from './classifier';
import { supabase } from './supabase';
import { getLocalDateString } from './dateUtils';
import {
  LOCAL_DELETED_MEMO_STORAGE_KEY,
  LOCAL_MEMO_STORAGE_KEY,
} from './constants';

export type SyncStatus = 'synced' | 'pending';

export interface Memo {
  id: string;
  content: string;
  category: Category;
  priority: Priority;
  tags: string[];
  createdAt: number;
  targetDate: string;
  completed: boolean;
  userId?: string;
  folder?: string;
  order?: number;
  updatedAt?: number;
  deletedAt?: number;
  syncStatus?: SyncStatus;
}

type RemoteMemo = Omit<Memo, 'syncStatus' | 'folder' | 'deletedAt'> & {
  folder: string | null;
  deletedAt: number | null;
};

const DEFAULT_TIMEOUT_MS = 8000;
const FAST_FETCH_TIMEOUT_MS = 3000;

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sortByOrder(memos: Memo[]): Memo[] {
  return [...memos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function isActiveMemo(memo: Memo, deletedIds: string[]): boolean {
  if (memo.deletedAt) return false;
  if (deletedIds.length === 0) return true;
  return !deletedIds.includes(memo.id);
}

function filterDeletedMemos(memos: Memo[], deletedIds: string[]): Memo[] {
  const deletedSet = new Set(deletedIds);
  return memos.filter((memo) => !memo.deletedAt && !deletedSet.has(memo.id));
}

function getMemoVersion(memo: Partial<Memo>): number {
  return Math.max(memo.updatedAt ?? 0, memo.deletedAt ?? 0, memo.createdAt ?? 0);
}

function normalizeMemo(memo: Partial<Memo> & { subject?: string }, userId?: string): Memo {
  const createdAt = typeof memo.createdAt === 'number' ? memo.createdAt : Date.now();

  return {
    id: memo.id || crypto.randomUUID(),
    content: memo.content || memo.subject || '',
    category: memo.category || 'THOUGHT',
    priority: memo.priority || 'Medium',
    tags: Array.isArray(memo.tags) ? memo.tags : [],
    createdAt,
    updatedAt: typeof memo.updatedAt === 'number' ? memo.updatedAt : createdAt,
    targetDate: memo.targetDate || getLocalDateString(),
    completed: !!memo.completed,
    userId: userId || memo.userId || undefined,
    folder: memo.folder || undefined,
    order: typeof memo.order === 'number' ? memo.order : 0,
    deletedAt: typeof memo.deletedAt === 'number' ? memo.deletedAt : undefined,
    syncStatus: memo.syncStatus,
  };
}

function dedupeMemosByNewestVersion(memos: Memo[]): Memo[] {
  const deduped = new Map<string, Memo>();

  for (const memo of memos.map((item) => normalizeMemo(item))) {
    const existing = deduped.get(memo.id);
    if (!existing || getMemoVersion(memo) >= getMemoVersion(existing)) {
      deduped.set(memo.id, memo);
    }
  }

  return Array.from(deduped.values());
}

function readStoredMemos(): Memo[] {
  if (typeof window === 'undefined') return [];
  const parsed = parseJson<unknown>(localStorage.getItem(LOCAL_MEMO_STORAGE_KEY), []);
  return Array.isArray(parsed) ? dedupeMemosByNewestVersion(parsed as Memo[]) : [];
}

function writeStoredMemos(memos: Memo[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_MEMO_STORAGE_KEY, JSON.stringify(dedupeMemosByNewestVersion(memos)));
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

async function fetchRemoteMemos(userId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Memo[]> {
  const { data, error } = await withTimeout(
    supabase.from('memos').select('*').eq('userId', userId).order('order', { ascending: true }),
    timeoutMs
  );

  if (error) throw error;
  return ((data as Memo[]) ?? []).map((memo) => normalizeMemo(memo, userId));
}

function toRemoteMemo(memo: Memo, userId: string): RemoteMemo {
  const normalized = normalizeMemo(memo, userId);
  return {
    id: normalized.id,
    content: normalized.content,
    category: normalized.category,
    priority: normalized.priority,
    tags: normalized.tags,
    createdAt: normalized.createdAt,
    targetDate: normalized.targetDate,
    completed: normalized.completed,
    userId,
    folder: normalized.folder ?? null,
    order: normalized.order,
    deletedAt: normalized.deletedAt ?? null,
    updatedAt: normalized.updatedAt ?? getMemoVersion(normalized),
  };
}

function getRawLocalMemos(): Memo[] {
  return readStoredMemos();
}

function saveRawLocalMemos(memos: Memo[]): void {
  writeStoredMemos(memos);
}

function markMemosSynced(ids: string[]): void {
  if (ids.length === 0) return;
  const syncedIds = new Set(ids);
  saveRawLocalMemos(getRawLocalMemos().map((memo) =>
    syncedIds.has(memo.id) ? { ...memo, syncStatus: 'synced' } : memo
  ));
}

export function getDeletedIds(): string[] {
  if (typeof window === 'undefined') return [];

  const parsed = parseJson<unknown>(localStorage.getItem(LOCAL_DELETED_MEMO_STORAGE_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id): id is string => typeof id === 'string');
}

function saveDeletedIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  const uniqueIds = Array.from(new Set(ids));
  localStorage.setItem(LOCAL_DELETED_MEMO_STORAGE_KEY, JSON.stringify(uniqueIds));
}

export function getLocalMemos(): Memo[] {
  return sortByOrder(readStoredMemos().filter((memo) => isActiveMemo(memo, getDeletedIds())));
}

export function saveLocalMemos(memos: Memo[]): void {
  const activeIds = new Set(memos.map((memo) => memo.id));
  const existingTombstones = getRawLocalMemos().filter(
    (memo) => memo.deletedAt && !activeIds.has(memo.id)
  );
  writeStoredMemos([...existingTombstones, ...filterDeletedMemos(memos, getDeletedIds())]);
}

export async function fetchMemos(userId?: string): Promise<Memo[]> {
  const localMemos = sortByOrder(getLocalMemos());
  if (!userId) return localMemos;

  try {
    await syncMemos(userId, FAST_FETCH_TIMEOUT_MS);
    return sortByOrder(getLocalMemos());
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.warn('[Storage] Server sync failed, using local cache:', error.message);
    }
    return localMemos;
  }
}

export async function saveMemo(memoData: Partial<Memo>, userId?: string): Promise<Memo> {
  const localMemos = getLocalMemos();
  const maxOrder = localMemos.reduce((max, memo) => Math.max(max, memo.order ?? 0), 0);
  const now = Date.now();

  const newMemo: Memo = {
    ...memoData,
    id: crypto.randomUUID(),
    content: memoData.content || '',
    category: memoData.category || 'THOUGHT',
    priority: memoData.priority || 'Medium',
    tags: memoData.tags || [],
    createdAt: now,
    updatedAt: now,
    targetDate: memoData.targetDate || getLocalDateString(),
    completed: false,
    order: maxOrder + 1,
    userId: userId || undefined,
    syncStatus: userId ? 'pending' : 'synced',
  };

  saveRawLocalMemos([...getRawLocalMemos(), newMemo]);

  if (userId) {
    try {
      const { error } = await withTimeout(supabase.from('memos').upsert([toRemoteMemo(newMemo, userId)]));
      if (error) throw error;
      markMemosSynced([newMemo.id]);
      return { ...newMemo, syncStatus: 'synced' };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Save failed on server: ${error.message}`);
      }
    }
  }

  return newMemo;
}

export async function updateMemo(id: string, updates: Partial<Memo>, userId?: string): Promise<void> {
  const memos = getRawLocalMemos();
  const index = memos.findIndex((memo) => memo.id === id);
  if (index !== -1) {
    const updatedMemo: Memo = {
      ...memos[index],
      ...updates,
      updatedAt: Date.now(),
      syncStatus: userId ? 'pending' : 'synced',
    };
    memos[index] = updatedMemo;
    saveRawLocalMemos(memos);

    if (userId) {
      try {
        const { error } = await withTimeout(supabase.from('memos').upsert([toRemoteMemo(updatedMemo, userId)]));
        if (error) throw error;
        markMemosSynced([id]);
      } catch {
        console.warn('Update failed on server.');
      }
    }
  }
}

export async function deleteMemo(id: string, userId?: string): Promise<void> {
  const memos = getRawLocalMemos();
  const index = memos.findIndex((memo) => memo.id === id);
  if (index === -1) return;

  if (!userId) {
    saveRawLocalMemos(memos.filter((memo) => memo.id !== id));
    return;
  }

  const now = Date.now();
  const tombstone: Memo = {
    ...memos[index],
    updatedAt: now,
    deletedAt: now,
    syncStatus: 'pending',
  };
  memos[index] = tombstone;
  saveRawLocalMemos(memos);

  try {
    const { error } = await withTimeout(supabase.from('memos').upsert([toRemoteMemo(tombstone, userId)]));
    if (error) throw error;
    markMemosSynced([id]);
  } catch (error: unknown) {
    console.warn('[Storage] Server delete failed, will retry on sync:', error);
  }
}

export async function syncToCloud(userId: string): Promise<void> {
  const localMemos = getLocalMemos();
  if (localMemos.length === 0) return;

  try {
    const { error } = await withTimeout(
      supabase.from('memos').upsert(localMemos.map((memo) => toRemoteMemo(memo, userId)))
    );
    if (error) throw error;
    markMemosSynced(localMemos.map((memo) => memo.id));
  } catch {
    console.error('Cloud backup failed.');
  }
}

export async function importMemosFromJson(json: string, userId?: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Backup file format is invalid.');
    }

    const processed: Memo[] = parsed.map((memo: Partial<Memo> & { subject?: string }) => ({
      ...normalizeMemo(memo, userId),
      syncStatus: userId ? 'pending' : 'synced',
    }));

    if (userId) {
      const { error } = await withTimeout(
        supabase.from('memos').upsert(processed.map((memo) => toRemoteMemo(memo, userId)))
      );
      if (error) throw error;
      processed.forEach((memo) => {
        memo.syncStatus = 'synced';
      });
    }

    saveRawLocalMemos(processed);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      alert(`Import failed: ${error.message}`);
    }
    return false;
  }
}

export function exportMemosToJson(): string {
  return JSON.stringify(getLocalMemos(), null, 2);
}

export interface SyncResult {
  ok: boolean;
  pulled?: number;
  pushed?: number;
  conflicts?: number;
}

interface MemoMergePlan {
  merged: Memo[];
  push: Memo[];
  pulled: number;
  conflicts: number;
}

function buildMemoMergePlan(localMemos: Memo[], remoteMemos: Memo[], userId: string): MemoMergePlan {
  const localById = new Map(localMemos.map((memo) => [memo.id, normalizeMemo(memo, userId)]));
  const remoteById = new Map(remoteMemos.map((memo) => [memo.id, normalizeMemo(memo, userId)]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged: Memo[] = [];
  const push: Memo[] = [];
  let pulled = 0;
  let conflicts = 0;

  for (const id of ids) {
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if (local && !remote) {
      if (local.deletedAt) {
        push.push(local);
        merged.push(local);
      } else {
        push.push(local);
        merged.push({ ...local, syncStatus: 'pending' });
      }
      continue;
    }

    if (!local && remote) {
      merged.push({ ...remote, syncStatus: 'synced' });
      pulled += remote.deletedAt ? 0 : 1;
      continue;
    }

    if (!local || !remote) continue;

    const localVersion = getMemoVersion(local);
    const remoteVersion = getMemoVersion(remote);
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

export async function syncMemos(userId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SyncResult> {
  try {
    const pendingDeletedIds = getDeletedIds();
    if (pendingDeletedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('memos')
        .delete()
        .in('id', pendingDeletedIds)
        .eq('userId', userId);

      if (!deleteError) {
        saveDeletedIds([]);
      }
    }

    const remoteMemos = await fetchRemoteMemos(userId, timeoutMs);
    const plan = buildMemoMergePlan(getRawLocalMemos(), remoteMemos, userId);

    if (plan.push.length > 0) {
      const { error: pushError } = await withTimeout(
        supabase.from('memos').upsert(plan.push.map((memo) => toRemoteMemo(memo, userId)))
      );
      if (pushError) throw pushError;
    }

    const pushedIds = new Set(plan.push.map((memo) => memo.id));
    saveRawLocalMemos(plan.merged.map((memo) =>
      pushedIds.has(memo.id) ? { ...memo, syncStatus: 'synced' } : memo
    ));

    return { ok: true, pulled: plan.pulled, pushed: plan.push.length, conflicts: plan.conflicts };
  } catch (error: unknown) {
    console.error('[Storage] Sync failed:', error);
    return { ok: false };
  }
}

export async function updateMemosOrder(orderedMemos: Memo[], userId?: string): Promise<void> {
  const now = Date.now();
  const updatedMemos = orderedMemos.map((memo) => ({
    ...memo,
    updatedAt: now,
    syncStatus: userId ? ('pending' as const) : ('synced' as const),
  }));
  saveLocalMemos(updatedMemos);

  if (!userId) return;

  try {
    const { error } = await withTimeout(
      supabase.from('memos').upsert(updatedMemos.map((memo) => toRemoteMemo(memo, userId)))
    );
    if (error) throw error;
    markMemosSynced(updatedMemos.map((memo) => memo.id));
  } catch {
    // intentionally ignored; local state already updated
  }
}

export async function mergeMemos(ids: string[], userId?: string): Promise<void> {
  const localMemos = getLocalMemos();
  const selectedMemos = localMemos
    .filter((memo) => ids.includes(memo.id))
    .sort((a, b) => a.createdAt - b.createdAt);

  if (selectedMemos.length < 2) return;

  const mergedContent = selectedMemos.map((memo) => memo.content).join('\n---\n');
  const baseMemo = selectedMemos[0];

  const newMemo = await saveMemo(
    {
      content: mergedContent,
      category: baseMemo.category,
      priority: baseMemo.priority,
      tags: Array.from(new Set(selectedMemos.flatMap((memo) => memo.tags))),
      folder: baseMemo.folder,
      targetDate: baseMemo.targetDate,
    },
    userId
  );

  for (const id of ids) {
    if (id !== newMemo.id) {
      await deleteMemo(id, userId);
    }
  }
}

export async function toggleMemoCompletion(id: string, userId?: string): Promise<void> {
  const memo = getLocalMemos().find((localMemo) => localMemo.id === id);
  if (memo) {
    await updateMemo(id, { completed: !memo.completed }, userId);
  }
}
