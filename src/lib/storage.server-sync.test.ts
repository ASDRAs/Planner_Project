import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_MEMO_STORAGE_KEY } from './constants';
import type { Memo } from './storage';

const {
  deleteEqMock,
  fromMock,
  remoteMemos,
  selectOrderMock,
  upsertMock,
} = vi.hoisted(() => {
  const remoteMemos: { value: Memo[] } = { value: [] };
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const selectOrderMock = vi.fn().mockImplementation(() => Promise.resolve({
    data: remoteMemos.value,
    error: null,
  }));
  const selectEqMock = vi.fn().mockReturnValue({ order: selectOrderMock });
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });
  const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
  const deleteInMock = vi.fn().mockReturnValue({ eq: deleteEqMock });
  const deleteMock = vi.fn().mockReturnValue({ in: deleteInMock });
  const fromMock = vi.fn().mockImplementation(() => ({
    delete: deleteMock,
    select: selectMock,
    upsert: upsertMock,
  }));

  return {
    deleteEqMock,
    deleteInMock,
    deleteMock,
    fromMock,
    remoteMemos,
    selectEqMock,
    selectMock,
    selectOrderMock,
    upsertMock,
  };
});

vi.mock('./supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { deleteMemo, getLocalMemos, mergeMemos, saveMemo, syncMemos, updateMemo } from './storage';

function createMemo(overrides: Partial<Memo>): Memo {
  return {
    id: 'memo-1',
    content: 'base',
    category: 'TODO',
    priority: 'Medium',
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
    targetDate: '2026-04-30',
    completed: false,
    order: 1,
    ...overrides,
  };
}

describe('storage server sync calls', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    remoteMemos.value = [];
    upsertMock.mockResolvedValue({ error: null });
    deleteEqMock.mockResolvedValue({ error: null });
    selectOrderMock.mockImplementation(() => Promise.resolve({
      data: remoteMemos.value,
      error: null,
    }));
  });

  it('upserts a memo with sync metadata when saving with userId', async () => {
    await saveMemo(
      {
        content: 'server-upsert-check',
        category: 'TODO',
        priority: 'High',
        tags: [],
      },
      'user-1'
    );

    expect(fromMock).toHaveBeenCalledWith('memos');
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0][0]).toMatchObject({
      content: 'server-upsert-check',
      deletedAt: null,
      folder: null,
      userId: 'user-1',
    });
    expect(upsertMock.mock.calls[0][0][0].updatedAt).toEqual(expect.any(Number));
    expect(upsertMock.mock.calls[0][0][0].syncStatus).toBeUndefined();
    expect(getLocalMemos()[0].syncStatus).toBe('synced');
  });

  it('upserts the full local memo when updating with userId', async () => {
    const memo = await saveMemo({ content: 'before', category: 'TODO', priority: 'Medium', tags: [] });

    vi.clearAllMocks();
    await updateMemo(memo.id, { completed: true }, 'user-1');

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0][0]).toMatchObject({
      id: memo.id,
      completed: true,
      userId: 'user-1',
    });
  });

  it('soft-deletes memos by upserting a deletedAt tombstone with userId', async () => {
    const memo = await saveMemo({ content: 'to-delete', category: 'THOUGHT', priority: 'Low', tags: [] });

    vi.clearAllMocks();
    await deleteMemo(memo.id, 'user-1');

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0][0]).toMatchObject({
      id: memo.id,
      userId: 'user-1',
    });
    expect(upsertMock.mock.calls[0][0][0].deletedAt).toEqual(expect.any(Number));
    expect(getLocalMemos()).toHaveLength(0);
  });

  it('upserts the merged memo and tombstones selected memos during merge with userId', async () => {
    const a = await saveMemo({ content: 'a', category: 'TODO', priority: 'Medium', tags: [] });
    const b = await saveMemo({ content: 'b', category: 'TODO', priority: 'Medium', tags: [] });
    const c = await saveMemo({ content: 'c', category: 'TODO', priority: 'Medium', tags: [] });

    vi.clearAllMocks();
    await mergeMemos([a.id, b.id, c.id], 'user-1');

    expect(upsertMock).toHaveBeenCalledTimes(4);
    expect(upsertMock.mock.calls[0][0][0].content).toBe('a\n---\nb\n---\nc');
    expect(upsertMock.mock.calls.slice(1).every((call) => typeof call[0][0].deletedAt === 'number')).toBe(true);
  });

  it('pushes a newer local pending memo instead of overwriting it with an older remote snapshot', async () => {
    localStorage.setItem(LOCAL_MEMO_STORAGE_KEY, JSON.stringify([
      createMemo({
        content: 'local newer',
        updatedAt: 3000,
        syncStatus: 'pending',
      }),
    ]));
    remoteMemos.value = [
      createMemo({
        content: 'remote older',
        updatedAt: 2000,
        userId: 'user-1',
      }),
    ];

    const result = await syncMemos('user-1');

    expect(result.ok).toBe(true);
    expect(result.pushed).toBe(1);
    expect(upsertMock.mock.calls[0][0][0]).toMatchObject({
      id: 'memo-1',
      content: 'local newer',
      updatedAt: 3000,
    });
    expect(getLocalMemos()[0]).toMatchObject({
      content: 'local newer',
      syncStatus: 'synced',
    });
  });

  it('pulls a newer remote memo when remote updatedAt is later than local updatedAt', async () => {
    localStorage.setItem(LOCAL_MEMO_STORAGE_KEY, JSON.stringify([
      createMemo({
        content: 'local older',
        updatedAt: 2000,
        syncStatus: 'synced',
      }),
    ]));
    remoteMemos.value = [
      createMemo({
        content: 'remote newer',
        updatedAt: 3000,
        userId: 'user-1',
      }),
    ];

    const result = await syncMemos('user-1');

    expect(result.ok).toBe(true);
    expect(result.pulled).toBe(1);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(getLocalMemos()[0]).toMatchObject({
      content: 'remote newer',
      syncStatus: 'synced',
    });
  });

  it('keeps a newer local delete tombstone and pushes it to remote', async () => {
    localStorage.setItem(LOCAL_MEMO_STORAGE_KEY, JSON.stringify([
      createMemo({
        content: 'deleted locally',
        updatedAt: 4000,
        deletedAt: 4000,
        syncStatus: 'pending',
      }),
    ]));
    remoteMemos.value = [
      createMemo({
        content: 'remote active',
        updatedAt: 3000,
        userId: 'user-1',
      }),
    ];

    const result = await syncMemos('user-1');

    expect(result.ok).toBe(true);
    expect(result.pushed).toBe(1);
    expect(upsertMock.mock.calls[0][0][0]).toMatchObject({
      id: 'memo-1',
      deletedAt: 4000,
      updatedAt: 4000,
    });
    expect(getLocalMemos()).toHaveLength(0);
  });

  it('pulls a newer remote delete tombstone and hides the local memo', async () => {
    localStorage.setItem(LOCAL_MEMO_STORAGE_KEY, JSON.stringify([
      createMemo({
        content: 'local active',
        updatedAt: 3000,
        syncStatus: 'synced',
      }),
    ]));
    remoteMemos.value = [
      createMemo({
        content: 'deleted remotely',
        updatedAt: 4000,
        deletedAt: 4000,
        userId: 'user-1',
      }),
    ];

    const result = await syncMemos('user-1');

    expect(result.ok).toBe(true);
    expect(result.pulled).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(getLocalMemos()).toHaveLength(0);
  });
});
