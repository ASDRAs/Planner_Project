import { Category, Priority } from './classifier';
import { supabase } from './supabase';
import { getLocalDateString } from './dateUtils';
import {
  LOCAL_DELETED_MEMO_STORAGE_KEY,
  LOCAL_MEMO_STORAGE_KEY,
} from './constants';

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
}

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

function filterDeletedMemos(memos: Memo[], deletedIds: string[]): Memo[] {
  if (deletedIds.length === 0) return memos;
  const deletedSet = new Set(deletedIds);
  return memos.filter((memo) => !deletedSet.has(memo.id));
}

function readStoredMemos(): Memo[] {
  if (typeof window === 'undefined') return [];
  const parsed = parseJson<unknown>(localStorage.getItem(LOCAL_MEMO_STORAGE_KEY), []);
  return Array.isArray(parsed) ? (parsed as Memo[]) : [];
}

function writeStoredMemos(memos: Memo[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_MEMO_STORAGE_KEY, JSON.stringify(memos));
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
  return (data as Memo[]) ?? [];
}

function saveRemoteSnapshotToLocal(remoteMemos: Memo[]): Memo[] {
  const filtered = filterDeletedMemos(remoteMemos, getDeletedIds());
  saveLocalMemos(filtered);
  return sortByOrder(filtered);
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

function addDeletedId(id: string): void {
  const ids = getDeletedIds();
  if (!ids.includes(id)) {
    saveDeletedIds([...ids, id]);
  }
}

function removeDeletedId(id: string): void {
  const ids = getDeletedIds();
  saveDeletedIds(ids.filter((existingId) => existingId !== id));
}

export function getLocalMemos(): Memo[] {
  return filterDeletedMemos(readStoredMemos(), getDeletedIds());
}

export function saveLocalMemos(memos: Memo[]): void {
  const filtered = filterDeletedMemos(memos, getDeletedIds());
  writeStoredMemos(filtered);
}

export async function fetchMemos(userId?: string): Promise<Memo[]> {
  const localMemos = sortByOrder(getLocalMemos());
  if (!userId) return localMemos;

  try {
    const remoteMemos = await fetchRemoteMemos(userId, FAST_FETCH_TIMEOUT_MS);
    return saveRemoteSnapshotToLocal(remoteMemos);
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

  const newMemo: Memo = {
    ...memoData,
    id: crypto.randomUUID(),
    content: memoData.content || '',
    category: memoData.category || 'THOUGHT',
    priority: memoData.priority || 'Medium',
    tags: memoData.tags || [],
    createdAt: Date.now(),
    targetDate: memoData.targetDate || getLocalDateString(),
    completed: false,
    order: maxOrder + 1,
    userId: userId || undefined,
  };

  if (userId) {
    try {
      const { error } = await withTimeout(supabase.from('memos').insert([newMemo]));
      if (error) throw error;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Save failed on server: ${error.message}`);
      }
    }
  }

  saveLocalMemos([...localMemos, newMemo]);
  return newMemo;
}

export async function updateMemo(id: string, updates: Partial<Memo>, userId?: string): Promise<void> {
  if (userId) {
    try {
      const { error } = await withTimeout(
        supabase.from('memos').update(updates).eq('id', id).eq('userId', userId)
      );
      if (error) throw error;
    } catch {
      console.warn('Update failed on server.');
    }
  }

  const memos = getLocalMemos();
  const index = memos.findIndex((memo) => memo.id === id);
  if (index !== -1) {
    memos[index] = { ...memos[index], ...updates };
    saveLocalMemos(memos);
  }
}

export async function deleteMemo(id: string, userId?: string): Promise<void> {
  const memos = getLocalMemos();
  saveLocalMemos(memos.filter((memo) => memo.id !== id));

  if (!userId) return;

  addDeletedId(id);

  try {
    const { error } = await withTimeout(
      supabase.from('memos').delete().eq('id', id).eq('userId', userId)
    );
    if (error) throw error;
    removeDeletedId(id);
  } catch (error: unknown) {
    console.warn('[Storage] Server delete failed, will retry on sync:', error);
  }
}

export async function syncToCloud(userId: string): Promise<void> {
  const localMemos = getLocalMemos();
  if (localMemos.length === 0) return;

  try {
    const { error } = await withTimeout(
      supabase.from('memos').upsert(localMemos.map((memo) => ({ ...memo, userId })))
    );
    if (error) throw error;
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
      id: memo.id || crypto.randomUUID(),
      content: memo.content || memo.subject || '',
      category: memo.category || 'THOUGHT',
      priority: memo.priority || 'Medium',
      tags: Array.isArray(memo.tags) ? memo.tags : [],
      createdAt: memo.createdAt || Date.now(),
      targetDate: memo.targetDate || getLocalDateString(),
      completed: !!memo.completed,
      folder: memo.folder || undefined,
      order: memo.order || 0,
      userId: userId || undefined,
    }));

    if (userId) {
      const { error } = await withTimeout(supabase.from('memos').upsert(processed));
      if (error) throw error;
    }

    saveLocalMemos(processed);
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

export async function syncMemos(userId: string): Promise<SyncResult> {
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

    const remoteMemos = await fetchRemoteMemos(userId);
    const localMemos = getLocalMemos();
    const remoteIdSet = new Set(remoteMemos.map((memo) => memo.id));
    const newLocalMemos = localMemos.filter((memo) => !remoteIdSet.has(memo.id));

    if (newLocalMemos.length > 0) {
      const { error: pushError } = await withTimeout(
        supabase.from('memos').upsert(newLocalMemos.map((memo) => ({ ...memo, userId })))
      );
      if (pushError) throw pushError;

      const refreshedRemoteMemos = await fetchRemoteMemos(userId);
      const merged = saveRemoteSnapshotToLocal(refreshedRemoteMemos);
      return { ok: true, pulled: merged.length, pushed: newLocalMemos.length };
    }

    const merged = saveRemoteSnapshotToLocal(remoteMemos);
    return { ok: true, pulled: merged.length, pushed: 0 };
  } catch (error: unknown) {
    console.error('[Storage] Sync failed:', error);
    return { ok: false };
  }
}

export async function updateMemosOrder(orderedMemos: Memo[], userId?: string): Promise<void> {
  saveLocalMemos(orderedMemos);

  if (!userId) return;

  try {
    await withTimeout(
      Promise.all(
        orderedMemos.map((memo) =>
          supabase
            .from('memos')
            .update({ order: memo.order, folder: memo.folder })
            .eq('id', memo.id)
            .eq('userId', userId)
        )
      )
    );
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
