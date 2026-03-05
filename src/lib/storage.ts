import { Category, Priority } from './classifier';
import { supabase } from './supabase';

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

/**
 * 서버 통신 타임아웃 헬퍼
 * Supabase의 Thenable 객체와 호환되도록 any 타입을 사용하여 빌드 오류 방지
 */
async function withTimeout<T = any>(promise: Promise<T> | any, ms: number = 8000): Promise<T> {
  let timeoutId: any;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Server Connection Timeout')), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timeoutId);
  return result;
}

export function getLocalMemos(): Memo[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveLocalMemos(memos: Memo[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

export async function fetchMemos(userId?: string): Promise<Memo[]> {
  const local = getLocalMemos();
  
  // 게스트 모드이거나 오프라인일 때 즉시 로컬 반환
  if (!userId) return local.sort((a, b) => (a.order || 0) - (b.order || 0));

  // 서버 동기화는 비동기로 시도하되, UI는 일단 로컬 데이터를 먼저 보여주도록 설계됨
  // 호출부(page.tsx)에서 이 함수를 await 하므로, 여기서는 최대한 빨리 결과를 주거나 
  // 에러 발생 시 로컬을 보장해야 함.
  try {
    const { data, error } = await withTimeout(
      supabase.from('memos').select('*').eq('userId', userId).order('order', { ascending: true }),
      3000 // 타임아웃을 3초로 단축하여 체감 속도 향상
    );
    
    if (error) throw error;
    if (data) {
      saveLocalMemos(data as Memo[]);
      return (data as Memo[]).sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  } catch (e: any) {
    console.warn("[Storage] Server sync failed, using local cache:", e.message);
  }
  return local.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveMemo(memoData: any, userId?: string): Promise<Memo> {
  const localMemos = getLocalMemos();
  const maxOrder = localMemos.reduce((max, m) => Math.max(max, m.order || 0), 0);
  
  const newMemo: Memo = {
    ...memoData,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    targetDate: memoData.targetDate || new Date().toISOString().split('T')[0],
    completed: false,
    order: maxOrder + 1,
    userId: userId || undefined
  };

  if (userId) {
    try {
      const { error } = await withTimeout(supabase.from('memos').insert([newMemo]));
      if (error) throw error;
    } catch (e: any) {
      alert(`저장 실패 (서버): ${e.message}`);
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
    } catch (e: any) {
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
  if (userId) {
    try {
      const { error } = await withTimeout(supabase.from('memos').delete().eq('id', id).eq('userId', userId));
      if (error) throw error;
    } catch (e: any) {
      alert(`삭제 실패 (서버): ${e.message}`);
    }
  }
  const memos = getLocalMemos();
  saveLocalMemos(memos.filter(m => m.id !== id));
}

export async function syncToCloud(userId: string): Promise<void> {
  const local = getLocalMemos();
  if (local.length === 0) return;
  try {
    const { error } = await withTimeout(supabase.from('memos').upsert(local.map(m => ({ ...m, userId }))));
    if (error) throw error;
  } catch (e) {
    console.error("Cloud backup failed.");
  }
}

export async function importMemosFromJson(json: string, userId?: string): Promise<boolean> {
  try {
    const memos = JSON.parse(json);
    const processed: Memo[] = memos.map((m: any) => ({
      id: m.id || crypto.randomUUID(),
      content: m.content || m.subject || "",
      category: m.category || "THOUGHT",
      priority: m.priority || "Medium",
      tags: Array.isArray(m.tags) ? m.tags : [],
      createdAt: m.createdAt || Date.now(),
      targetDate: m.targetDate || new Date().toISOString().split('T')[0],
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
  } catch (e: any) {
    alert(`Import failed: ${e.message}`);
    return false;
  }
}

export function exportMemosToJson(): string { 
  return JSON.stringify(getLocalMemos(), null, 2); 
}

export async function updateMemosOrder(orderedMemos: Memo[], userId?: string): Promise<void> {
  saveLocalMemos(orderedMemos);
  if (userId) {
    try {
      await withTimeout(Promise.all(orderedMemos.map(m => 
        supabase.from('memos').update({ order: m.order, folder: m.folder }).eq('id', m.id).eq('userId', userId)
      )));
    } catch (e) {}
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
