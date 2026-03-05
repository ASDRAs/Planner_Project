import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveMemo, getMemos, deleteMemo, toggleMemoCompletion, exportMemosToJson, importMemosFromJson, Memo } from './storage';

describe('storage utility - LocalStorage Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('새로운 메모를 저장하고 모든 메모를 불러올 수 있어야 함', async () => {
    const newMemo: Omit<Memo, 'id' | 'createdAt' | 'completed'> = {
      content: '테스트 메모 내용',
      category: 'STUDY',
      priority: 'Medium',
      tags: ['테스트']
    };

    await saveMemo(newMemo);
    const allMemos = getMemos();

    expect(allMemos).toHaveLength(1);
    expect(allMemos[0].content).toBe('테스트 메모 내용');
    expect(allMemos[0].id).toBeDefined();
    expect(allMemos[0].createdAt).toBeDefined();
  });

  it('특정 ID의 메모를 삭제할 수 있어야 함', async () => {
    const memo = await saveMemo({ content: '삭제될 메모', category: 'THOUGHT', priority: 'Low', tags: [] });
    expect(getMemos()).toHaveLength(1);

    await deleteMemo(memo.id);
    expect(getMemos()).toHaveLength(0);
  });

  it('메모의 완료 상태를 토글할 수 있어야 함', async () => {
    const memo = await saveMemo({ content: '할 일', category: 'TODO', priority: 'High', tags: [] });
    expect(getMemos()[0].completed).toBe(false);

    const toggled = await toggleMemoCompletion(memo.id);
    expect(toggled?.completed).toBe(true);
    expect(getMemos()[0].completed).toBe(true);
  });

  it('메모는 생성일 기준 내림차순(최신순)으로 정렬되어야 함', async () => {
    vi.useFakeTimers();
    
    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'));
    await saveMemo({ content: '첫 번째 메모', category: 'THOUGHT', priority: 'Low', tags: [] });
    
    vi.setSystemTime(new Date('2026-03-01T10:01:00Z'));
    await saveMemo({ content: '두 번째 메모', category: 'STUDY', priority: 'High', tags: [] });

    const memos = getMemos();
    expect(memos[0].content).toBe('두 번째 메모');
    expect(memos[1].content).toBe('첫 번째 메모');
    
    vi.useRealTimers();
  });

  it('데이터를 JSON 형식으로 내보낼 수 있어야 함', async () => {
    await saveMemo({ content: '내보낼 메모', category: 'STUDY', priority: 'Medium', tags: [] });
    const json = exportMemosToJson();
    const parsed = JSON.parse(json);
    
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe('내보낼 메모');
  });

  it('JSON 형식의 데이터를 가져와 기존 데이터를 업데이트할 수 있어야 함', () => {
    const backupData = [
      {
        id: 'old-1',
        content: '백업된 메모',
        category: 'THOUGHT',
        priority: 'Low',
        tags: [],
        createdAt: Date.now(),
        completed: false
      }
    ];
    const json = JSON.stringify(backupData);
    
    importMemosFromJson(json);
    const memos = getMemos();
    
    expect(memos).toHaveLength(1);
    expect(memos[0].id).toBe('old-1');
  });
});
