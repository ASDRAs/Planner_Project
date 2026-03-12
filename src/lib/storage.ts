import { Category, Priority } from './classifier';
import { supabase } from './supabase';
import { getLocalDateString } from './dateUtils';

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

const STORAGE_KEY = 'daily-planner-memos';
const DELETED_KEY = 'daily-planner-deleted-ids';

/**
 * 서버 통신 타임아웃 헬퍼
 */
async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number = 8000): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Server Connection Timeout')), ms);
  });
  const result = await Promise.race([promise, timeout]);
  if (timeoutId) clearTimeout(timeoutId);
  return result;
}

export function getDeletedIds(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DELETED_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveDeletedIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
}

function addDeletedId(id: string) {
  const ids = getDeletedIds();
  if (!ids.includes(id)) {
    saveDeletedIds([...ids, id]);
  }
}

function removeDeletedId(id: string) {
  const ids = getDeletedIds();
  saveDeletedIds(ids.filter(i => i !== id));
}

export function getLocalMemos(): Memo[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  const memos: Memo[] = stored ? JSON.parse(stored) : [];
  const deletedIds = getDeletedIds();
  return memos.filter(m => !deletedIds.includes(m.id));
}

export function saveLocalMemos(memos: Memo[]) {
  if (typeof window === 'undefined') return;
  const deletedIds = getDeletedIds();
  const filtered = memos.filter(m => !deletedIds.includes(m.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function fetchMemos(userId?: string): Promise<Memo[]> {
  const local = getLocalMemos();
  
  // 게스트 모드이거나 오프라인일 때 즉시 로컬 반환
  if (!userId) return local.sort((a, b) => (a.order || 0) - (b.order || 0));

  try {
    const { data, error } = await withTimeout(
      supabase.from('memos').select('*').eq('userId', userId).order('order', { ascending: true }),
      3000 // 타임아웃을 3초로 단축하여 체감 속도 향상
    );
    
    if (error) throw error;
    if (data) {
      const deletedIds = getDeletedIds();
      const filteredData = (data as Memo[]).filter(m => !deletedIds.includes(m.id));
      saveLocalMemos(filteredData);
      return filteredData.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.warn("[Storage] Server sync failed, using local cache:", e.message);
    }
  }
  return local.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveMemo(memoData: Partial<Memo>, userId?: string): Promise<Memo> {
  const localMemos = getLocalMemos();
  const maxOrder = localMemos.reduce((max, m) => Math.max(max, m.order || 0), 0);
  
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
    userId: userId || undefined
  };

  if (userId) {
    try {
      const { error } = await withTimeout(supabase.from('memos').insert([newMemo]));
      if (error) throw error;
    } catch (e: unknown) {
      if (e instanceof Error) console.error(`저장 실패 (서버): ${e.message}`);
    }
  }

  saveLocalMemos([...localMemos, newMemo]);
  return newMemo;
}

export async function updateMemo(id: string, updates: Partial<Memo>, userId?: string): Promise<void> {
  if (userId) {
    try {
      const { error } = await withTimeout(supabase.from('memos').update(updates).eq('id', id).eq('userId', userId));
      if (error) throw error;
    } catch {
      console.warn("Update failed on server.");
    }
  }
  const memos = getLocalMemos();
  const idx = memos.findIndex(m => m.id === id);
  if (idx !== -1) {
    memos[idx] = { ...memos[idx], ...updates };
    saveLocalMemos(memos);
  }
}

export async function deleteMemo(id: string, userId?: string): Promise<void> {
  // 1. 즉시 로컬에서 제거 (Optimistic UI)
  const memos = getLocalMemos();
  saveLocalMemos(memos.filter(m => m.id !== id));

  if (userId) {
    // 2. 삭제 추적 시작
    addDeletedId(id);

    try {
      // 3. 서버 삭제 시도
      const { error } = await withTimeout(supabase.from('memos').delete().eq('id', id).eq('userId', userId));
      if (error) throw error;
      
      // 4. 성공 시 추적 제거
      removeDeletedId(id);
    } catch (e: unknown) {
      console.warn("[Storage] Server delete failed, will retry on sync:", e);
      // 알림은 띄우지 않음 (백그라운드에서 재시도될 것이므로)
    }
  }
}

export async function syncToCloud(userId: string): Promise<void> {
  const local = getLocalMemos();
  if (local.length === 0) return;
  try {
    const { error } = await withTimeout(supabase.from('memos').upsert(local.map(m => ({ ...m, userId }))));
    if (error) throw error;
  } catch {
    console.error("Cloud backup failed.");
  }
}

export async function importMemosFromJson(json: string, userId?: string): Promise<boolean> {
  try {
    const memos = JSON.parse(json);
    const processed: Memo[] = memos.map((m: Partial<Memo> & { subject?: string }) => ({
      id: m.id || crypto.randomUUID(),
      content: m.content || m.subject || "",
      category: m.category || "THOUGHT",
      priority: m.priority || "Medium",
      tags: Array.isArray(m.tags) ? m.tags : [],
      createdAt: m.createdAt || Date.now(),
      targetDate: m.targetDate || getLocalDateString(),
      completed: !!m.completed,
      folder: m.folder || undefined,
      order: m.order || 0,
      userId: userId || undefined
    }));

    if (userId) {
      const { error } = await withTimeout(supabase.from('memos').upsert(processed));
      if (error) throw error;
    }
    
    saveLocalMemos(processed);
    return true;
  } catch (e: unknown) {
    if (e instanceof Error) alert(`Import failed: ${e.message}`);
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

/**
 * Orchestrate synchronization with remote Supabase
 */
export async function syncMemos(userId: string): Promise<SyncResult> {
  try {
    // 1. 보류된 삭제 요청 처리
    const deletedIds = getDeletedIds();
    if (deletedIds.length > 0) {
      const { error: delError } = await supabase.from('memos').delete().in('id', deletedIds).eq('userId', userId);
      if (!delError) {
        saveDeletedIds([]); // 성공 시 추적 목록 초기화
      }
    }

    const local = getLocalMemos();
    
    // 2. 로컬 변경사항 푸시 (upsert)
    if (local.length > 0) {
      const { error: pushError } = await withTimeout(
        supabase.from('memos').upsert(local.map(m => ({ ...m, userId })))
      );
      if (pushError) throw pushError;
    }

    // 3. 원격 변경사항 가져오기
    const { data: remoteData, error: pullError } = await withTimeout(
      supabase.from('memos').select('*').eq('userId', userId).order('order', { ascending: true })
    );
    if (pullError) throw pullError;
    
    if (remoteData) {
      // 가져온 데이터에서 다시 한 번 로컬 삭제된 항목 필터링 (레이스 컨디션 방지)
      const currentDeletedIds = getDeletedIds();
      const filteredData = (remoteData as Memo[]).filter(m => !currentDeletedIds.includes(m.id));
      
      saveLocalMemos(filteredData);
      return { 
        ok: true, 
        pulled: filteredData.length, 
        pushed: local.length 
      };
    }
    
    return { ok: true, pushed: local.length };
  } catch (e: unknown) {
    console.error("[Storage] Sync failed:", e);
    return { ok: false };
  }
}

export async function updateMemosOrder(orderedMemos: Memo[], userId?: string): Promise<void> {
  saveLocalMemos(orderedMemos);
  if (userId) {
    try {
      await withTimeout(Promise.all(orderedMemos.map(m => 
        supabase.from('memos').update({ order: m.order, folder: m.folder }).eq('id', m.id).eq('userId', userId)
      )));
    } catch {
      // ignore
    }
  }
}

export async function mergeMemos(ids: string[], userId?: string): Promise<void> {
  const localMemos = getLocalMemos();
  const selected = localMemos.filter(m => ids.includes(m.id)).sort((a, b) => a.createdAt - b.createdAt);
  if (selected.length < 2) return;
  const mergedContent = selected.map(m => m.content).join('\n---\n');
  const base = selected[0];
  const newMemo = await saveMemo({
    content: mergedContent, category: base.category, priority: base.priority,
    tags: Array.from(new Set(selected.flatMap(m => m.tags))),
    folder: base.folder, targetDate: base.targetDate
  }, userId);
  for (const id of ids) {
    if (id !== newMemo.id) await deleteMemo(id, userId);
  }
}

export async function toggleMemoCompletion(id: string, userId?: string): Promise<void> {
  const memos = getLocalMemos();
  const memo = memos.find(m => m.id === id);
  if (memo) await updateMemo(id, { completed: !memo.completed }, userId);
}
